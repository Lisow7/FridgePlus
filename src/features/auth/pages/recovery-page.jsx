import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuLock, LuEye, LuEyeOff } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import {
  validatePassword, PWD_SCORE_MAX, PWD_COLORS, PWD_STRENGTH_LABELS, PWD_HINT, PWD_ERROR_WEAK,
} from '@shared/lib/auth/password-policy'
import Button from '@shared/ui/button'
import AuthLayout from '@features/auth/components/auth-layout'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { titreDeRoute } from '@routes/route-title'

// RecoveryPage — page de définition d'un nouveau mot de passe.
// Sprint 11 S11.b.4.
//
// Déclenchée par le flow reset password :
//   1. User clique « Mot de passe oublié ? » sur /login → reçoit un email
//   2. Clic sur le lien email → Supabase émet PASSWORD_RECOVERY event
//   3. auth-provider.jsx active `recoveryMode = true`
//   4. App.jsx navigate vers /auth/recovery (Sprint 11 S11.b.4)
//   5. RecoveryGuard laisse passer (recoveryMode true)
//   6. User saisit + confirme son nouveau password
//   7. completePasswordReset() → recoveryMode reset → redirect /
//
// Gated par RecoveryGuard : si recoveryMode false → redirect /.

// v3.416 — Policy mot de passe partagée avec signup (cf. password-policy.js)
// alignée sur Supabase Auth pour éviter les 422 weak_password.

const I18N = {
  fr: {
    pageTitle: 'Définir un nouveau mot de passe',
    intro: 'Choisis un nouveau mot de passe pour ton compte. Il remplace l\'ancien immédiatement.',
    pwdLabel: 'Nouveau mot de passe',
    pwdPlaceholder: '••••••••',
    pwd2Label: 'Confirmer le mot de passe',
    pwdHint: PWD_HINT.fr,
    pwdReveal: 'Afficher le mot de passe',
    pwdHide: 'Masquer le mot de passe',
    pwdStrength: PWD_STRENGTH_LABELS.fr,
    submitBtn: 'Mettre à jour mon mot de passe',
    loadingLabel: 'Mise à jour…',
    successLabel: '✓ Mot de passe mis à jour. Redirection…',
    errorMismatch: 'Les deux mots de passe ne correspondent pas.',
    errorWeak: PWD_ERROR_WEAK.fr,
    errorGeneric: 'Impossible de mettre à jour. Réessaie.',
  },
  en: {
    pageTitle: 'Set a new password',
    intro: 'Choose a new password for your account. It replaces the old one immediately.',
    pwdLabel: 'New password',
    pwdPlaceholder: '••••••••',
    pwd2Label: 'Confirm password',
    pwdHint: PWD_HINT.en,
    pwdReveal: 'Show password',
    pwdHide: 'Hide password',
    pwdStrength: PWD_STRENGTH_LABELS.en,
    submitBtn: 'Update my password',
    loadingLabel: 'Updating…',
    successLabel: '✓ Password updated. Redirecting…',
    errorMismatch: 'The two passwords don\'t match.',
    errorWeak: PWD_ERROR_WEAK.en,
    errorGeneric: 'Unable to update. Try again.',
  },
}

export default function RecoveryPage({ lang = 'fr', darkMode = false }) {
  useDocumentTitle(titreDeRoute('/auth/recovery', lang))
  const t = I18N[lang] ?? I18N.fr
  const { completePasswordReset } = useAuth()
  const navigate = useNavigate()

  const [pwd, setPwd]       = useState('')
  const [pwd2, setPwd2]     = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  const pwdVal = pwd ? validatePassword(pwd) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (pwd !== pwd2)             { setError(t.errorMismatch); return }
    const { score } = validatePassword(pwd)
    if (score < PWD_SCORE_MAX)    { setError(t.errorWeak); return }

    setLoading(true)
    try {
      const { error: resetError } = await completePasswordReset(pwd)
      if (resetError) {
        // v3.416 — détecter le weak_password Supabase (cas client bypass).
        if (resetError.message?.toLowerCase().includes('weak')) setError(t.errorWeak)
        else setError(t.errorGeneric)
      } else {
        setSuccess(true)
        // Redirect / après 1.5s. completePasswordReset reset recoveryMode
        // côté auth-provider, donc le RecoveryGuard nous renverrait vers /
        // au prochain re-render — on force juste la navigation explicite.
        setTimeout(() => navigate('/', { replace: true }), 1500)
      }
    } catch {
      setError(t.errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  const inputBg     = darkMode ? '#141F2E' : '#F5EDE0'
  const inputBorder = darkMode ? '#2A3A50' : 'var(--color-border-warm)'
  const inputBorderEmpty = darkMode ? '#2A3A50' : '#E8DDD0'
  const textColor   = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor  = darkMode ? '#7A90A8' : '#6A4F45'

  const inputStyle = {
    width: '100%', padding: '12px 12px 12px 38px', borderRadius: '10px',
    border: `1.5px solid ${inputBorder}`, background: inputBg,
    color: textColor, fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <AuthLayout lang={lang} darkMode={darkMode} title={t.pageTitle}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ fontSize: '13px', color: mutedColor, margin: 0, lineHeight: 1.55 }}>
          {t.intro}
        </p>

        {/* Nouveau password */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.pwdLabel}</span>
          <div style={{ position: 'relative' }}>
            <LuLock aria-hidden="true" size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: mutedColor }}
            />
            <input
              type={showPwd ? 'text' : 'password'}
              required autoComplete="new-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder={t.pwdPlaceholder}
              style={{ ...inputStyle, paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? t.pwdHide : t.pwdReveal}
              title={showPwd ? t.pwdHide : t.pwdReveal}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: mutedColor, padding: '6px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {showPwd ? <LuEyeOff size={16} /> : <LuEye size={16} />}
            </button>
          </div>
          {pwdVal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                {Array.from({ length: PWD_SCORE_MAX }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: '4px', borderRadius: '2px',
                    background: i < pwdVal.score ? PWD_COLORS[pwdVal.score - 1] : inputBorderEmpty,
                    transition: 'background 0.15s',
                  }} />
                ))}
              </div>
              {pwdVal.score > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: PWD_COLORS[pwdVal.score - 1] }}>
                  {t.pwdStrength[pwdVal.score - 1]}
                </span>
              )}
            </div>
          )}
          <span style={{ fontSize: '11px', color: mutedColor }}>{t.pwdHint}</span>
        </label>

        {/* Confirmation */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.pwd2Label}</span>
          <div style={{ position: 'relative' }}>
            <LuLock aria-hidden="true" size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: mutedColor }}
            />
            <input
              type={showPwd ? 'text' : 'password'}
              required autoComplete="new-password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder={t.pwdPlaceholder}
              style={inputStyle}
            />
          </div>
        </label>

        {error && (
          <p role="alert" style={{
            margin: 0, padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(220,38,38,0.10)', color: '#DC2626',
            fontSize: '13px', fontWeight: 600,
          }}>
            {error}
          </p>
        )}
        {success && (
          <p role="status" aria-live="polite" style={{
            margin: 0, padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(34,197,94,0.12)', color: '#16A34A',
            fontSize: '13px', fontWeight: 600,
          }}>
            {t.successLabel}
          </p>
        )}

        <Button type="submit" loading={loading} disabled={loading || success} className="w-full">
          {loading ? t.loadingLabel : t.submitBtn}
        </Button>
      </form>
    </AuthLayout>
  )
}
