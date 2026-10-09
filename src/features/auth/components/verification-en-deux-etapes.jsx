import { useState } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { useUI } from '@shared/contexts/ui-provider'
import { verifyTOTP, getAAL } from '@shared/api/mfa'
import { MFA_I18N } from '@shared/lib/i18n/mfa-i18n'
import Button from '@shared/ui/button'

// L'écran « Vérification en 2 étapes » (audit du 2026-10-04, CPT-01 ; maquette
// validée par Antoine le 2026-10-05). Rendu par `PorteDoubleAuthentification`
// à la place de toute l'application, tant que le code est dû.
//
// Un seul champ (et non six) : le collage, le remplissage automatique
// (`one-time-code`) et les lecteurs d'écran marchent d'emblée ; les six cases
// de la maquette n'en sont que l'affichage.
//
// On ne passe que sur la PREUVE que la session est montée en aal2 : si la
// vérification ne répond pas, on relit le niveau de la session, et la porte
// reste si elle n'a pas bougé. La porte se lève d'elle-même quand
// `AuthProvider` reçoit MFA_CHALLENGE_VERIFIED.

const DELAI_MS = 6000
const SUPPORT = 'support@fridgeplus.app'
// Orange plus soutenu que celui de la marque : 5,1:1 sous un texte blanc,
// 4,7:1 en texte sur le fond clair (la palette, A11Y-03, reste à trancher).
const ORANGE = '#B4520E'

function messageDErreur(erreur, t) {
  if (erreur?.status === 429 || erreur?.code === 'over_request_rate_limit') return t.gateTooMany
  if (erreur?.code === 'mfa_verification_failed' || /invalid/i.test(erreur?.message ?? '')) return t.gateInvalid
  return t.gateFailed
}

export default function VerificationEnDeuxEtapes() {
  const { mfaFactorId, signOut } = useAuth()
  const { lang, darkMode } = useUI()
  const t = MFA_I18N[lang] ?? MFA_I18N.fr
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [aide, setAide] = useState(false)
  const [focus, setFocus] = useState(false)

  const c = darkMode
    ? { fond: '#0F1923', carte: '#14202D', texte: 'var(--color-bg-warm)', doux: '#A0A8B8', bord: 'var(--color-dark-border)', lien: '#F7A85E' }
    : { fond: '#FBF6EF', carte: '#FFFFFF', texte: '#2C1A0E', doux: '#6B5A44', bord: '#E3D5C2', lien: ORANGE }

  async function verifier(e) {
    e?.preventDefault()
    if (envoi) return
    if (code.length !== 6) { setErreur(t.gateIncomplete); return }
    if (!mfaFactorId) { setErreur(t.gateFailed); return }
    setEnvoi(true)
    setErreur(null)
    const reponse = verifyTOTP({ factorId: mfaFactorId, code }).then((r) => ({ type: 'reponse', ...r }))
    const delai = new Promise((resolve) => setTimeout(() => resolve({ type: 'delai' }), DELAI_MS))
    const r = await Promise.race([reponse, delai])
    if (r.type === 'reponse') {
      if (r.error) {
        setErreur(messageDErreur(r.error, t))
        setCode('')
        setEnvoi(false)
      }
      return
    }
    const { current } = await getAAL()
    if (current !== 'aal2') {
      setErreur(t.gateFailed)
      setEnvoi(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: c.fond, color: c.texte }}>
      <header style={{ padding: '16px 22px', borderBottom: `1px solid ${c.bord}`, fontSize: 19, fontWeight: 800 }}>
        Fridge<span style={{ color: c.lien }}>+</span>
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 20px' }}>
        <form onSubmit={verifier} noValidate style={{ width: '100%', maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div aria-hidden="true" style={{ fontSize: 44, lineHeight: 1 }}>🔐</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t.gateTitle}</h1>
          <p id="mfa-consigne" style={{ fontSize: 15, lineHeight: 1.5, color: c.doux, margin: 0 }}>{t.gateIntro}</p>

          <label htmlFor="mfa-code" className="sr-only">{t.codeLabel}</label>
          <div style={{ position: 'relative' }}>
            <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: 6 }, (_, i) => {
                const active = focus && i === Math.min(code.length, 5)
                return (
                  <span key={i} style={{
                    width: 44, height: 54, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700, background: c.carte,
                    border: `2px solid ${active ? c.lien : code[i] ? c.texte : c.bord}`,
                    outline: active ? `2px solid ${c.lien}` : 'none', outlineOffset: 2,
                  }}>{code[i] ?? ''}</span>
                )
              })}
            </div>
            <input
              id="mfa-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErreur(null) }}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              aria-describedby="mfa-consigne"
              aria-invalid={erreur ? 'true' : undefined}
              style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'text' }}
            />
          </div>

          {erreur && <p role="alert" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: darkMode ? '#F59B9B' : '#B42318' }}>{erreur}</p>}

          <Button type="submit" loading={envoi} className="h-auto w-full rounded-xl py-3 text-base font-bold text-white" style={{ background: ORANGE }}>
            {envoi ? t.challenging : t.challengeBtn}
          </Button>

          <button type="button" onClick={() => setAide((v) => !v)} aria-expanded={aide}
            style={{ background: 'none', border: 0, padding: 6, fontSize: 15, fontWeight: 700, color: c.lien, cursor: 'pointer' }}>
            {t.gateLost}
          </button>
          {aide && (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: c.doux }}>
              {t.gateLostHelp}{' '}
              <a href={`mailto:${SUPPORT}?subject=${encodeURIComponent(t.gateLostSubject)}`} style={{ color: c.lien, fontWeight: 700 }}>{SUPPORT}</a>
            </p>
          )}

          <Button type="button" variant="secondary" onClick={() => signOut()}
            className="h-auto w-full rounded-xl border py-3 text-base font-bold" style={{ background: c.carte, borderColor: c.bord, color: c.texte }}>
            {t.gateSignOut}
          </Button>
        </form>
      </main>
    </div>
  )
}
