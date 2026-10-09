// useSubscription — lit le statut d'abonnement depuis le profil déjà chargé (AuthContext).
//
// IMPORTANT : ce hook est réservé à l'UX (affichage conditionnel, gates visuels).
// Pour toute action sensible (accès à des données premium, mutations BDD),
// la vérification doit toujours se faire côté serveur via RLS ou RPC.

import { useMemo } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'

export function useSubscription() {
  const { profile, isAdmin, profileLoading } = useAuth()

  return useMemo(() => {
    const status         = profile?.subscription_status ?? 'free'
    const trialEndsAt    = profile?.trial_ends_at        ? new Date(profile.trial_ends_at)        : null
    const subscriptionEndsAt = profile?.subscription_ends_at ? new Date(profile.subscription_ends_at) : null
    const now            = new Date()
    const specialRole    = profile?.special_role ?? null

    // 'active' = abonnement Stripe actif — 'comped' = accès offert par admin.
    // Sprint 11 — les admins sont considérés Premium d'office (bypass) car
    // ils doivent pouvoir tester / fixer / développer les features Premium
    // sans avoir à payer un abonnement Stripe.
    const isPremium   = status === 'active' || status === 'comped' || isAdmin
    const isTrialing  = status === 'trialing' && trialEndsAt !== null && trialEndsAt > now
    const isComped    = status === 'comped'
    const isSpecialAccess = isComped && specialRole !== null

    // Garde la définition large pour les gates UI (somme des cas Premium).
    const hasPremiumAccess = isPremium || isTrialing

    const trialDaysLeft = isTrialing
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    return {
      subscriptionStatus:  status,
      isPremium,
      isTrialing,
      isComped,
      hasPremiumAccess,
      trialDaysLeft,
      subscriptionEndsAt,
      plan: profile?.subscription_plan ?? null,
      isSpecialAccess,
      specialRole,
      // Compte connecté dont le profil n'est pas encore là : « pas Premium »
      // serait un mensonge d'un instant — les pages attendent (audit du
      // 2026-10-04, PREM-06).
      profileLoading: !!profileLoading,
    }
  }, [profile, isAdmin, profileLoading])
}
