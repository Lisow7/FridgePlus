import { Suspense, lazy } from 'react'
import ErrorBoundary from '@app/error/error-boundary'

// AuthModal retiré Sprint 11 S11.b.5 — remplacé par les pages routées
// /login, /signup, /auth/recovery (cf. routes-config.js).
// ProfileModal retiré Sprint 11 S11.a.6 — remplacé par <ProfilePage /> routée.
// CommunityPage retirée Sprint 11 S11.d — remplacée par /community routée.
// WastePreventionModal retirée v0.32 — bouton FAB anti-gaspi supprimé
// (doublon du filtre antiWaste gratuit du panel recettes).
const AdminPanel           = lazy(() => import('@features/admin/components/admin-panel'))
const SupportPanel         = lazy(() => import('@features/support/components/support-panel'))
const BannedScreen         = lazy(() => import('@features/auth/components/banned-screen'))

// Composant orchestrant les 7 modales/panels top-level user-dépendants.
// Sprint 10 S10.a.16 — extrait depuis App.jsx pour alléger le bloc JSX
// de l'app shell (~95 lignes consolidées).
//
// Toutes ces vues sont chargées en lazy() — rendu conditionnel +
// Suspense individuel pour ne pas bloquer le bundle init. AdminPanel
// est en plus enveloppé dans un ErrorBoundary section-level car son
// code est volumineux et a déjà connu plusieurs régressions
// historiques (cf. project_admin_dashboard_v3_3.md).

export default function AppModalsRoot({
  modals,
  user,
  profile,
  isAdmin,
  // i18n / theme
  lang,
  darkMode,
  // Sprint 11 S11.d — toggleDarkMode retiré : CommunityPage en était
  // le dernier consommateur, désormais elle accède au context UIProvider
  // depuis sa route /community.
  // misc
  refreshSupportUnread,
}) {
  return (
    <>
      {/* AuthModal retiré Sprint 11 S11.b.5 — remplacé par les pages
          routées /login, /signup, /auth/recovery (cf. routes-config.js).
          Le Header / GuestMenu navigate('/login') directement via le
          callback `onShowAuth`. */}

      {/* ProfileModal retiré Sprint 11 S11.a.6 — remplacé par la route
          /profile (cf. routes-config.js + ProfilePage). Le Header
          navigate('/profile') directement. */}

      {/* CommunityPage retirée Sprint 11 S11.d — remplacée par la
          route /community (cf. routes-config.js + CommunityPageRoute).
          Le Header / GuestMenu / UserMenu navigate('/community')
          directement via le callback `onShowCommunity`. */}

      {modals.admin.isOpen && isAdmin && (
        <Suspense fallback={null}>
          <ErrorBoundary level="section" lang={lang} sectionLabel="AdminPanel">
            <AdminPanel onClose={() => modals.admin.close()} lang={lang} darkMode={darkMode} />
          </ErrorBoundary>
        </Suspense>
      )}

      {user && profile?.banned && (
        <Suspense fallback={null}>
          <BannedScreen lang={lang} darkMode={darkMode} onShowSupport={() => modals.support.open()} />
        </Suspense>
      )}

      {modals.support.isOpen && user && (
        <Suspense fallback={null}>
          <SupportPanel
            userId={user.id}
            lang={lang}
            darkMode={darkMode}
            onClose={() => modals.support.close()}
            onUnreadChange={refreshSupportUnread}
          />
        </Suspense>
      )}
    </>
  )
}
