import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'

// RoleGuard — protège les routes admin / moderator / support.
// Sprint 10 S10.b.1 — Bulletproof React + RGPD audit.
//
// Usage :
//   <RoleGuard role="admin">
//     <AdminPanel />
//   </RoleGuard>
//
// Comportement :
//   - Si pas de user → redirect / (login d'abord)
//   - Si user.profile.role !== role requis → redirect / + log audit
//     (tentative d'accès non autorisé tracée dans activity_logs côté
//     server par les RLS).
//
// Defense in depth CRITIQUE :
//   - Côté CLIENT : guard pour ne pas exposer la UI admin aux non-admins
//     (UX + évite de fetch des données refusées par RLS).
//   - Côté SERVEUR (vrai mécanisme de sécurité) : RLS Supabase qui
//     vérifie `auth.uid()` + `profiles.role` à chaque requête.
//   - Edge Functions sensibles : ré-vérifient le role via service_role
//     avant exécution.
//
// → Ne JAMAIS lire `isAdmin` du localStorage. Toujours via useAuth() qui
//   le lit depuis le profile fetch'é côté serveur.

const VALID_ROLES = ['admin', 'moderator', 'support']

export default function RoleGuard({ children, role = 'admin', fallbackPath = '/' }) {
  const { user, isAdmin, profile } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to={fallbackPath} replace state={{ from: location }} />
  }

  if (!VALID_ROLES.includes(role)) {
    if (import.meta.env.DEV) {
      console.error(`[RoleGuard] Invalid role: "${role}". Use one of: ${VALID_ROLES.join(', ')}`)
    }
    return <Navigate to={fallbackPath} replace />
  }

  // Pour l'instant, seul "admin" est implémenté côté profile (isAdmin
  // boolean dans useAuth). Quand on aura moderator/support, ajouter
  // les checks correspondants ici.
  const hasRole = role === 'admin'
    ? isAdmin
    : profile?.role === role

  if (!hasRole) {
    return <Navigate to={fallbackPath} replace state={{ from: location, deniedRole: role }} />
  }

  return children
}
