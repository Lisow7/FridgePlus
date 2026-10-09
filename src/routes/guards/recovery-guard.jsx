import { Navigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'

// RecoveryGuard — protège /auth/recovery (flow password reset Supabase).
// Sprint 11 S11.b.1.
//
// L'event Supabase `PASSWORD_RECOVERY` (cf. auth-provider.jsx) active
// `recoveryMode = true` quand l'user clique le lien email. La page
// /auth/recovery permet de saisir un nouveau password — accessible
// uniquement dans ce contexte.
//
// Si quelqu'un arrive sur /auth/recovery sans recoveryMode, redirect
// vers / (pas de contexte valide, probablement un bot ou un lien périmé).

export default function RecoveryGuard({ children, fallbackPath = '/' }) {
  const { recoveryMode } = useAuth()
  if (!recoveryMode) return <Navigate to={fallbackPath} replace />
  return children
}
