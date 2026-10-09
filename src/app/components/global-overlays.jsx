import { Suspense, lazy } from 'react'
import { WelcomeScreen } from '@features/onboarding'
import CookieBanner from '@features/legal/components/cookie-banner'
import { useConsent } from '@shared/hooks/use-consent'

const UpdatePrompt = lazy(() => import('@features/pwa/components/update-prompt'))
const UpgradeModal = lazy(() => import('@features/premium/components/upgrade-modal'))

// Composant orchestrant les 4 surfaces globales rendues en
// permanence ou conditionnellement par l'app shell, indépendamment
// des features (panier, frigo, etc.) :
//   1. UpdatePrompt  — bannière nouvelle version PWA
//   2. CookieBanner  — bannière consentement RGPD
//   3. WelcomeScreen — tour d'onboarding (premier login)
//   4. UpgradeModal  — modale abonnement Premium
//
// Sprint 10 S10.a.19 — extrait depuis App.jsx. Ces 4 surfaces étaient
// éparpillées dans le JSX racine et n'avaient pas de domaine clair.
// Les regrouper rend explicite qu'elles vivent au sommet de l'arbre
// React, hors de la routing-tree feature-based.

export default function GlobalOverlays({
  // Welcome
  welcomeOpen,
  onWelcomeClose,
  onSignUp,
  onShowCommunity,
  user,
  isPremium,
  // Upgrade
  isUpgradeOpen,
  onUpgradeClose,
  onShowUpgrade,
  // i18n / theme
  lang,
  darkMode,
}) {
  // 🔴 Le bandeau cookies est `fixed` en z-index 9998, l'écran de bienvenue en
  // 1100 : le bandeau passait DEVANT et interceptait les taps sur son bouton
  // principal. Mesuré en prod le 2026-08-27, le jour de l'ouverture aux
  // testeurs : 81 px masqués sur iPhone, 211 px en 360×640, bouton
  // INCLIQUABLE (hit-test négatif) — c'est-à-dire sur les mobiles d'où
  // arrivent les visiteurs du lien partagé. On séquence : consentement
  // d'abord (la porte légale de toute façon), bienvenue ensuite, dégagée.
  // Un visiteur qui a déjà décidé voit la bienvenue immédiatement, sans délai.
  const { hasDecided } = useConsent()

  return (
    <>
      <Suspense fallback={null}>
        <UpdatePrompt lang={lang} darkMode={darkMode} />
      </Suspense>
      <CookieBanner lang={lang} darkMode={darkMode} />

      {welcomeOpen && hasDecided && (
        <WelcomeScreen
          lang={lang}
          user={user}
          isPremium={isPremium}
          onClose={onWelcomeClose}
          onAction={{
            showRegister: () => { onSignUp?.() },
            showCommunity: () => { onShowCommunity?.() },
            showUpgrade: onShowUpgrade,
          }}
        />
      )}

      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={isUpgradeOpen}
          onClose={onUpgradeClose}
          lang={lang}
          darkMode={darkMode}
        />
      </Suspense>
    </>
  )
}
