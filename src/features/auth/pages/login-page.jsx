import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LuMail, LuLock, LuEye, LuEyeOff, LuArrowLeft } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import Button from '@shared/ui/button'
import GoogleButton from '@shared/ui/google-button'
import AuthLayout from '@features/auth/components/auth-layout'
import ResendConfirmation from '@features/auth/components/resend-confirmation'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { titreDeRoute } from '@routes/route-title'
import { SUPPORT_EMAIL } from '@shared/lib/contact'

// LoginPage — page d'authentification complète.
// Sprint 11 S11.b.2.
//
// 2 vues :
//   - Login : email + password (show/hide) + remember me + lien « mdp oublié ? »
//   - Forgot : email + bouton « Envoyer le lien de reset »
//
// Gated par RedirectIfAuthGuard (cf. routes-config.js) : si user déjà
// loggé → redirect vers / (ou state.from si AuthGuard a redirigé ici).
//
// Recovery flow (PASSWORD_RECOVERY event Supabase) géré par RecoveryPage
// dédié sur /auth/recovery (S11.b.4 à venir).

const I18N = {
  fr: {
    // Login
    pageTitle: 'Se connecter',
    emailLabel: 'E-mail',
    emailPlaceholder: 'ton.email@exemple.com',
    pwdLabel: 'Mot de passe',
    pwdPlaceholder: '••••••••',
    pwdReveal: 'Afficher le mot de passe',
    pwdHide: 'Masquer le mot de passe',
    rememberMe: 'Se souvenir de moi',
    forgotLink: 'Mot de passe oublié ?',
    submitBtn: 'Se connecter',
    loadingLabel: 'Connexion…',
    errorGeneric: 'Connexion impossible. Vérifie tes identifiants.',
    errorBanned: `Ce compte est suspendu. Pour contester, ou demander l'effacement de tes données, écris à ${SUPPORT_EMAIL}.`,
    errorNotConfirmed: 'E-mail non confirmé. Vérifie ta boîte de réception.',
    noAccount: 'Pas encore de compte ?',
    signupLink: 'Créer un compte',
    // Forgot password
    forgotTitle: 'Réinitialiser le mot de passe',
    forgotIntro: 'Saisis ton e-mail. Si un compte existe, tu recevras un lien pour définir un nouveau mot de passe.',
    forgotSubmit: 'Envoyer le lien par e-mail',
    // Durée et usage unique : ce que dit l'e-mail lui-même (reset-password.html).
    // « Dans ce navigateur » : le lien ne peut ouvrir de session qu'ici.
    forgotSent: '✓ E-mail envoyé. Regarde aussi dans les indésirables. Le lien est valable une heure, une seule fois : ouvre-le dans ce navigateur.',
    forgotError: 'Impossible d\'envoyer l\'e-mail. Réessaie plus tard.',
    backToLogin: 'Retour à la connexion',
    continueWithGoogle: 'Continuer avec Google',
    orSeparator: 'ou',
    googleError: 'Connexion Google impossible. Réessaie.',
  },
  en: {
    pageTitle: 'Sign in',
    emailLabel: 'E-mail',
    emailPlaceholder: 'your.email@example.com',
    pwdLabel: 'Password',
    pwdPlaceholder: '••••••••',
    pwdReveal: 'Show password',
    pwdHide: 'Hide password',
    rememberMe: 'Remember me',
    forgotLink: 'Forgot password?',
    submitBtn: 'Sign in',
    loadingLabel: 'Signing in…',
    errorGeneric: 'Sign-in failed. Check your credentials.',
    errorBanned: `This account is suspended. To appeal, or to request the deletion of your data, write to ${SUPPORT_EMAIL}.`,
    errorNotConfirmed: 'E-mail not confirmed. Check your inbox.',
    noAccount: 'No account yet?',
    signupLink: 'Create an account',
    forgotTitle: 'Reset password',
    forgotIntro: 'Enter your e-mail. If an account exists, you\'ll receive a link to set a new password.',
    forgotSubmit: 'Send the reset link',
    forgotSent: '✓ E-mail sent. Check your spam folder too. The link is valid for one hour, once: open it in this browser.',
    forgotError: 'Could not send e-mail. Try again later.',
    backToLogin: 'Back to sign in',
    continueWithGoogle: 'Continue with Google',
    orSeparator: 'or',
    googleError: 'Google sign-in failed. Try again.',
  },
}

const REMEMBER_KEY = 'fridge-remember-email'

export default function LoginPage({ lang = 'fr', darkMode = false }) {
  useDocumentTitle(titreDeRoute('/login', lang))
  const t = I18N[lang] ?? I18N.fr
  const { signInWithEmail, resetPassword, signInWithGoogle } = useAuth()

  // ── Vue : login (par défaut) ou forgot password ─────────────────────
  const [view, setView] = useState('login')

  // Login form
  const initialEmail = (() => {
    try { return localStorage.getItem(REMEMBER_KEY) ?? '' } catch { return '' }
  })()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [rememberMe, setRememberMe] = useState(!!initialEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Adresse jamais confirmée : on propose de renvoyer l'e-mail de confirmation.
  const [notConfirmed, setNotConfirmed] = useState(false)

  // Forgot form
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState('idle') // idle | loading | success | error

  // Login Google
  const [googleLoading, setGoogleLoading] = useState(false)
  async function handleGoogle() {
    setGoogleLoading(true); setError(null)
    const { error: gErr } = await signInWithGoogle()
    // Succès : redirection navigateur vers Google → pas de setGoogleLoading(false).
    if (gErr) { setError(t.googleError); setGoogleLoading(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setNotConfirmed(false)
    setLoading(true)
    try {
      const { error: signInError } = await signInWithEmail(email, password)
      if (signInError) {
        // Le service d'authentification refuse un compte banni avec le code
        // « user_banned » (audit CPT-17 : avant, ce texte n'était jamais affiché).
        if (signInError.code === 'user_banned' || /banned/i.test(signInError.message ?? '')) setError(t.errorBanned)
        else if (signInError.message?.toLowerCase().includes('confirm')) { setError(t.errorNotConfirmed); setNotConfirmed(true) }
        else setError(t.errorGeneric)
      } else {
        // Mémorise ou efface l'e-mail (jamais le password — confort uniquement).
        try {
          if (rememberMe) localStorage.setItem(REMEMBER_KEY, email.trim())
          else            localStorage.removeItem(REMEMBER_KEY)
        } catch { /* private mode */ }
        // Succès : RedirectIfAuthGuard détecte user → redirect.
      }
    } catch {
      setError(t.errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotSubmit(e) {
    e.preventDefault()
    setForgotStatus('loading')
    try {
      const { error: resetError } = await resetPassword(forgotEmail)
      setForgotStatus(resetError ? 'error' : 'success')
    } catch {
      setForgotStatus('error')
    }
  }

  const inputBg     = darkMode ? '#141F2E' : '#F5EDE0'
  const inputBorder = darkMode ? '#2A3A50' : 'var(--color-border-warm)'
  const textColor   = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor  = darkMode ? '#7A90A8' : '#6A4F45'

  const inputStyle = {
    width: '100%', padding: '12px 12px 12px 38px', borderRadius: '10px',
    border: `1.5px solid ${inputBorder}`, background: inputBg,
    color: textColor, fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  // ─── Vue forgot password ──────────────────────────────────────────
  if (view === 'forgot') {
    return (
      <AuthLayout
        lang={lang}
        darkMode={darkMode}
        title={t.forgotTitle}
        footer={
          <button
            type="button"
            onClick={() => { setView('login'); setForgotStatus('idle'); setForgotEmail('') }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-warm-600)', fontWeight: 700, fontSize: '13px',
              fontFamily: 'inherit',
            }}
          >
            <LuArrowLeft size={14} /> {t.backToLogin}
          </button>
        }
      >
        <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: mutedColor, margin: 0, lineHeight: 1.55 }}>
            {t.forgotIntro}
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.emailLabel}</span>
            <div style={{ position: 'relative' }}>
              <LuMail
                aria-hidden="true" size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: mutedColor }}
              />
              <input
                type="email" required autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                style={inputStyle}
              />
            </div>
          </label>
          {forgotStatus === 'success' && (
            <p role="status" aria-live="polite" style={{
              margin: 0, padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(34,197,94,0.12)', color: '#16A34A',
              fontSize: '13px', fontWeight: 600,
            }}>
              {t.forgotSent}
            </p>
          )}
          {forgotStatus === 'error' && (
            <p role="alert" style={{
              margin: 0, padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(220,38,38,0.10)', color: '#DC2626',
              fontSize: '13px', fontWeight: 600,
            }}>
              {t.forgotError}
            </p>
          )}
          <Button
            type="submit"
            loading={forgotStatus === 'loading'}
            disabled={forgotStatus === 'loading' || forgotStatus === 'success'}
            className="w-full"
          >
            {t.forgotSubmit}
          </Button>
        </form>
      </AuthLayout>
    )
  }

  // ─── Vue login (par défaut) ───────────────────────────────────────
  const footer = (
    <span>
      {t.noAccount}{' '}
      <Link to="/signup" style={{ color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'none' }}>
        {t.signupLink}
      </Link>
    </span>
  )

  return (
    <AuthLayout lang={lang} darkMode={darkMode} title={t.pageTitle} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <GoogleButton label={t.continueWithGoogle} loading={googleLoading} onClick={handleGoogle} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border-warm)' }} />
          <span style={{ fontSize: '12px', color: mutedColor }}>{t.orSeparator}</span>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border-warm)' }} />
        </div>
        {/* E-mail */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.emailLabel}</span>
          <div style={{ position: 'relative' }}>
            <LuMail
              aria-hidden="true" size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: mutedColor }}
            />
            <input
              type="email" required autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              style={inputStyle}
            />
          </div>
        </label>

        {/* Mot de passe */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.pwdLabel}</span>
          <div style={{ position: 'relative' }}>
            <LuLock
              aria-hidden="true" size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: mutedColor }}
            />
            <input
              type={showPwd ? 'text' : 'password'}
              required autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </label>

        {/* Remember me + forgot link */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: textColor, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            {t.rememberMe}
          </label>
          <button
            type="button"
            onClick={() => { setView('forgot'); setError(null); setForgotEmail(email) }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-warm-600)', fontSize: '12px', fontWeight: 700,
              padding: 0, fontFamily: 'inherit',
            }}
          >
            {t.forgotLink}
          </button>
        </div>

        {error && (
          <p role="alert" style={{
            margin: 0, padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(220,38,38,0.10)', color: '#DC2626',
            fontSize: '13px', fontWeight: 600,
          }}>
            {error}
          </p>
        )}
        {notConfirmed && <ResendConfirmation email={email} lang={lang} />}

        <Button type="submit" loading={loading} disabled={loading} className="w-full">
          {loading ? t.loadingLabel : t.submitBtn}
        </Button>
      </form>
    </AuthLayout>
  )
}
