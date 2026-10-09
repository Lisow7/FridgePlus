import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LuMail, LuLock, LuUser, LuEye, LuEyeOff } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { containsProfanity } from '@shared/lib/moderation'
import { supabase } from '@shared/lib/supabase/client'
import {
  validatePassword, PWD_SCORE_MAX, PWD_COLORS, PWD_STRENGTH_LABELS, PWD_HINT, PWD_ERROR_WEAK,
} from '@shared/lib/auth/password-policy'
import Button from '@shared/ui/button'
import GoogleButton from '@shared/ui/google-button'
import AuthLayout from '@features/auth/components/auth-layout'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { titreDeRoute } from '@routes/route-title'

// SignupPage — création de compte Fridge+.
// Sprint 11 S11.b.3.
//
// 3 champs : pseudo, e-mail, mot de passe (avec strength meter).
// Validations : pseudo 3-20 chars + profanity check + unicité BDD,
// password policy partagée avec Supabase Auth (cf. password-policy.js).
// Après succès : message « vérifie ta boîte de réception » (si confirm
// email est activé côté Supabase Auth ; sinon login auto).
//
// Gated par RedirectIfAuthGuard : si user déjà loggé → redirect /.

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

const I18N = {
  fr: {
    pageTitle: 'Créer un compte',
    intro: 'Rejoins la communauté Fridge+ et cuisine mieux, sans limites.',
    usernameLabel: 'Pseudo',
    usernamePlaceholder: 'Foodie_42',
    usernameHint: '3-20 caractères. Lettres, chiffres, _ et - uniquement.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'ton.email@exemple.com',
    pwdLabel: 'Mot de passe',
    pwdPlaceholder: '••••••••',
    pwdHint: PWD_HINT.fr,
    pwdReveal: 'Afficher le mot de passe',
    pwdHide: 'Masquer le mot de passe',
    pwdStrength: PWD_STRENGTH_LABELS.fr,
    submitBtn: 'Créer mon compte',
    loadingLabel: 'Création…',
    verifyEmail: '✓ Compte créé ! Vérifie ta boîte de réception pour confirmer ton e-mail.',
    errorUsernameInvalid: 'Pseudo invalide (3-20 caractères, lettres / chiffres / _ / -).',
    errorUsernameProfanity: 'Ce pseudo n\'est pas autorisé.',
    errorUsernameTaken: 'Ce pseudo est déjà pris.',
    errorWeak: PWD_ERROR_WEAK.fr,
    errorEmailInUse: 'Cette adresse e-mail est déjà utilisée.',
    errorGeneric: 'Une erreur est survenue. Réessaie plus tard.',
    haveAccount: 'Déjà un compte ?',
    loginLink: 'Se connecter',
    continueWithGoogle: 'Continuer avec Google',
    orSeparator: 'ou',
    googleError: 'Connexion Google impossible. Réessaie.',
    acceptPrefix: 'J\'ai au moins 16 ans et j\'accepte les ',
    acceptTerms: 'Conditions Générales d\'Utilisation',
    acceptMiddle: ' et la ',
    acceptPrivacy: 'Politique de confidentialité',
    errorAccept: 'Pour créer un compte, confirme ton âge (16 ans minimum) et accepte les CGU et la Politique de confidentialité.',
  },
  en: {
    pageTitle: 'Create an account',
    intro: 'Join the Fridge+ community and cook better, no limits.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Foodie_42',
    usernameHint: '3-20 characters. Letters, digits, _ and - only.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'your.email@example.com',
    pwdLabel: 'Password',
    pwdPlaceholder: '••••••••',
    pwdHint: PWD_HINT.en,
    pwdReveal: 'Show password',
    pwdHide: 'Hide password',
    pwdStrength: PWD_STRENGTH_LABELS.en,
    submitBtn: 'Create my account',
    loadingLabel: 'Creating…',
    verifyEmail: '✓ Account created! Check your inbox to confirm your e-mail.',
    errorUsernameInvalid: 'Invalid username (3-20 chars, letters / digits / _ / -).',
    errorUsernameProfanity: 'This username is not allowed.',
    errorUsernameTaken: 'This username is already taken.',
    errorWeak: PWD_ERROR_WEAK.en,
    errorEmailInUse: 'This e-mail address is already in use.',
    errorGeneric: 'An error occurred. Try again later.',
    haveAccount: 'Already have an account?',
    loginLink: 'Sign in',
    continueWithGoogle: 'Continue with Google',
    orSeparator: 'or',
    googleError: 'Google sign-in failed. Try again.',
    acceptPrefix: 'I am at least 16 years old and I accept the ',
    acceptTerms: 'Terms of Service',
    acceptMiddle: ' and the ',
    acceptPrivacy: 'Privacy Policy',
    errorAccept: 'To create an account, confirm your age (16+) and accept the Terms of Service and Privacy Policy.',
  },
}

export default function SignupPage({ lang = 'fr', darkMode = false }) {
  useDocumentTitle(titreDeRoute('/signup', lang))
  const t = I18N[lang] ?? I18N.fr
  const { signUpWithEmail, signInWithGoogle } = useAuth()

  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  async function handleGoogle() {
    if (!accepted) { setError(t.errorAccept); return }
    setGoogleLoading(true); setError(null)
    const { error: gErr } = await signInWithGoogle()
    // Succès : redirection navigateur vers Google → pas de setGoogleLoading(false).
    if (gErr) { setError(t.googleError); setGoogleLoading(false) }
  }

  const pwdVal = password ? validatePassword(password) : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // ── Validations client ────────────────────────────────────────────
    if (!accepted) { setError(t.errorAccept); return }
    const u = username.trim()
    if (!USERNAME_REGEX.test(u)) { setError(t.errorUsernameInvalid); return }
    if (containsProfanity(u))   { setError(t.errorUsernameProfanity); return }
    const { score } = validatePassword(password)
    if (score < PWD_SCORE_MAX)   { setError(t.errorWeak); return }

    setLoading(true)
    try {
      // ── Check unicité pseudo BDD (case-insensitive) ────────────────
      const { data: taken } = await supabase
        .from('profiles')
        .select('id').ilike('username', u).maybeSingle()
      if (taken) { setError(t.errorUsernameTaken); setLoading(false); return }

      // ── Signup Supabase Auth ───────────────────────────────────────
      const { error: signUpError } = await signUpWithEmail(email, password, u, lang)
      if (signUpError) {
        // v3.416 — détecter le 422 weak_password Supabase au cas où la
        // validation client serait contournée (script, edit DOM…) pour
        // afficher un message clair plutôt que generic.
        const msg = signUpError.message?.toLowerCase() ?? ''
        if (msg.includes('already'))      setError(t.errorEmailInUse)
        else if (msg.includes('weak'))    setError(t.errorWeak)
        else                              setError(t.errorGeneric)
      } else {
        // Si Supabase « Confirm email » activé → user reçoit un e-mail.
        // Sinon → connecté automatiquement et RedirectIfAuthGuard redirect.
        setSuccess(t.verifyEmail)
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

  const footer = (
    <span>
      {t.haveAccount}{' '}
      <Link to="/login" style={{ color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'none' }}>
        {t.loginLink}
      </Link>
    </span>
  )

  return (
    <AuthLayout lang={lang} darkMode={darkMode} title={t.pageTitle} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <GoogleButton label={t.continueWithGoogle} loading={googleLoading} onClick={handleGoogle} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border-warm)' }} />
          <span style={{ fontSize: '12px', color: mutedColor }}>{t.orSeparator}</span>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border-warm)' }} />
        </div>
        <p style={{ fontSize: '13px', color: mutedColor, margin: 0, lineHeight: 1.55 }}>
          {t.intro}
        </p>

        {/* Pseudo */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.usernameLabel}</span>
          <div style={{ position: 'relative' }}>
            <LuUser aria-hidden="true" size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: mutedColor }}
            />
            <input
              type="text" required autoComplete="username"
              minLength={3} maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t.usernamePlaceholder}
              style={inputStyle}
            />
          </div>
          <span style={{ fontSize: '11px', color: mutedColor }}>{t.usernameHint}</span>
        </label>

        {/* E-mail */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.emailLabel}</span>
          <div style={{ position: 'relative' }}>
            <LuMail aria-hidden="true" size={16}
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

        {/* Mot de passe + strength meter */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>{t.pwdLabel}</span>
          <div style={{ position: 'relative' }}>
            <LuLock aria-hidden="true" size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: mutedColor }}
            />
            <input
              type={showPwd ? 'text' : 'password'}
              required autoComplete="new-password"
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

          {/* Strength meter : 5 segments colorés selon score 0-5
              (5 critères : longueur + min + MAJ + chiffre + spécial). */}
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

        {/* A4 — Acceptation explicite CGU + Politique de confidentialité + âge 16+
            (clickwrap). Requise pour les deux parcours (e-mail ET Google). */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: mutedColor, lineHeight: 1.5, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: '2px', flexShrink: 0, accentColor: 'var(--color-warm-600)', width: 15, height: 15, cursor: 'pointer' }}
          />
          <span>
            {t.acceptPrefix}
            <Link to="/legal#terms" target="_blank" rel="noopener" style={{ color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'underline' }}>{t.acceptTerms}</Link>
            {t.acceptMiddle}
            <Link to="/legal#privacy" target="_blank" rel="noopener" style={{ color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'underline' }}>{t.acceptPrivacy}</Link>.
          </span>
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
            {success}
          </p>
        )}

        <Button type="submit" loading={loading} disabled={loading || !!success} className="w-full">
          {loading ? t.loadingLabel : t.submitBtn}
        </Button>
      </form>
    </AuthLayout>
  )
}
