import { useAuth } from '@shared/contexts/auth-provider'
import { useLang } from '@shared/contexts/ui-provider'
import { useEnLigne } from '@shared/hooks/use-en-ligne'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { CENTRE_EN_HAUT } from '@app/components/bandeau-du-haut'
import { Z_INDEX } from '@shared/lib/z-index'

// Quand le réseau tombe (décision du 2026-10-08) : un bandeau tant qu'il
// manque, qui part seul à son retour. Rien ne le disait — un compte ne
// l'apprenait qu'en touchant à son frigo (« Pas enregistré… »), un invité en
// voyant la voix et la photo du ticket ne plus marcher. Textes de la maquette.
const I18N = {
  fr: {
    titre: 'Pas de réseau.',
    compte: 'Ce que tu changes ne sera pas enregistré tant qu’il n’est pas revenu.',
    invite: 'La voix et la photo du ticket attendront son retour.',
    // Le drapeau de la photo du ticket éteint (décision du 2026-10-08) : on ne la promet plus.
    inviteSansPhoto: 'La voix attendra son retour.',
  },
  en: {
    titre: 'No network.',
    compte: 'What you change won’t be saved until it’s back.',
    invite: 'Voice and the receipt photo will wait until it’s back.',
    inviteSansPhoto: 'Voice will wait until it’s back.',
  },
}

export default function BandeauHorsLigne() {
  const enLigne = useEnLigne()
  const { user } = useAuth()
  const { lang } = useLang()
  const photoDuTicket = useFeatureFlag('receipt_scan', false)
  if (enLigne) return null
  const t = I18N[lang] ?? I18N.fr

  return (
    <div role="status" style={{
      ...CENTRE_EN_HAUT,
      zIndex: Z_INDEX.TOAST,
      padding: '10px 16px', borderRadius: '12px',
      background: 'var(--color-dark-surface)', color: 'white',
      fontSize: '14px', lineHeight: 1.45,
      boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
      animation: 'menu-slide-down 0.25s ease both',
    }}>
      <strong>{t.titre}</strong> {user ? t.compte : photoDuTicket ? t.invite : t.inviteSansPhoto}
    </div>
  )
}
