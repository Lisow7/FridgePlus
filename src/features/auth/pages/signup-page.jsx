import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LuMail, LuLock, LuUser, LuEye, LuEyeOff } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { containsProfanity } from '@shared/lib/moderation'
import {
  isValidUsername, isUsernameAvailable, USERNAME_MESSAGES,
} from '@shared/lib/auth/username-rules'
import {
  validatePassword, PWD_SCORE_MAX, PWD_COLORS, PWD_STRENGTH_LABELS, PWD_HINT, PWD_ERROR_WEAK,
} from '@shared/lib/auth/password-policy'
import Button from '@shared/ui/button'
import GoogleButton from '@shared/ui/google-button'
import AuthLayout from '@features/auth/components/auth-layout'
import ResendConfirmation from '@features/auth/components/resend-confirmation'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { titreDeRoute } from '@routes/route-title'
import { SUPPORT_EMAIL } from '@shared/lib/contact'

// SignupPage — création de compte Fridge+.
// Sprint 11 S11.b.3.
//
// 3 champs : pseudo, e-mail, mot de passe (avec strength meter).
// Validations : règle du pseudo et « est-il libre ? » (username-rules.js,
// comme les deux autres écrans) + profanity check, password policy partagée
// avec Supabase Auth (cf. password-policy.js).
//
// Après l'envoi : le service répond la MÊME chose pour une adresse neuve et
// pour une adresse déjà inscrite (il ne dit pas qui a un compte). L'écran ne
// peut donc pas affirmer « Compte créé ! » — il l'a fait jusqu'au 2026-10-04,
// y compris à quelqu'un qui avait déjà un compte et ne recevait rien. Il dit
// quoi faire dans les deux cas, et propose de renvoyer l'e-mail.
//
// Gated par RedirectIfAuthGuard : si user déjà loggé → redirect /.

const I18N = {
  fr: {
    pageTitle: 'Créer un compte',
    intro: 'Rejoins la communauté Fridge+ et cuisine mieux, sans limites.',
    usernameLabel: 'Pseudo',
    usernamePlaceholder: 'Foodie_42',
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
    emailSent: '✓ Ouvre l\'e-mail qu\'on vient de t\'envoyer pour confirmer ton adresse.',
    emailSentHelp: 'Rien reçu au bout de quelques minutes ? Regarde dans les indésirables. Si tu as déjà un compte avec cette adresse, aucun e-mail ne part : ',
    emailSentLogin: 'connecte-toi',
    errorUsernameProfanity: 'Ce pseudo n\'est pas autorisé.',
    errorWeak: PWD_ERROR_WEAK.fr,
    errorEmailInUse: 'Cette adresse e-mail est déjà utilisée.',
    errorGeneric: 'Une erreur est survenue. Réessaie plus tard.',
    errorRefused: `Ce compte n’a pas pu être créé. Si ça recommence, écris à ${SUPPORT_EMAIL}.`,
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
    emailSent: '✓ Open the e-mail we just sent you to confirm your address.',
    emailSentHelp: 'Nothing after a few minutes? Check your spam folder. If you already have an account with this address, no e-mail is sent: ',
    emailSentLogin: 'sign in',
    errorUsernameProfanity: 'This username is not allowed.',
    errorWeak: PWD_ERROR_WEAK.en,
    errorEmailInUse: 'This e-mail address is already in use.',
    errorGeneric: 'An error occurred. Try again later.',
    errorRefused: `This account could not be created. If it happens again, write to ${SUPPORT_EMAIL}.`,
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
  const regles = USERNAME_MESSAGES[lang] ?? USERNAME_MESSAGES.fr
  const { signUpWithEmail, signInWithGoogle } = useAuth()

  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(false)
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
    setSuccess(false)

    // ── Validations client ────────────────────────────────────────────
    if (!accepted) { setError(t.errorAccept); return }
    const u = username.trim()
    if (!isValidUsername(u)) { setError(regles.invalid); return }
    if (containsProfanity(u))   { setError(t.errorUsernameProfanity); return }
    const { score } = validatePassword(password)
    if (score < PWD_SCORE_MAX)   { setError(t.errorWeak); return }

    setLoading(true)
    try {
      // ── Le pseudo est-il libre ? ───────────────────────────────────
      // `null` = on n'a pas pu le savoir : l'inscription part quand même,
      // et la base donnera un pseudo d'attente si celui-ci est pris.
      if (await isUsernameAvailable(u) === false) { setError(regles.taken); setLoading(false); return }

      // ── Signup Supabase Auth ───────────────────────────────────────
      // `accepted` est vrai ici (contrôlé plus haut) : la base date cette
      // acceptation, c'est la preuve demandée par le RGPD (art. 7).
      const { error: signUpError } = await signUpWithEmail(email, password, u, lang, { consentAccepted: accepted })
      if (signUpError) {
        // v3.416 — détecter le 422 weak_password Supabase au cas où la
        // validation client serait contournée (script, edit DOM…) pour
        // afficher un message clair plutôt que generic.
        const msg = signUpError.message?.toLowerCase() ?? ''
        if (msg.includes('already'))      setError(t.errorEmailInUse)
        else if (msg.includes('weak'))    setError(t.errorWeak)
        // Refus de la base (adresse effacée pendant un bannissement, ou autre
        // échec à l'écriture du compte) : le service ne dit que « Database
        // error saving new user ». « Réessaie plus tard » ferait réessayer
        // sans fin — le support, lui, saura dire.
        else if (msg.includes('database error')) setError(t.errorRefused)
        else                              setError(t.errorGeneric)
      } else {
        // Si Supabase « Confirm email » activé → user reçoit un e-mail.
        // Sinon → connecté automatiquement et RedirectIfAuthGuard redirect.
        setSuccess(true)
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
          <span style={{ fontSize: '11px', color: mutedColor }}>{regles.hint}</span>
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
              // Adresse corrigée après l'envoi : le formulaire redevient utilisable.
              onChange={(e) => { setEmail(e.target.value); setSuccess(false) }}
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
          <>
            <p role="status" aria-live="polite" style={{
              margin: 0, padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(34,197,94,0.12)', color: '#16A34A',
              fontSize: '13px', fontWeight: 600, lineHeight: 1.5,
            }}>
              {t.emailSent}{' '}
              <span style={{ fontWeight: 500, color: textColor }}>
                {t.emailSentHelp}
                <Link to="/login" style={{ color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'underline' }}>{t.emailSentLogin}</Link>.
              </span>
            </p>
            <ResendConfirmation email={email} lang={lang} startCoolingDown />
          </>
        )}

        <Button type="submit" loading={loading} disabled={loading || success} className="w-full">
          {loading ? t.loadingLabel : t.submitBtn}
        </Button>
      </form>
    </AuthLayout>
  )
}
