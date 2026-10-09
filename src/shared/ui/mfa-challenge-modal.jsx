import { useState } from 'react'
import { LuShieldCheck, LuCheck } from 'react-icons/lu'
import ReusableModal from '@shared/ui/reusable-modal'
import { useMFA } from '@shared/hooks/use-mfa'
import { getAAL } from '@shared/api/mfa'
import { MFA_I18N } from '@shared/lib/i18n/mfa-i18n'
import Button from '@shared/ui/button'

// Modal de challenge AAL2 — utilisée pour élever le niveau d'assurance
// d'une session de aal1 → aal2 avant une action sensible (désactiver la
// 2FA, accéder à des données critiques, modifier le rôle d'un user…).
//
// Flow :
//   1. L'user a déjà un facteur TOTP verified dans son compte
//   2. Cette modale s'ouvre, demande le code 6 chiffres courant
//   3. challengeAndVerify → si OK, session passe en aal2
//   4. onChallenged() → le composant parent peut désormais faire l'action
//
// Workaround timeout pareil que MFAEnrollModal : si la promesse Supabase
// hang, on race avec un timeout 6s + check AAL pour détecter succès.

export default function MFAChallengeModal({
  reason,           // optionnel : phrase contextuelle ("Pour désactiver la 2FA...")
  lang = 'fr',
  darkMode = false,
  onClose,
  onChallenged,
}) {
  const t = MFA_I18N[lang] ?? MFA_I18N.fr
  const { factors, verify, refresh } = useMFA()

  const [code,       setCode]       = useState('')
  const [error,      setError]      = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const factor = factors[0]   // on prend le 1er facteur verified

  async function handleVerify() {
    if (code.length !== 6 || submitting) return
    if (!factor?.id) {
      setError(t.noActiveFactor)
      return
    }
    setSubmitting(true)
    setError(null)

    const verifyPromise = verify({ factorId: factor.id, code })
      .then(r => ({ kind: 'response', ...r }))
    const timeoutPromise = new Promise(resolve =>
      setTimeout(() => resolve({ kind: 'timeout' }), 6000)
    )

    try {
      const result = await Promise.race([verifyPromise, timeoutPromise])

      if (result.kind === 'response') {
        setSubmitting(false)
        if (result.error) {
          setError(result.error.message ?? t.invalidCode)
          setCode('')
          return
        }
        await refresh()
        onChallenged?.()
        onClose?.()
        return
      }

      // Timeout → le challengeAndVerify a pu aboutir côté serveur sans que
      // sa promesse rende la main. On ne laisse passer que sur la PREUVE que
      // la session est montée en aal2 : avant le 2026-10-05, on appelait
      // onChallenged() sans rien vérifier — bloquer la requête suffisait à
      // passer (audit du 2026-10-04, CPT-01 a).
      const { current } = await getAAL()
      await refresh()
      setSubmitting(false)
      if (current !== 'aal2') {
        setError(t.gateFailed)
        return
      }
      onChallenged?.()
      onClose?.()
    } catch (err) {
      setSubmitting(false)
      setError(t.unexpectedError(err.message ?? String(err)))
    }
  }

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : '#D4C8B5'
  const inputBg = darkMode ? '#1A2F48' : '#FFFFFF'

  return (
    <ReusableModal
      open
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <LuShieldCheck size={20} color="var(--color-brand-500)" />
          {t.challengeTitle}
        </span>
      }
      onClose={submitting ? undefined : onClose}
      darkMode={darkMode}
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {t.cancelBtn}
          </Button>
          <Button
            onClick={handleVerify}
            loading={submitting}
            disabled={code.length !== 6 || submitting}
            className="h-auto rounded-lg bg-[#B85000] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            {!submitting && <LuCheck size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />}
            {submitting ? t.challenging : t.challengeBtn}
          </Button>
        </>
      }
    >
      {reason && (
        <div style={{
          padding: '10px 12px', marginBottom: 12, borderRadius: 8,
          background: darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(247,168,94,0.12)',
          border: `1px solid ${darkMode ? 'rgba(247,168,94,0.3)' : 'rgba(247,168,94,0.25)'}`,
          fontSize: 12.5, lineHeight: 1.5, color: fg,
        }}>
          {reason}
        </div>
      )}

      <p style={{ fontSize: 13, lineHeight: 1.55, color: muted, marginTop: 0, marginBottom: 12 }}>
        {t.challengeIntro}
      </p>

      <label style={{ display: 'block' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t.codeLabel}
        </span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t.codePlaceholder}
          autoFocus
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 8,
            border: `1.5px solid ${error ? 'var(--color-danger)' : border}`,
            background: inputBg, color: fg,
            fontSize: 18, letterSpacing: '0.4em',
            fontFamily: 'monospace', textAlign: 'center',
          }}
        />
      </label>

      {error && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)', fontWeight: 600 }}>
          ⚠️ {error}
        </p>
      )}
    </ReusableModal>
  )
}

