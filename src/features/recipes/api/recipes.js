import { supabase } from '@shared/lib/supabase/client'
import { OFFICIAL_RECIPE_FULL_COLUMNS, rowToOfficialRecipe } from '@shared/lib/recipes/official-recipe-rows'
import {
  loadCommunityRecipesByUser,
  findPublicCommunityRecipes,
  findCommunityRecipeById,
  saveCommunityRecipe as repoSaveCommunityRecipe,
  softDeleteCommunityRecipe as repoSoftDeleteCommunityRecipe,
  markCommunityRecipeAdminModifiedRead,
  deleteCommunityRecipeRGPD,
  countRecipeReferences as repoCountRecipeReferences,
} from '@shared/lib/recipes/recipes-repository'

const LS_KEY = 'fridge-custom-recipes'

async function logUserAction(userId, action, targetId) {
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action,
    target_id: targetId,
    target_type: 'recipe',
  })
}

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
// Rend `true` si l'appareil a bien écrit (stockage plein, navigation privée…).
function lsSave(recipes) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(recipes)); return true } catch { return false }
}

// Les recettes d'un compte (ou de l'appareil, pour un invité) : `{ recipes, error }`.
// Une lecture refusée rend son erreur — pas une liste vide (voir le dépôt).
export async function loadCustomRecipes(userId = null) {
  if (!userId) return { recipes: lsLoad(), error: null }
  // Sprint 5f : délégué au repository (centralise shape mapping + filtre soft-deleted)
  return loadCommunityRecipesByUser(userId)
}

// Enregistre une recette et DIT si c'est fait : `{ error }`.
//
// 🔴 Jusqu'au 2026-10-05 cette fonction ne rendait rien : une recette refusée
// par la base (réseau, session expirée) passait pour enregistrée, le formulaire
// se fermait et son brouillon était purgé — une recette tapée en entier, perdue
// sans un mot. Elle ne LÈVE plus non plus : une recette validée par la
// modération (le dépôt lève `approved_recipe_locked`) et un appel qui échoue
// en route sont rendus comme des erreurs, que le formulaire sait dire.
export async function saveCustomRecipe(recipe, userId = null) {
  if (!userId) {
    const list = lsLoad()
    const idx = list.findIndex(r => r.id === recipe.id)
    if (idx >= 0) list[idx] = recipe; else list.push(recipe)
    return { error: lsSave(list) ? null : new Error('storage_failed') }
  }
  let error
  try { ({ error } = await repoSaveCommunityRecipe(recipe, userId)) }
  catch (err) { error = err ?? new Error('unknown') }
  if (!error && recipe.moderation_status === 'pending') {
    await logUserAction(userId, 'recipe_submitted', recipe.id)
  }
  return { error: error ?? null }
}

export async function deleteCustomRecipe(id, userId = null) {
  if (!userId) {
    lsSave(lsLoad().filter(r => r.id !== id))
    return
  }
  const { error } = await repoSoftDeleteCommunityRecipe(id, userId)
  if (!error) await logUserAction(userId, 'recipe_deleted', id)
}

// Suppression définitive RGPD Art.17 — appelle la function PG dédiée
// qui orchestre cascade (user_favorites, basket_items) + notifs anonymes
// aux favoriteurs + log preuve. Retourne { deleted, favoriters_notified,
// basket_items_removed } pour feedback UI.
export async function deleteCustomRecipeForever(recipeId) {
  return deleteCommunityRecipeRGPD(recipeId)
}

// Compte les références (favoris + paniers) qui seront impactées par
// une suppression. Affiché dans la modale de confirmation pour que
// l'user comprenne l'étendue de l'action.
export async function countRecipeReferences(recipeId) {
  return repoCountRecipeReferences(recipeId)
}

export async function getPublicRecipes() {
  return findPublicCommunityRecipes()
}

// R-05 — top 3 recettes similaires (anti-doublon à la création). Fail-open :
// toute erreur (RPC absente avant migration, réseau…) → [] (jamais bloquant).
export async function findSimilarRecipes(name, ingredientIds, excludeId = null) {
  try {
    const { data, error } = await supabase.rpc('find_similar_recipes', {
      p_name: name,
      p_ingredient_ids: ingredientIds,
      p_exclude_id: excludeId,
    })
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

export async function markAdminModifiedRead(id, userId) {
  return markCommunityRecipeAdminModifiedRead(id, userId)
}

export function createRecipeId() {
  return `custom-${Date.now()}`
}

// Sprint 11 S11.c.1 — fetch d'UNE recette par id (deep-linking).
//
// Cold-load /recipe/:id : si l'user arrive directement sur l'URL (lien
// partagé, refresh, nouvel onglet), les listes en mémoire (custom_recipes
// + public_recipes du store App) n'ont pas encore été fetchées. Ce
// fetch single-row sert de fallback.
//
// Sécurité (defense in depth) :
//   - RLS Supabase enforce déjà côté serveur : un user n'accède pas à
//     une recette privée qui n'est pas la sienne.
//   - Côté client, on ne distingue PAS « inexistante » de « privée pas
//     à toi » → toujours `{ status: 'not-found' }`. Évite de leaker
//     l'existence d'une recette privée (RGPD-clean).
//   - `deleted_at IS NULL` filtré côté repository.
//
// Recettes officielles : pas traitées ici — voir `getOfficialRecipeById`
// ci-dessous, que `useRecipeById` interroge en parallèle.
export async function getRecipeById(id) {
  if (!id) return { recipe: null, status: 'not-found' }
  try {
    const recipe = await findCommunityRecipeById(id)
    if (!recipe) return { recipe: null, status: 'not-found' }
    return { recipe, status: 'ok' }
  } catch {
    // Panne technique — surtout PAS 'not-found', qui ferait croire que la
    // recette n'existe pas. Le secret RGPD ci-dessus n'est pas en cause : ne
    // pas révéler qu'une recette est privée n'oblige pas à mentir sur une
    // panne réseau.
    return { recipe: null, status: 'error' }
  }
}

// La fiche d'une recette OFFICIELLE, lue seule (audit du 2026-10-04, PERF-02).
//
// Un lien direct (Google, partage) n'a pas à attendre le catalogue : avant, la
// fiche cherchait dans le catalogue en mémoire — qui ne contient au démarrage
// que les 100 recettes embarquées sur 515 — puis dans `custom_recipes`, et
// concluait « Recette introuvable » pour 81 % des liens, le temps que le
// catalogue arrive (626 Ko), ou pour toujours s'il n'arrivait pas.
//
// Rend `{ recipe, name }` — la recette sous la forme du catalogue, son nom à
// part (il vit dans `recipeNames`) —, ou `null` si la base n'a pas cette
// recette publiée (la règle d'accès ne montre que `published` et `featured`).
// LÈVE sur une panne : l'appelant doit pouvoir dire « momentanément
// indisponible » plutôt que « introuvable ».
//
// Depuis que le catalogue n'a plus les étapes (PERF-01), c'est la source de
// chaque fiche ouverte : une fiche lue est gardée pour la session, comme le
// catalogue. Une panne ou une absence ne le sont pas (la suivante relit).
const fichesLues = new Map()

export async function getOfficialRecipeById(id) {
  if (!id) return null
  if (fichesLues.has(id)) return fichesLues.get(id)
  const { data, error } = await supabase
    .from('recipes_unified')
    .select(OFFICIAL_RECIPE_FULL_COLUMNS)
    .eq('id', id)
    .eq('origin', 'official')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const fiche = { recipe: rowToOfficialRecipe(data), name: data.name ?? null }
  fichesLues.set(id, fiche)
  return fiche
}

// Chantier recettes de base (2026-07-14) — R-inverse : liste des recettes
// complètes qui référencent cette recette de base comme sous-recette.
// Fail-open (comme findSimilarRecipes) : toute erreur → [], jamais bloquant
// pour l'affichage de la fiche recette de base.
export async function getRecipesUsingBase(recipeId) {
  try {
    const { data, error } = await supabase
      .from('recipe_relations')
      .select('recipe_a_id')
      .eq('recipe_b_id', recipeId)
      .eq('relation_type', 'sub_recipe')
    if (error) return []
    return (data ?? []).map(row => row.recipe_a_id)
  } catch {
    return []
  }
}
