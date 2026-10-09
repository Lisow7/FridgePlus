import { supabase } from '@shared/lib/supabase/client'

// Journal de cuisine.
// Une ligne par recette cuisinée par l'utilisateur connecté. Insertion
// déclenchée à la validation du retrait des ingrédients (RecipeModal step 2)
// ou à la fin du Mode cuisine plein écran. Connecté uniquement.

/**
 * Enregistre une recette comme cuisinée, et DIT si c'est fait : `{ error }`.
 *
 * 🔴 Jusqu'au 2026-10-05 cette fonction ne rendait rien : ses appelants
 * enchaînaient la célébration du badge et l'invite à noter même quand rien
 * n'était noté, et la fiche affichait « Ajoutée à ton journal de cuisine ».
 * Elle ne lève pas : un appel qui échoue en route est rendu comme une erreur.
 *
 * @param {string} userId
 * @param {object} entry
 * @param {string} entry.recipeId
 * @param {'base'|'custom'|'community'} entry.recipeSource
 * @param {number=} entry.servings  — optionnel, smallint > 0
 * @returns {Promise<{ error: object|null }>}
 */
export async function logCooking(userId, { recipeId, recipeSource, servings } = {}) {
  // Rien à noter n'est pas « noté » : l'appelant ne doit pas fêter ce cas.
  if (!userId || !recipeId || !recipeSource) return { error: { message: 'invalid_args' } }
  const row = {
    user_id: userId,
    recipe_id: recipeId,
    recipe_source: recipeSource,
    servings: Number.isFinite(servings) && servings > 0 ? servings : null,
  }
  try {
    const { error } = await supabase.from('cooking_logs').insert(row)
    if (error && import.meta.env.DEV) console.error('[cookingLogs] logCooking:', error.message)
    return { error: error ?? null }
  } catch (err) {
    return { error: err ?? new Error('unknown') }
  }
}

// ── Lectures qui DISENT l'échec ──────────────────────────────────────────
// `load…` rend `{ logs, error }` (ou `{ count, error }`) : un écran peut
// distinguer « rien cuisiné » de « pas chargé ». Jusqu'au 2026-10-04 ces
// lectures (`list…`, `count…`) rendaient une liste vide sur erreur — les
// onglets Activité et Récompenses affichaient alors leur état vide, et les
// badges étaient recalculés sur un journal vide (audit CPT-11).

/**
 * Les N derniers logs (ordre chronologique inverse).
 * @returns {Promise<{ logs: Array<{ id, recipe_id, recipe_source, servings, cooked_at }>, error: object|null }>}
 */
export async function loadRecentCookingLogs(userId, limit = 20) {
  if (!userId) return { logs: [], error: null }
  const { data, error } = await supabase
    .from('cooking_logs')
    .select('id, recipe_id, recipe_source, servings, cooked_at')
    .eq('user_id', userId)
    .order('cooked_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.error('[cookingLogs] listRecent:', error.message)
    return { logs: [], error }
  }
  return { logs: data ?? [], error: null }
}

/**
 * TOUS les logs de l'utilisateur (limite large, pour les statistiques et les
 * badges). Au-delà de la limite on tronque silencieusement — les statistiques
 * restent indicatives.
 * @param {string} userId
 * @param {number=} limit — défaut 1000 (~quelques années de cuisine intensive)
 * @returns {Promise<{ logs: Array, error: object|null }>}
 */
export async function loadAllCookingLogs(userId, limit = 1000) {
  if (!userId) return { logs: [], error: null }
  const { data, error } = await supabase
    .from('cooking_logs')
    .select('recipe_id, recipe_source, servings, cooked_at')
    .eq('user_id', userId)
    .order('cooked_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.error('[cookingLogs] listAll:', error.message)
    return { logs: [], error }
  }
  return { logs: data ?? [], error: null }
}

// Compte léger : l'utilisateur a-t-il cuisiné au moins une fois ? (onboarding
// Tier 2a — ne rapatrie aucun log, juste un count head limité.)
//
// Rend `true`, `false`, ou `null` = ON NE SAIT PAS (lecture refusée, réseau
// coupé). Jusqu'au 2026-10-05 un échec rendait `false` : « jamais cuisiné »,
// donc la carte du débutant pour un compte ancien dès que la lecture échouait.
export async function hasCookedAtLeastOnce(userId) {
  if (!userId) return false
  try {
    const { count, error } = await supabase
      .from('cooking_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .limit(1)
    if (error) return null
    return (count ?? 0) > 0
  } catch {
    return null
  }
}

/**
 * Le nombre total de logs de l'utilisateur : `{ count, error }`.
 * Utilise un count exact côté Supabase (head:true → pas de payload).
 */
export async function loadCookingLogsCount(userId) {
  if (!userId) return { count: 0, error: null }
  const { count, error } = await supabase
    .from('cooking_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    if (import.meta.env.DEV) console.error('[cookingLogs] count:', error.message)
    return { count: 0, error }
  }
  return { count: count ?? 0, error: null }
}
