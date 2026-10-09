import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'

// PremiumGuard — protège les routes/features réservées aux abonnés Premium.
// Sprint 10 S10.b.1.
//
// Usage :
//   <PremiumGuard fallbackPath="/upgrade">
//     <PremiumOnlyPage />
//   </PremiumGuard>
//
// Comportement :
//   - Si pas de user → redirect / (login d'abord)
//   - Si user mais pas hasPremiumAccess → redirect vers fallbackPath
//     (typiquement page d'upgrade)
//
// `hasPremiumAccess` vient de useSubscription qui lit le `subscription_status`
// du profile (alimenté par Stripe webhook → Supabase).
//
// Defense in depth :
//   - Client : guard UX (ne pas afficher du contenu inaccessible)
//   - Serveur : RLS Supabase qui filtre par subscription_status
//   - Edge Functions sensibles : ré-vérifient via service_role
//
// Statuts considérés Premium :
//   - 'active' (paiement en cours)
//   - 'trialing' (essai 7j)
//   - 'comped' (offert admin pour beta-testeurs)
//   - 'canceled' avec subscriptionEndsAt > now (accès jusqu'à fin période)

export default function PremiumGuard({ children, fallbackPath = '/' }) {
  const { user } = useAuth()
  const { hasPremiumAccess } = useSubscription()
  const location = useLocation()

  if (!user) {
    return <Navigate to={fallbackPath} replace state={{ from: location }} />
  }

  if (!hasPremiumAccess) {
    return <Navigate to={fallbackPath} replace state={{ from: location, requiresPremium: true }} />
  }

  return children
}
