import { supabase } from '@shared/lib/supabase/client'

// `restore_token` exclu délibérément (2026-07-19, suite audit export RGPD) :
// c'est un credential de restauration de compte, jamais lu côté client (grep
// vérifié) — aucune raison de le charger en mémoire navigateur. Contrairement
// à l'export (allow-list stricte), cet état est consommé largement dans toute
// l'app (rôle, abonnement, badges...) donc pas d'allow-list ici : si une
// future colonne sensible est ajoutée à `profiles`, l'exclure explicitement.
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_id, role, banned, created_at, updated_at, ' +
      'password_changed_at, allergen_prefs, deleted_at, language, last_login_at, ' +
      'consent_terms_accepted_at, consent_privacy_accepted_at, community_muted_until, ' +
      'community_terms_accepted_at, stripe_customer_id, subscription_status, trial_ends_at, ' +
      'subscription_ends_at, subscription_plan, monthly_budget, community_bio, ' +
      'profiling_opted_out, inactive_warned_at, per_trip_budget, special_role, ' +
      'username_confirmed, banner_id, unlocked_banners, country_code, push_preferences, ' +
      'push_last_variant_index, fridge_shape, banned_reason, banned_until')
    .eq('id', userId)
    .single()
  if (error && import.meta.env.DEV) console.error('[AuthContext] fetchProfile error:', error.message, error.code)
  return data ?? null
}
