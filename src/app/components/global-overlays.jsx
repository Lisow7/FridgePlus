import { Suspense, lazy, useEffect } from 'react'
import { welcomeAudience, markWelcomeSeen } from '@features/onboarding/lib/welcome-storage'
import CookieBanner from '@features/legal/components/cookie-banner'
import { useConsent } from '@shared/hooks/use-consent'

const UpdatePrompt = lazy(() => import('@features/pwa/components/update-prompt'))
const UpgradeModal = lazy(() => import('@features/premium/components/upgrade-modal'))
// L'écran de bienvenue ne sert qu'au premier passage : chargé à la demande, il
// n'entraîne plus la visite guidée et ses textes dans le démarrage (2026-10-08).
const WelcomeScreen = lazy(() => import('@features/onboarding/components/welcome-screen'))
// « Confirme ton accord » (décision du 2026-10-07) : seuls les comptes d'avant le 4 octobre
// en ont besoin — chargée à la demande.
const AccordDesAnciensComptes = lazy(() => import('@features/auth/components/accord-des-anciens-comptes'))

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
  profile,
  authLoading,
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

  // Un compte ancien n'est pas un nouveau venu, même dans un navigateur neuf :
  // pas d'écran de bienvenue, et on le note « vu » pour que le reste de
  // l'accueil (guide, fusée) cesse de le traiter en premier venu. Tant qu'on ne
  // sait pas qui est là, on attend. Cf. `welcomeAudience`.
  const audience = welcomeAudience({ authLoading, user, profile })
  // Le profil dit EXPLICITEMENT qu'il n'a pas de date d'accord (champ lu, vide) :
  // un profil partiel, sans le champ, ne déclenche rien.
  const accordManquant = !!user && profile?.consent_terms_accepted_at === null
  useEffect(() => {
    if (welcomeOpen && audience === 'skip') {
      markWelcomeSeen()
      onWelcomeClose?.()
    }
  }, [welcomeOpen, audience, onWelcomeClose])

  return (
    <>
      <Suspense fallback={null}>
        <UpdatePrompt lang={lang} darkMode={darkMode} />
      </Suspense>
      <CookieBanner lang={lang} darkMode={darkMode} />

      {welcomeOpen && hasDecided && audience === 'show' && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Après les cookies, comme la bienvenue : le bandeau la recouvrirait. */}
      {accordManquant && hasDecided && (
        <Suspense fallback={null}>
          <AccordDesAnciensComptes lang={lang} />
        </Suspense>
      )}

      {/* Montée seulement ouverte : fermée, elle faisait télécharger son
          fichier ET Stripe à chaque visite (audit du 2026-10-04, PERF-07). */}
      {isUpgradeOpen && (
        <Suspense fallback={null}>
          <UpgradeModal
            isOpen
            onClose={onUpgradeClose}
            lang={lang}
            darkMode={darkMode}
          />
        </Suspense>
      )}
    </>
  )
}
