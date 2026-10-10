import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'

// RedirectIfAuthGuard — empêche un user déjà connecté d'accéder aux
// pages d'auth (login, signup). Redirect vers / (ou state.from si
// fournit par AuthGuard d'une page précédente).
//
// Sprint 11 S11.b.1 — utilisé pour /login et /signup.
//
// Exception : si recoveryMode est actif (flow reset password Supabase
// en cours), on laisse passer même si user existe — l'user doit
// pouvoir aller sur /auth/recovery pour saisir son nouveau password.

export default function RedirectIfAuthGuard({ children, fallbackPath = '/' }) {
  const { user, recoveryMode } = useAuth()
  const location = useLocation()

  if (user && !recoveryMode) {
    // Redirect vers la page d'origine si dispo (cas : AuthGuard a
    // redirigé l'user non-loggé vers /login, puis il se connecte →
    // on le renvoie d'où il venait, requête et ancre comprises — CPT-18).
    const from = location.state?.from
    const target = from?.pathname ? { pathname: from.pathname, search: from.search, hash: from.hash } : fallbackPath
    return <Navigate to={target} replace />
  }

  return children
}
