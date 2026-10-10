import { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@routes/routes-config'
import PageSkeleton from '@shared/ui/page-skeleton'
import ErrorBoundary from '@app/error/error-boundary'

// AppRoutes — Sprint 10 S10.b + Sprint 11.
//
// renderRoute() :
//   - Si route.Redirect est défini → rend <Navigate to={Redirect} replace />
//   - Sinon construit <Route> normal avec Guard + Outlet (si children).
//   - Récursif sur children pour supporter les nested routes et les
//     redirects backwards compat (Sprint 11 S11.a.2 : /profile/account →
//     /profile/identite, etc.).
//
// /recipe/:id se rend toujours en page pleine (variant='page'). Le
// browsing se fait dans le panneau in-app (overlay piloté par ?recettes=1
// sur '/'), un clic sur une recette navigue vers la page dédiée.
//
// Defense in depth : les guards client sont UX. La sécurité réelle vient
// des RLS Supabase + role check côté serveur dans les Edge Functions.
// Les guards sont une UX (éviter d'afficher du contenu inaccessible)
// pas un mécanisme d'autorisation.

function renderRoute(route, lang, darkMode) {
  // Cas redirect (entrée legacy ou alias)
  if (route.Redirect) {
    const isIndex = route.path === ''
    return (
      <Route
        key={route.path || 'index'}
        index={isIndex || undefined}
        path={isIndex ? undefined : route.path}
        element={<Navigate to={route.Redirect} replace />}
      />
    )
  }

  const Component = route.Component
  const Guard = route.Guard
  const inner = <Component lang={lang} darkMode={darkMode} />
  const element = Guard ? <Guard>{inner}</Guard> : inner

  if (!route.children) {
    const isIndex = route.path === ''
    return (
      <Route
        key={route.path || 'index'}
        index={isIndex || undefined}
        path={isIndex ? undefined : route.path}
        element={element}
      />
    )
  }

  return (
    <Route key={route.path} path={route.path} element={element}>
      {route.children.map((child) => renderRoute(child, lang, darkMode))}
    </Route>
  )
}

export default function AppRoutes({ lang, darkMode }) {
  const location = useLocation()
  // Un filet par page (audit ARCH-06) : une erreur reste dans sa page, et
  // changer de page la remet à neuf (resetKey : sans remonter la page).
  return (
    <ErrorBoundary level="page" lang={lang} resetKey={location.pathname}>
      <Suspense fallback={<PageSkeleton lang={lang} darkMode={darkMode} />}>
        <Routes location={location}>
          {ROUTES.map((route) => renderRoute(route, lang, darkMode))}
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
