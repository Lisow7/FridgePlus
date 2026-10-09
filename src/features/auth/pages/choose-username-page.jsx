// Écran affiché au 1er login OAuth (gate App.jsx via needsUsername).
// Pré-rempli avec une suggestion (prénom Google → Chef-xxxx), vérif unicité
// live (ilike, comme signup) + profanité (leo-profanity), puis confirme.
//
// A4-OAuth (2026-06-22) : point d'étranglement universel pour tout nouveau
// compte OAuth (quelle que soit l'entrée login/signup). On y collecte le
// clickwrap CGU + Politique de confidentialité + âge 16+ — sans quoi un
// utilisateur créé via « Continuer avec Google » depuis la page de connexion
// n'accepterait jamais les CGU ni ne confirmerait son âge.
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import leoProfanity from 'leo-profanity'
import { useAuth } from '@shared/contexts/auth-provider'
import { supabase } from '@shared/lib/supabase/client'
import { suggestUsername } from '@features/auth/lib/username-suggestion'
import Button from '@shared/ui/button'
import AuthLayout from '@features/auth/components/auth-layout'

const I18N = {
  fr: {
    title: 'Choisis ton pseudo',
    intro: 'Ton pseudo est public dans la communauté. Tu pourras le changer plus tard.',
    label: 'Pseudo', submit: 'Continuer',
    taken: 'Ce pseudo est déjà pris.',
    tooShort: 'Le pseudo doit faire 3 à 20 caractères.',
    profane: 'Ce pseudo contient des termes non autorisés.',
    error: 'Impossible d\'enregistrer. Réessaie.',
    acceptPrefix: 'J\'ai au moins 16 ans et j\'accepte les ',
    acceptTerms: 'Conditions Générales d\'Utilisation',
    acceptMiddle: ' et la ',
    acceptPrivacy: 'Politique de confidentialité',
    acceptSuffix: '.',
    errorAccept: 'Pour continuer, confirme ton âge (16 ans minimum) et accepte les CGU et la Politique de confidentialité.',
  },
  en: {
    title: 'Choose your username',
    intro: 'Your username is public in the community. You can change it later.',
    label: 'Username', submit: 'Continue',
    taken: 'This username is already taken.',
    tooShort: 'Username must be 3 to 20 characters.',
    profane: 'This username contains forbidden words.',
    error: 'Could not save. Try again.',
    acceptPrefix: 'I am at least 16 years old and I accept the ',
    acceptTerms: 'Terms of Service',
    acceptMiddle: ' and the ',
    acceptPrivacy: 'Privacy Policy',
    acceptSuffix: '.',
    errorAccept: 'To continue, confirm your age (16+) and accept the Terms of Service and Privacy Policy.',
  },
  es: {
    title: 'Elige tu nombre de usuario',
    intro: 'Tu nombre de usuario es público en la comunidad. Podrás cambiarlo más tarde.',
    label: 'Nombre de usuario', submit: 'Continuar',
    taken: 'Este nombre de usuario ya está en uso.',
    tooShort: 'El nombre de usuario debe tener entre 3 y 20 caracteres.',
    profane: 'Este nombre de usuario contiene términos no permitidos.',
    error: 'No se pudo guardar. Inténtalo de nuevo.',
    acceptPrefix: 'Tengo al menos 16 años y acepto las ',
    acceptTerms: 'Condiciones Generales de Uso',
    acceptMiddle: ' y la ',
    acceptPrivacy: 'Política de privacidad',
    acceptSuffix: '.',
    errorAccept: 'Para continuar, confirma tu edad (mínimo 16 años) y acepta las Condiciones Generales de Uso y la Política de privacidad.',
  },
  de: {
    title: 'Wähle deinen Benutzernamen',
    intro: 'Dein Benutzername ist in der Community öffentlich. Du kannst ihn später ändern.',
    label: 'Benutzername', submit: 'Weiter',
    taken: 'Dieser Benutzername ist bereits vergeben.',
    tooShort: 'Der Benutzername muss 3 bis 20 Zeichen lang sein.',
    profane: 'Dieser Benutzername enthält unzulässige Begriffe.',
    error: 'Speichern fehlgeschlagen. Bitte versuche es erneut.',
    acceptPrefix: 'Ich bin mindestens 16 Jahre alt und akzeptiere die ',
    acceptTerms: 'Allgemeinen Nutzungsbedingungen',
    acceptMiddle: ' und die ',
    acceptPrivacy: 'Datenschutzrichtlinie',
    acceptSuffix: '.',
    errorAccept: 'Um fortzufahren, bestätige dein Alter (mindestens 16 Jahre) und akzeptiere die Allgemeinen Nutzungsbedingungen und die Datenschutzrichtlinie.',
  },
  ja: {
    title: 'ユーザー名を選択',
    intro: 'ユーザー名はコミュニティで公開されます。後で変更できます。',
    label: 'ユーザー名', submit: '続ける',
    taken: 'このユーザー名はすでに使われています。',
    tooShort: 'ユーザー名は3〜20文字で入力してください。',
    profane: 'このユーザー名には使用できない語句が含まれています。',
    error: '保存できませんでした。もう一度お試しください。',
    acceptPrefix: '私は16歳以上であり、',
    acceptTerms: '利用規約',
    acceptMiddle: 'および',
    acceptPrivacy: 'プライバシーポリシー',
    acceptSuffix: 'に同意します。',
    errorAccept: '続けるには、年齢（16歳以上）を確認し、利用規約とプライバシーポリシーに同意してください。',
  },
}

export default function ChooseUsernamePage({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const { user, profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [value, setValue] = useState(() => suggestUsername(user?.user_metadata ?? {}, user?.id ?? ''))
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!accepted) { setError(t.errorAccept); return }
    const u = value.trim()
    if (u.length < 3 || u.length > 20) { setError(t.tooShort); return }
    if (leoProfanity.check(u)) { setError(t.profane); return }
    setLoading(true)
    try {
      const { data: taken } = await supabase.from('profiles').select('id').ilike('username', u).maybeSingle()
      if (taken && taken.id !== user?.id) { setError(t.taken); setLoading(false); return }
      const { error: upErr } = await updateProfile({ username: u, username_confirmed: true })
      if (upErr) { setError(t.error); setLoading(false); return }
      navigate('/')
    } catch {
      setError(t.error); setLoading(false)
    }
  }

  // Anti-flash : on attend le profil (le gate App.jsx ne rend cet écran que
  // profil chargé, mais ceinture + bretelles si rendu directement).
  if (!profile) return null

  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'

  return (
    <AuthLayout lang={lang} darkMode={darkMode} title={t.title}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ fontSize: '13px', color: mutedColor, margin: 0, lineHeight: 1.55 }}>{t.intro}</p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{t.label}</span>
          <input
            type="text" required minLength={3} maxLength={20} value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              border: '1.5px solid var(--color-border-warm)', fontFamily: 'inherit', fontSize: '14px',
            }}
          />
        </label>

        {/* A4-OAuth — acceptation explicite CGU + Politique de confidentialité + âge 16+ (clickwrap). */}
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
            <Link to="/legal#privacy" target="_blank" rel="noopener" style={{ color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'underline' }}>{t.acceptPrivacy}</Link>
            {t.acceptSuffix}
          </span>
        </label>

        {error && (
          <p role="alert" style={{
            margin: 0, padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(220,38,38,0.10)', color: '#DC2626', fontSize: '13px', fontWeight: 600,
          }}>{error}</p>
        )}
        <Button type="submit" loading={loading} disabled={loading} className="w-full">{t.submit}</Button>
      </form>
    </AuthLayout>
  )
}
