import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'

// AuthGuard — protège les routes qui exigent un user connecté.
// Sprint 10 S10.b.1 — pattern Bulletproof React + OWASP.
//
// Usage :
//   <Route path="/profile" element={
//     <AuthGuard>
//       <ProfilePage />
//     </AuthGuard>
//   } />
//
// Comportement :
//   - Si pas de user → redirect vers / (home) avec state.from pour
//     que la page d'auth puisse rediriger après login.
//   - Si recoveryMode (flow reset password) → redirect / aussi
//     (forcer changement password avant accès aux pages).
//
// Defense in depth : ce guard est UX uniquement. La sécurité réelle
// vient des RLS Supabase côté serveur. Ne JAMAIS faire confiance au
// flag user dans le state local pour autoriser des actions critiques.

export default function AuthGuard({ children, fallbackPath = '/' }) {
  const { user, loading, recoveryMode } = useAuth()
  const location = useLocation()

  // Pendant la résolution de la session Supabase (loading=true au boot), on
  // ne tranche pas : sinon un accès par URL directe (reload complet) redirige
  // vers / AVANT que `user` soit hydraté → l'utilisateur connecté est éjecté.
  // On rend null le temps du chargement ; la page gère son propre skeleton.
  if (loading) return null

  if (!user || recoveryMode) {
    return <Navigate to={fallbackPath} replace state={{ from: location }} />
  }

  return children
}
