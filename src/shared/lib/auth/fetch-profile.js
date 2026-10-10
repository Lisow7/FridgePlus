import { supabase } from '@shared/lib/supabase/client'

// `restore_token` exclu délibérément (2026-07-19, suite audit export RGPD) :
// c'est un credential de restauration de compte, jamais lu côté client (grep
// vérifié) — aucune raison de le charger en mémoire navigateur. Contrairement
// à l'export (allow-list stricte), cet état est consommé largement dans toute
// l'app (rôle, abonnement, badges...) donc pas d'allow-list ici : si une
// future colonne sensible est ajoutée à `profiles`, l'exclure explicitement.
const COLONNES = 'id, username, avatar_id, role, banned, created_at, updated_at, ' +
  'password_changed_at, allergen_prefs, deleted_at, language, last_login_at, ' +
  'consent_terms_accepted_at, consent_privacy_accepted_at, community_muted_until, ' +
  'community_terms_accepted_at, stripe_customer_id, subscription_status, trial_ends_at, ' +
  'subscription_ends_at, subscription_plan, monthly_budget, community_bio, ' +
  'profiling_opted_out, inactive_warned_at, per_trip_budget, special_role, ' +
  'username_confirmed, banner_id, unlocked_banners, country_code, push_preferences, ' +
  'push_last_variant_index, fridge_shape, banned_reason, banned_until'

// Les mêmes colonnes, en liste : le temps réel reçoit la ligne ENTIÈRE de
// `profiles` et ne doit fusionner que celles-ci (audit du 2026-10-04, CPT-12 —
// `restore_token` arrivait par là, exclu à la lecture mais pas à l'écoute).
export const COLONNES_DU_PROFIL = COLONNES.split(',').map((c) => c.trim())

/** Ne garde d'une ligne `profiles` que les colonnes que `fetchProfile` lit. */
export function colonnesDuProfil(ligne) {
  const sur = {}
  for (const c of COLONNES_DU_PROFIL) if (c in ligne) sur[c] = ligne[c]
  return sur
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(COLONNES)
    .eq('id', userId)
    .single()
  if (error && import.meta.env.DEV) console.error('[AuthContext] fetchProfile error:', error.message, error.code)
  return data ?? null
}
