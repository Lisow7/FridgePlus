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
//   - Visiteur arrivé sans session → /login avec state.from : une fois
//     connecté, RedirectIfAuthGuard le ramène sur la page demandée (audit
//     du 2026-10-04, CPT-18 : il était renvoyé à l'accueil sans explication,
//     et personne ne relisait state.from).
//   - Session fermée dans l'onglet (déconnexion, expiration, révocation,
//     suppression du compte) → /, comme avant : se déconnecter ne mène pas
//     à la page de connexion. C'est le contexte d'auth qui s'en souvient
//     (`aEuUneSession`) : un garde monté APRÈS la fin de la session — quand
//     l'écran « Compte désactivé » rend la main — doit le savoir aussi.
//   - Si recoveryMode (flow reset password) → redirect / aussi
//     (forcer changement password avant accès aux pages).
//
// Defense in depth : ce guard est UX uniquement. La sécurité réelle
// vient des RLS Supabase côté serveur. Ne JAMAIS faire confiance au
// flag user dans le state local pour autoriser des actions critiques.

export default function AuthGuard({ children }) {
  const { user, loading, recoveryMode, aEuUneSession } = useAuth()
  const location = useLocation()

  // Pendant la résolution de la session Supabase (loading=true au boot), on
  // ne tranche pas : sinon un accès par URL directe (reload complet) redirige
  // vers / AVANT que `user` soit hydraté → l'utilisateur connecté est éjecté.
  // On rend null le temps du chargement ; la page gère son propre skeleton.
  if (loading) return null

  if (recoveryMode || (!user && aEuUneSession)) return <Navigate to="/" replace />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return children
}
