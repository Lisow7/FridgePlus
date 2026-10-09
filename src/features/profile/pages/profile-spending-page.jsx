import { useOutletContext } from 'react-router-dom'
import { LuWallet } from 'react-icons/lu'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useUpgradeModal } from '@shared/contexts/subscription-modal-provider'
import { UpgradeGate } from '@shared/ui/upgrade-gate'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import ProfilePageIntro from '@features/profile/components/profile-page-intro'
import ProfileSection  from '@features/profile/components/profile-section'
import SpendingDashboard   from '@features/profile/components/spending-dashboard'

// PR-E v3.412 — sous-page /profile/depenses dédiée Premium.
//
// Auparavant : SpendingDashboard rendu en bas de /profile/activite.
// Maintenant : page dédiée avec son propre onglet sidebar Premium-gated.
// Permet de développer l'analytics sans noyer la page Activité.
//
// Section unique :
//   - Si Premium : SpendingDashboard self-contained (titre + desc + chart
//     12 mois + recommandations dynamiques + futures analytics étendues)
//   - Si Free    : UpgradeGate hard (paywall + CTA upgrade)
//
// Pas de duplication avec Activité (la section a été retirée là-bas).

const I18N = {
  fr: {
    pageTitle: 'Mes dépenses',
    pageIntro: 'Suivi mensuel de tes courses avec recommandations personnalisées. Capture à chaque clic « J\'ai fait mes courses ».',
    sectionTitle: 'Analyse Premium',
    sectionDesc:  'Tes dépenses courses sur 12 mois, avec recos pour optimiser ton budget.',
  },
  en: {
    pageTitle: 'My spending',
    pageIntro: 'Monthly tracking of your shopping with personalized recommendations. Captured on every « I\'m done shopping » tap.',
    sectionTitle: 'Premium analysis',
    sectionDesc:  'Your shopping spending over 12 months, with recommendations to optimize your budget.',
  },
}

export default function ProfileSpendingPage() {
  const { lang = 'fr', darkMode = false, user } = useOutletContext()
  const t = I18N[lang] ?? I18N.fr
  const { hasPremiumAccess } = useSubscription()
  const { openUpgradeModal } = useUpgradeModal()
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640

  return (
    <>
      <ProfilePageIntro title={t.pageTitle} description={t.pageIntro} darkMode={darkMode} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {hasPremiumAccess ? (
          <SpendingDashboard
            userId={user?.id}
            hasPremiumAccess={hasPremiumAccess}
            onUpgrade={openUpgradeModal}
            lang={lang}
            darkMode={darkMode}
            isMobile={isMobile}
          />
        ) : (
          <ProfileSection
            Icon={LuWallet}
            title={t.sectionTitle}
            description={t.sectionDesc}
            badge="premium"
            lang={lang}
            darkMode={darkMode}
          >
            <UpgradeGate
              feature="spending"
              variant="hard"
              lang={lang}
              darkMode={darkMode}
              onUpgradeClick={openUpgradeModal}
            />
          </ProfileSection>
        )}
      </div>
    </>
  )
}
