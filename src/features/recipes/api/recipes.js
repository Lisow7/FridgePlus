import { supabase } from '@shared/lib/supabase/client'
import {
  findCommunityRecipesByUser,
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
function lsSave(recipes) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(recipes)) } catch {}
}

export async function getCustomRecipes(userId = null) {
  if (!userId) return lsLoad()
  // Sprint 5f : délégué au repository (centralise shape mapping + filtre soft-deleted)
  return findCommunityRecipesByUser(userId)
}

export async function saveCustomRecipe(recipe, userId = null) {
  if (!userId) {
    const list = lsLoad()
    const idx = list.findIndex(r => r.id === recipe.id)
    if (idx >= 0) list[idx] = recipe; else list.push(recipe)
    lsSave(list)
    return
  }
  // Sprint 5f : délégué au repository. Le repo throw avec code='approved_recipe_locked'
  // si le trigger SQL prevent_edit_approved rejette l'update (recette approuvée
  // éditée par non-admin). Le caller affiche le bon message ("Verrouillée par
  // la modération") plutôt qu'un generic "Une erreur est survenue".
  const { error } = await repoSaveCommunityRecipe(recipe, userId)
  if (!error && recipe.moderation_status === 'pending') {
    await logUserAction(userId, 'recipe_submitted', recipe.id)
  }
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
// IDs base recipes (préfixe `r-`) : pas traité ici — `useRecipeById`
// fait le lookup en mémoire via `useBaseRecipes()` avant d'appeler
// cette API.
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
