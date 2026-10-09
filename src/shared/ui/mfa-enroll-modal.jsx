import { useState } from 'react'
import { LuShieldCheck, LuCheck } from 'react-icons/lu'
import ReusableModal from '@shared/ui/reusable-modal'
import { useMFA } from '@shared/hooks/use-mfa'
import { unenrollFactor, listMFAFactors } from '@shared/api/mfa'
import { MFA_I18N } from '@shared/lib/i18n/mfa-i18n'
import Button from '@shared/ui/button'

// Modal d'affichage + verify d'un facteur MFA TOTP **déjà enrollé** par
// le composant parent.
//
// Refactor v3.3.7+ : avant on enrolled dans un useEffect au mount, ce qui
// causait des bugs StrictMode (double-mount → cancellation du 1er enroll).
// Maintenant le parent (MFASection dans ProfileModal) appelle startEnroll
// au clic du bouton « Activer la 2FA », et passe le factor en prop.
//
// Cette modale ne fait que :
//   1. Afficher le QR code + secret texte
//   2. Récupérer le code 6 chiffres saisi par l'user
//   3. Appeler verify() pour activer
//   4. Afficher un écran succès
//
// Cleanup : si l'user ferme la modale avant verify, on supprime le
// facteur 'unverified' pour ne pas laisser d'orphelin.

export default function MFAEnrollModal({ factor, lang = 'fr', darkMode = false, onClose, onEnrolled }) {
  const t = MFA_I18N[lang] ?? MFA_I18N.fr
  const { verify } = useMFA()

  const [code,       setCode]       = useState('')
  const [step,       setStep]       = useState('code')   // code | success
  const [error,      setError]      = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function handleCancel() {
    if (factor?.id && step !== 'success') {
      // Supprime le facteur unverified pour ne pas laisser d'orphelin
      unenrollFactor(factor.id).catch(() => {})
    }
    onClose?.()
  }

  async function handleVerify() {
    if (code.length !== 6 || submitting) return
    // 🔴 Cette modale est défensive PARTOUT ailleurs (`factor?.id` au nettoyage,
    // `factor?.qrCode`, `factor?.secret` à l'affichage) — donc elle peut être
    // rendue sans facteur : champ de code visible, pas de QR. Sans cette garde,
    // l'appel `verify({ factorId: factor.id })` juste en dessous levait alors une
    // TypeError au lieu d'afficher une erreur, en plein parcours d'activation
    // de la double authentification.
    //
    // Sa jumelle `mfa-challenge-modal.jsx` porte cette garde depuis toujours,
    // avec le même message : c'est la copie qui l'avait perdue (classe de défaut
    // dominante de ce dépôt, cf. audit du 2026-08-28).
    if (!factor?.id) {
      setError(t.noActiveFactor)
      return
    }
    setSubmitting(true)
    setError(null)

    // Workaround timeout race : la promesse Supabase peut hang malgré que
    // le serveur ait validé. À expiration, on re-fetch la liste et on
    // check si notre facteur est passé en verified.
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
        setStep('success')
        return
      }

      // Timeout → check si verified côté serveur
      const list = await listMFAFactors()
      const f = list.totp?.find(f => f.id === factor.id)
      setSubmitting(false)
      if (f?.status === 'verified') {
        setStep('success')
        return
      }
      setError(t.invalidCode)
      setCode('')
    } catch (err) {
      setSubmitting(false)
      setError(t.unexpectedError(err.message ?? String(err)))
    }
  }

  function handleSuccessClose() {
    onEnrolled?.()
    onClose?.()
  }

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : '#D4C8B5'
  const inputBg = darkMode ? '#1A2F48' : '#FFFFFF'
  const accent = 'var(--color-success)'

  if (step === 'success') {
    return (
      <ReusableModal
        open
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <LuShieldCheck size={20} color={accent} />
            {t.successTitle}
          </span>
        }
        onClose={handleSuccessClose}
        darkMode={darkMode}
        size="md"
        footer={
          <Button
            onClick={handleSuccessClose}
            className="h-auto rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ background: accent }}
          >
            {t.closeBtn}
          </Button>
        }
      >
        <p style={{ fontSize: 14, lineHeight: 1.55, color: fg, margin: 0 }}>
          {t.successDesc}
        </p>
      </ReusableModal>
    )
  }

  // step === 'code'
  return (
    <ReusableModal
      open
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <LuShieldCheck size={20} color="var(--color-brand-500)" />
          {t.enrollTitle}
        </span>
      }
      onClose={handleCancel}
      darkMode={darkMode}
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleCancel}
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
            className="h-auto rounded-lg bg-[#E07820] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            {!submitting && <LuCheck size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />}
            {submitting ? t.enrolling : t.nextBtn}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: muted, marginTop: 0, marginBottom: 14 }}>
        {t.enrollIntro}
      </p>

      {/* QR code */}
      {factor?.qrCode && (
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: 16, background: '#FFFFFF',
          borderRadius: 12, marginBottom: 12,
        }}>
          <img
            src={factor.qrCode}
            alt={t.qrAlt}
            style={{ width: 180, height: 180, display: 'block' }}
          />
        </div>
      )}

      {/* Secret texte (fallback) */}
      {factor?.secret && (
        <details style={{ marginBottom: 14, fontSize: 12, color: muted }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t.cantScan}</summary>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: muted, marginBottom: 4 }}>
              {t.secretLabel}
            </div>
            <code style={{
              display: 'block', padding: '8px 10px',
              background: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
              borderRadius: 6, fontSize: 13,
              wordBreak: 'break-all', fontFamily: 'monospace',
              color: fg,
            }}>{factor.secret}</code>
          </div>
        </details>
      )}

      {/* Champ code */}
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

