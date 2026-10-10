import { lazy } from 'react'
import { lazyPrechargeable } from '@shared/lib/lazy-prechargeable'
import { LIBELLES_DES_ROUTES } from '@shared/static/libelles-des-routes'
import AuthGuard from '@routes/guards/auth-guard'
import RedirectIfAuthGuard from '@routes/guards/redirect-if-auth-guard'
import RecoveryGuard from '@routes/guards/recovery-guard'

// Routes-config — Sprint 11 refonte UX Profile (S11.a.2 → S11.a.5).
//
// 4 sous-routes FR sous /profile (slugs sans accents pour éviter
// problèmes encodage URL) + redirects backwards compat depuis les
// anciens slugs (account, security, data, spending, subscription)
// posés en S11.a.1.
//
// Format d'une entrée :
//   { path, Component, Guard?, children?, Redirect?, label? }
//
//   - path     : string react-router-dom
//   - Component: composant React rendu (props lang/darkMode injectées)
//   - Guard    : composant guard à appliquer (AuthGuard, RecoveryGuard…). Optionnel.
//   - children : sous-routes nested (rendues via <Outlet />)
//   - Redirect : si défini, rend <Navigate to={Redirect} replace />
//   - label    : libellé i18n pour navigation/breadcrumbs
//
// Defense in depth (rappel) : les guards client sont UX. La sécurité
// réelle vient des RLS Supabase + role check côté serveur.

// Les pages pré-rendues sont préchargeables : `main.jsx` charge celle de la
// route courante avant le premier rendu, pour qu'elle remplace le HTML servi
// sans squelette entre les deux (audit du 2026-10-04, PERF-05).
const LegalPage           = lazyPrechargeable(() => import('@features/legal/pages/legal-page'))
const ChangelogPage       = lazyPrechargeable(() => import('@features/changelog/pages/changelog-page'))
const NotFoundPage        = lazy(() => import('@app/pages/not-found-page'))
const ProfilePage         = lazy(() => import('@features/profile/pages/profile-page'))
const ProfileIdentityPage    = lazy(() => import('@features/profile/pages/profile-identity-page'))
const ProfilePreferencesPage = lazy(() => import('@features/profile/pages/profile-preferences-page'))
const ProfileActivityPage    = lazy(() => import('@features/profile/pages/profile-activity-page'))
const ProfileRewardsPage     = lazy(() => import('@features/profile/pages/profile-rewards-page'))
const ProfileAccountPage     = lazy(() => import('@features/profile/pages/profile-account-page'))
const ProfileSpendingPage    = lazy(() => import('@features/profile/pages/profile-spending-page'))

// Sprint 11 S11.b — pages d'auth.
const LoginPage              = lazy(() => import('@features/auth/pages/login-page'))
const SignupPage             = lazy(() => import('@features/auth/pages/signup-page'))
const RecoveryPage           = lazy(() => import('@features/auth/pages/recovery-page'))

// Sprint 11 S11.c.1 — page recette /recipe/:id (deep-linking).
// La page importe sa modale DIRECTEMENT (audit du 2026-10-04, PERF-02 et
// PERF-05) : elles partent ensemble, sans cascade entrée → page → données →
// modale (en production, la modale était demandée à 1,88 s) ni squelette
// entre le HTML pré-rendu et la fiche.
const RecipePage             = lazyPrechargeable(() => import('@features/recipes/pages/recipe-page'))

// Sprint 11 S11.d — page communauté /community (migration modale → route).
const CommunityPageRoute     = lazyPrechargeable(() => import('@features/community/pages/community-page-route'))

// Chantier A — page panier dédiée /cart (Premium-gated).
const CartPage               = lazy(() => import('@features/cart/pages/cart-page'))

// Chantier D — mode cuisine vocal /cook/:recipeId (Premium-gated).
const CookingModePage        = lazy(() => import('@features/cooking-mode/components/cooking-mode-page'))

// Pages de contenu public — sorties des modales pour être indexables.
const FaqPage                = lazyPrechargeable(() => import('@features/legal/pages/faq-page'))
const GuidePage              = lazyPrechargeable(() => import('@features/onboarding/pages/guide-page'))
const AccountDeletionPage    = lazyPrechargeable(() => import('@features/legal/pages/account-deletion-page'))

export const ROUTES = [
  {
    path: '/legal',
    Component: LegalPage,
    label: LIBELLES_DES_ROUTES['/legal'],
  },
  {
    path: '/changelog',
    Component: ChangelogPage,
    label: LIBELLES_DES_ROUTES['/changelog'],
  },
  // ── Pages de contenu public : FAQ et guide d'utilisation.
  //
  // ⚠️ **Volontairement SANS `Guard`, et c'est la décision de sécurité.**
  // « Sécuriser » une page ne veut pas dire y mettre un mur d'authentification :
  // ces deux pages n'affichent AUCUNE donnée utilisateur — elles rendent du
  // texte statique embarqué dans le bundle. Un `AuthGuard` ici n'aurait rien à
  // protéger, et il rendrait les pages invisibles pour les moteurs de recherche
  // — soit exactement l'inverse du but poursuivi (être trouvé sur « fridge+ »).
  //
  // Ce qui les sécurise réellement, et qui s'applique déjà : la CSP et les
  // en-têtes de `vercel.json`, l'absence totale de requête réseau, et le fait
  // qu'aucune des deux ne lit `user`. La règle du projet reste vraie —
  // « defense in depth » : un guard client est de l'UX, pas de la sécurité.
  {
    path: '/faq',
    Component: FaqPage,
    label: LIBELLES_DES_ROUTES['/faq'],
  },
  {
    path: '/guide',
    Component: GuidePage,
    label: LIBELLES_DES_ROUTES['/guide'],
  },
  // ⚠️ Publique, et SANS `Guard` — c'est la propriété qui compte, pas un oubli.
  // Google exige une URL de suppression de compte accessible SANS connexion :
  // quelqu'un qui a désinstallé l'app, ou perdu l'accès à son compte, doit
  // pouvoir demander la suppression. Un mur d'authentification ici retirerait
  // exactement ce que la page existe pour offrir.
  // https://support.google.com/googleplay/android-developer/answer/13327111
  {
    path: '/suppression-compte',
    Component: AccountDeletionPage,
    label: LIBELLES_DES_ROUTES['/suppression-compte'],
  },
  {
    path: '/profile',
    Component: ProfilePage,
    Guard: AuthGuard,
    label: LIBELLES_DES_ROUTES['/profile'],
    children: [
      // Index : /profile → /profile/identite
      { path: '',         Redirect: '/profile/identite' },
      { path: 'identite',    Component: ProfileIdentityPage,    label: LIBELLES_DES_ROUTES['/profile/identite'] },
      { path: 'preferences', Component: ProfilePreferencesPage, label: LIBELLES_DES_ROUTES['/profile/preferences'] },
      { path: 'activite',    Component: ProfileActivityPage,    label: LIBELLES_DES_ROUTES['/profile/activite'] },
      { path: 'recompenses', Component: ProfileRewardsPage,     label: LIBELLES_DES_ROUTES['/profile/recompenses'] },
      { path: 'depenses',    Component: ProfileSpendingPage,    label: LIBELLES_DES_ROUTES['/profile/depenses'] },
      { path: 'compte',      Component: ProfileAccountPage,     label: LIBELLES_DES_ROUTES['/profile/compte'] },

      // v3.412 — alias EN backwards compat
      { path: 'spending',    Redirect: '/profile/depenses' },

      // ── Redirects backwards compat depuis les anciens slugs (S11.a.1) ──
      // /profile/account → /profile/identite est cohérent (le placeholder
      // S11.a.1 affichait l'avatar + pseudo, ce qui correspond maintenant
      // à l'onglet identité). Les autres redirects pointent vers l'onglet
      // qui contient le contenu attendu après la refonte.
      { path: 'account',      Redirect: '/profile/identite' },
      { path: 'security',     Redirect: '/profile/compte' },
      { path: 'data',         Redirect: '/profile/compte' },
      { path: 'spending',     Redirect: '/profile/activite' },
      { path: 'subscription', Redirect: '/profile/compte' },
    ],
  },
  // ── Sprint 11 S11.b — pages d'auth (RedirectIfAuthGuard : redirect
  //    / si user déjà loggé). Recovery (RecoveryGuard) en S11.b.4.
  {
    path: '/login',
    Component: LoginPage,
    Guard: RedirectIfAuthGuard,
    label: LIBELLES_DES_ROUTES['/login'],
  },
  {
    path: '/signup',
    Component: SignupPage,
    Guard: RedirectIfAuthGuard,
    label: LIBELLES_DES_ROUTES['/signup'],
  },
  {
    // Page atteinte via le lien email de reset password (Supabase émet
    // PASSWORD_RECOVERY event → auth-provider.jsx active recoveryMode
    // → App.jsx navigate('/auth/recovery')). RecoveryGuard exige
    // recoveryMode true, sinon redirect /.
    path: '/auth/recovery',
    Component: RecoveryPage,
    Guard: RecoveryGuard,
    label: LIBELLES_DES_ROUTES['/auth/recovery'],
  },
  // ── Sprint 11 S11.d — page Communauté. PAS de Guard : le feed est
  //    accessible aux invités (lecture seule). Les actions (poster,
  //    liker, commenter) sont gated à l'intérieur via user?.id checks
  //    + RLS Supabase côté serveur.
  {
    path: '/community',
    Component: CommunityPageRoute,
    label: LIBELLES_DES_ROUTES['/community'],
  },
  // ── Sprint 11 S11.c.1 — page recette (deep-linking). PAS de Guard :
  //    les recettes publiques doivent fonctionner pour les invités
  //    (URLs partageables). La sécurité d'accès aux recettes privées
  //    est enforcée au niveau data (RLS Supabase + useRecipeById qui
  //    retourne 'not-found' sans distinguer inexistante vs privée
  //    → évite le leak RGPD).
  {
    path: '/recipe/:id',
    Component: RecipePage,
    label: LIBELLES_DES_ROUTES['/recipe/:id'],
  },
  // Chantier A — page panier /cart.
  // AuthGuard : unauthenticated → /login.
  // hasPremiumAccess vérifié inline dans CartPage (UpgradeGate si non premium).
  {
    path: '/cart',
    Component: CartPage,
    Guard: AuthGuard,
    label: LIBELLES_DES_ROUTES['/cart'],
  },
  // Chantier D — mode cuisine vocal /cook/:recipeId.
  // AuthGuard : unauthenticated → /login.
  // hasPremiumAccess vérifié inline dans CookingModePage (UpgradeGate si non premium).
  {
    path: '/cook/:recipeId',
    Component: CookingModePage,
    Guard: AuthGuard,
    label: LIBELLES_DES_ROUTES['/cook/:recipeId'],
  },
  {
    path: '*',
    Component: NotFoundPage,
    label: LIBELLES_DES_ROUTES['*'],
  },
]
