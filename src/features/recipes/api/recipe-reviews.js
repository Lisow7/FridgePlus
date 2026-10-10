import { supabase } from '@shared/lib/supabase/client'
import { signalerContenu } from '@shared/api/community'
import { withAuthorProfiles } from '@shared/api/public-profiles'

// Avis sur recettes (notes 1-5 + commentaire optionnel).
//
// Lecture publique des avis non-deleted, écriture connecté + UNIQUE
// (user_id, recipe_id) → 1 seule note par user par recette (modifiable
// via UPDATE).
//
// Pour les agrégats (moyenne + count), on calcule côté front à partir
// de la liste chargée. Pour des recettes avec ~50-200 avis max, c'est
// suffisant. Si ça grossit, on basculera vers une vue SQL ou des
// compteurs dénormalisés via trigger.

// Reads depuis `engagement` filtré type='review' (refonte BDD Sprint 6d
// — PR-DB-16b). Les writes (upsertReview, deleteReview) ciblent encore
// recipe_reviews ; les sync triggers (PR-DB-15) répliquent vers engagement.
// `recipe_source` est passé en argument et juste re-retourné pour préserver
// le shape consumer (10 fichiers consommateurs n'ont pas besoin de changer).
// Sans l'auteur : il est joint ensuite par `withAuthorProfiles`. La jointure
// `profile:profiles!user_id(...)` rendait l'auteur vide pour tout lecteur non
// admin (la table ne se lit que pour sa propre ligne) → « Anonyme » (BDD-13).
const REVIEW_SELECT_ENGAGEMENT = 'id, user_id, target_recipe_id, rating, body, created_at, updated_at'


const VALID_SOURCES = ['base', 'community']

// Helper de mapping engagement → format historique recipe_reviews :
// - target_recipe_id → recipe_id (alias)
// - recipe_source injecté depuis l'arg caller (back-compat 10 consumers)
function mapEngagementRow(row, recipeSource) {
  return { ...row, recipe_id: row.target_recipe_id, recipe_source: recipeSource }
}

/**
 * Les avis publics d'une recette, triés par date desc : `{ reviews, error }`.
 *
 * Rend l'ERREUR : la section des avis doit pouvoir dire « pas chargés » au
 * lieu de « Pas encore d'avis. Sois le premier à noter ! » (jusqu'au
 * 2026-10-05 il n'y avait que `listReviews`, vide sur erreur).
 * @param {string} recipeId
 * @param {'base'|'community'} recipeSource
 * @param {number=} limit
 */
export async function loadReviews(recipeId, recipeSource, limit = 50) {
  if (!recipeId || !VALID_SOURCES.includes(recipeSource)) return { reviews: [], error: null }
  const { data, error } = await supabase
    .from('engagement')
    .select(REVIEW_SELECT_ENGAGEMENT)
    .eq('type', 'review')
    .eq('target_recipe_id', recipeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.error('[recipeReviews] list:', error.message)
    return { reviews: [], error }
  }
  const avis = await withAuthorProfiles(data ?? [])
  return { reviews: avis.map(r => mapEngagementRow(r, recipeSource)), error: null }
}

/**
 * Comme `loadReviews`, mais rend une liste vide sur erreur.
 * ⚠️ Réservé au badge ⭐ de l'en-tête de la fiche : il n'affiche RIEN quand il
 * n'y a pas d'avis, donc rien non plus quand ils n'ont pas pu être lus — pas de
 * mensonge possible. Tout écran qui affiche un état vide doit lire `loadReviews`.
 */
export async function listReviews(recipeId, recipeSource, limit = 50) {
  return (await loadReviews(recipeId, recipeSource, limit)).reviews
}

/**
 * Récupère l'avis du user courant pour une recette donnée (s'il existe).
 * Permet à la modale Avis de pré-remplir le formulaire pour édition.
 */
export async function getMyReview(userId, recipeId, recipeSource) {
  if (!userId || !recipeId) return null
  const { data, error } = await supabase
    .from('engagement')
    .select(REVIEW_SELECT_ENGAGEMENT)
    .eq('type', 'review')
    .eq('user_id', userId)
    .eq('target_recipe_id', recipeId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return null
  return data ? mapEngagementRow((await withAuthorProfiles([data]))[0], recipeSource) : null
}

/**
 * INSERT ou UPDATE selon que l'user a déjà laissé un avis.
 * Utilise upsert avec onConflict pour la simplicité.
 * @param {string} userId
 * @param {object} entry — { recipeId, recipeSource, rating, body }
 */
// Refonte BDD S6e — PR-DB-17a : cutover writes vers engagement.
// UNIQUE engagement_unique_review (user_id, type, target_recipe_id) permet
// l'upsert par (user, recipe). `type` doit être dans onConflict : l'index
// n'est plus partiel depuis le fix 2026-07-16 (cf.
// 20260716_fix_engagement_upsert_conflict.sql — un ON CONFLICT sans le
// prédicat d'un index partiel ne matche jamais, PostgREST ne peut pas
// l'exprimer, d'où un 42P10 systématique avant ce fix).
export async function upsertReview(userId, { recipeId, recipeSource, rating, body }) {
  if (!userId || !recipeId) return { error: 'invalid' }
  if (!VALID_SOURCES.includes(recipeSource)) return { error: 'invalid_source' }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'invalid_rating' }
  const cleanBody = body?.trim() || null
  if (cleanBody && cleanBody.length > 2000) return { error: 'body_too_long' }

  const row = {
    user_id: userId,
    type: 'review',
    target_recipe_id: recipeId,
    rating,
    body: cleanBody,
    // Revit une ligne auto-supprimée (soft-delete) : la policy RLS
    // engagement_update autorise désormais l'auteur à ré-écrire une ligne
    // deleted_by_admin=false (fix 2026-07-17), mais sans remettre deleted_at
    // à null explicitement ici, la ligne resterait invisible/non comptabilisée
    // pour tout le monde sauf l'auteur (cf. engagement_select).
    deleted_at: null,
  }
  const { data, error } = await supabase
    .from('engagement')
    .upsert(row, { onConflict: 'user_id,type,target_recipe_id' })
    .select(REVIEW_SELECT_ENGAGEMENT)
    .single()
  if (error) return { error: error.message }
  return { data: mapEngagementRow((await withAuthorProfiles([data]))[0], recipeSource) }
}

/** Soft-delete (auteur uniquement). */
// Refonte BDD S6e — PR-DB-17a : cutover write vers engagement.
export async function deleteReview(reviewId) {
  const { error } = await supabase
    .from('engagement')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reviewId)
  if (error) return { error: error.message }
  return { ok: true }
}

/**
 * Les notes de plusieurs recettes, agrégées PAR LA BASE : la vue
 * `recipe_rating_aggregates` rend moyenne et compte par recette (audit du
 * 2026-10-04, PERF-12 — avant, six requêtes relisaient tous les avis ligne à
 * ligne et le navigateur faisait les moyennes, fausses sans bruit au-delà des
 * 1 000 lignes de l'API). UNE lecture, au plus une ligne par recette notée ;
 * pas de `in.(ids)` : l'adresse ne grandit pas avec le catalogue, on filtre ici.
 * L'erreur est rendue : le panneau ne peut rien afficher à sa place, mais il
 * peut la dire au journal au lieu de l'avaler.
 * @param {string[]} recipeIds
 * @returns {Promise<{ aggregates: { [recipeId: string]: { avg: number, count: number } }, error: object|null }>}
 */
export async function loadBulkAggregates(recipeIds) {
  if (!recipeIds?.length) return { aggregates: {}, error: null }
  const voulus = new Set(recipeIds)
  const { data, error, count } = await supabase
    .from('recipe_rating_aggregates')
    .select('recipe_id, avg, count', { count: 'exact' })
  if (error) {
    if (import.meta.env.DEV) console.error('[recipeReviews] bulkAgg:', error.message)
    return { aggregates: {}, error }
  }
  const aggregates = {}
  for (const row of data ?? []) {
    if (voulus.has(row.recipe_id)) aggregates[row.recipe_id] = { avg: Number(row.avg), count: row.count }
  }
  // Moins de lignes que la base n'en compte (limite de lignes de l'API) : les
  // notes servent, mais ce n'est plus silencieux.
  const tronque = typeof count === 'number' && (data?.length ?? 0) < count
  return { aggregates, error: tronque ? new Error(`Notes tronquées : ${data.length} recette(s) sur ${count}`) : null }
}

/**
 * Helper sync : calcule moyenne + count à partir d'un array d'avis.
 * @param {Array<{ rating: number }>} reviews
 * @returns {{ avg: number, count: number, distribution: number[] }}
 *   distribution[i] = nombre d'avis avec rating === i+1 (i = 0..4)
 */
export function aggregateReviews(reviews) {
  if (!reviews?.length) {
    return { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] }
  }
  const distribution = [0, 0, 0, 0, 0]
  let sum = 0
  for (const r of reviews) {
    if (Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating - 1] += 1
      sum += r.rating
    }
  }
  return {
    avg: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length,
    distribution,
  }
}

/**
 * Signalement d'un avis (cible `recipe_review`). Même chemin que les
 * signalements de la communauté — voir `signalerContenu`. Jusqu'au 2026-10-05
 * il n'aboutissait jamais (colonne inexistante, `title` oublié, et la base
 * refusait la cible), et la fenêtre affichait quand même « Signalement envoyé ».
 */
export async function reportReview(userId, reviewId, reasonKey, contextBody) {
  return signalerContenu('recipe_review', userId, reviewId, reasonKey, contextBody)
}
