import { supabase } from '@shared/lib/supabase/client'

// Journal de cuisine.
// Une ligne par recette cuisinée par l'utilisateur connecté. Insertion
// déclenchée à la validation du retrait des ingrédients (RecipeModal step 2)
// ou à la fin du Mode cuisine plein écran. Connecté uniquement.

/**
 * Enregistre une recette comme cuisinée.
 *
 * @param {string} userId
 * @param {object} entry
 * @param {string} entry.recipeId
 * @param {'base'|'custom'|'community'} entry.recipeSource
 * @param {number=} entry.servings  — optionnel, smallint > 0
 */
export async function logCooking(userId, { recipeId, recipeSource, servings }) {
  if (!userId || !recipeId || !recipeSource) return
  const row = {
    user_id: userId,
    recipe_id: recipeId,
    recipe_source: recipeSource,
    servings: Number.isFinite(servings) && servings > 0 ? servings : null,
  }
  const { error } = await supabase.from('cooking_logs').insert(row)
  if (error && import.meta.env.DEV) console.error('[cookingLogs] logCooking:', error.message)
}

/**
 * Liste les N derniers logs (ordre chronologique inverse).
 * @param {string} userId
 * @param {number=} limit  — défaut 20
 * @returns {Promise<Array<{ id, recipe_id, recipe_source, servings, cooked_at }>>}
 */
export async function listRecentCookingLogs(userId, limit = 20) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('cooking_logs')
    .select('id, recipe_id, recipe_source, servings, cooked_at')
    .eq('user_id', userId)
    .order('cooked_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.error('[cookingLogs] listRecent:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Liste TOUS les logs de l'utilisateur (limit large pour usage stats).
 * Utilisé par l'onglet « Stats » du profil. Au-delà de la limite on
 * tronque silencieusement — les stats restent indicatives.
 * @param {string} userId
 * @param {number=} limit — défaut 1000 (~quelques années de cuisine intensive)
 * @returns {Promise<Array>}
 */
export async function listAllCookingLogs(userId, limit = 1000) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('cooking_logs')
    .select('recipe_id, recipe_source, servings, cooked_at')
    .eq('user_id', userId)
    .order('cooked_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.error('[cookingLogs] listAll:', error.message)
    return []
  }
  return data ?? []
}

// Compte léger : l'utilisateur a-t-il cuisiné au moins une fois ? (onboarding
// Tier 2a — ne rapatrie aucun log, juste un count head limité.)
export async function hasCookedAtLeastOnce(userId) {
  if (!userId) return false
  const { count, error } = await supabase
    .from('cooking_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .limit(1)
  if (error) return false
  return (count ?? 0) > 0
}

/**
 * Compte le nombre total de logs de l'utilisateur.
 * Utilise un count exact côté Supabase (head:true → pas de payload).
 */
export async function countCookingLogs(userId) {
  if (!userId) return 0
  const { count, error } = await supabase
    .from('cooking_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    if (import.meta.env.DEV) console.error('[cookingLogs] count:', error.message)
    return 0
  }
  return count ?? 0
}
