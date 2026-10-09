import { supabase } from '@shared/lib/supabase/client'

// Helpers de date extraits en shared/lib/leftovers/ (Sprint 9 S9.a.6)
// car utilisés transversalement (use-recipe-filters dans la feature recipes).
// Re-exports ici pour compat ascendante des consommateurs.
export { getDaysLeft, isLeftoverExpired, isLeftoverSaved } from '@shared/lib/leftovers/expired'
import { isLeftoverSaved } from '@shared/lib/leftovers/expired'

// Compteur « restes sauvés » : restes supprimés AVANT leur DLC (utilisés à temps).
// PostgREST ne compare pas deux colonnes → on récupère les restes supprimés
// (peu nombreux) et on filtre côté client via isLeftoverSaved.
export async function countSavedLeftovers(userId) {
  if (!userId) return 0
  const { data } = await supabase
    .from('user_leftovers')
    .select('deleted_at, expires_at')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
  return (data ?? []).filter(isLeftoverSaved).length
}

export async function getLeftovers(userId) {
  const { data } = await supabase
    .from('user_leftovers')
    .select('id, user_id, name, emoji, ingredient_id, dlc_days, created_at, expires_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function addLeftover(userId, { name, emoji, ingredient_id, dlc_days }) {
  const expires_at = new Date(Date.now() + dlc_days * 86400000).toISOString()
  const { data, error } = await supabase
    .from('user_leftovers')
    .insert({ user_id: userId, name, emoji, ingredient_id: ingredient_id ?? null, dlc_days, expires_at })
    .select('id, user_id, name, emoji, ingredient_id, dlc_days, created_at, expires_at')
    .single()
  return { data, error }
}

export async function deleteLeftover(id, userId) {
  const { error } = await supabase
    .from('user_leftovers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  return { error }
}
