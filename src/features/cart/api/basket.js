import { supabase } from '@shared/lib/supabase/client'
import { logError } from '@shared/lib/observability/sentry'

export async function loadBasketFromDB(userId) {
  const { data, error } = await supabase
    .from('basket_items')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: true })
  if (error) return []
  return data
}

export async function addBasketItems(userId, items) {
  const rows = items.map(item => ({ ...item, user_id: userId }))
  const { error } = await supabase.from('basket_items').insert(rows)
  if (error && import.meta.env.DEV) console.error('[basket] addBasketItems:', error.message)
  return { error }
}

export async function updateBasketItem(itemId, fields) {
  const { error } = await supabase.from('basket_items').update(fields).eq('id', itemId)
  if (error && import.meta.env.DEV) console.error('[basket] updateBasketItem:', error.message)
}

// Return { error } pour permettre aux callers de réagir aux échecs
// (ex: refetch pour resync le state local quand DELETE BDD échoue).
export async function removeBasketItem(itemId) {
  const { error } = await supabase.from('basket_items').delete().eq('id', itemId)
  if (error && import.meta.env.DEV) console.error('[basket] removeBasketItem:', error.message)
  return { error }
}

export async function removeBasketByRecipe(userId, recipeId) {
  const { error } = await supabase.from('basket_items')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
  if (error && import.meta.env.DEV) console.error('[basket] removeBasketByRecipe:', error.message)
  return { error }
}

// Return { error, deletedCount } pour permettre aux callers de
// détecter les échecs silencieux (RLS qui bloque sans erreur visible : DELETE
// retourne success mais ne supprime aucune row). Sans le `.select('id')`,
// Supabase ne renvoie pas les rows supprimées et on ne peut pas savoir si
// le DELETE a vraiment effacé quelque chose.
//
// Diagnostic v3.64.0 : si clearBasket retourne deletedCount=0 alors que le
// state local pensait avoir N items, c'est qu'auth.uid() côté Postgres ne
// matche pas user_id (session expirée silencieusement, désync auth, etc.).
export async function clearBasket(userId) {
  const { data, error } = await supabase
    .from('basket_items')
    .delete()
    .eq('user_id', userId)
    .select('id')
  if (error && import.meta.env.DEV) console.error('[basket] clearBasket:', error.message)
  const deletedCount = Array.isArray(data) ? data.length : 0
  return { error: error ?? null, deletedCount }
}

// « J'ai fait mes courses » : les achats au frigo. Un ingrédient déjà au frigo
// n'est pas une erreur (ignoreDuplicates). Rend `{ error }` : le hook ne vide
// le panier que si le frigo a bien reçu les achats (audit du 2026-10-04, lot
// « accès à la base rangés » — l'écriture était faite en direct par le hook,
// son résultat jeté, et le panier vidé quand même).
export async function mettreAuFrigo(userId, ingredientIds) {
  const ids = [...(ingredientIds ?? [])]
  if (ids.length === 0) return { error: null }
  const { error } = await supabase.from('user_stock').upsert(
    ids.map(id => ({ user_id: userId, ingredient_id: id })),
    { onConflict: 'user_id,ingredient_id', ignoreDuplicates: true },
  )
  if (error) logError(error, { tag: 'basket.mettreAuFrigo' })
  return { error: error ?? null }
}

export async function removeBasketItemsByIds(ids) {
  if (!ids?.length) return { error: null }
  const { error } = await supabase.from('basket_items').delete().in('id', ids)
  if (error && import.meta.env.DEV) console.error('[basket] removeBasketItemsByIds:', error.message)
  return { error: error ?? null }
}

// Met à jour les quantités et le nombre de personnes de tous
// les items d'une même recette dans le panier en une seule opération
// batch (aller-retour BDD unique). Utilisé par le stepper personnes
// (cf. handleUpdateRecipeServings dans App.jsx).
//
// `updates` : Array<{ id, amount, price?, recipe_servings }>
//   • id              — uuid de l'item à mettre à jour
//   • amount          — nouvelle quantité (calculée via ratio)
//   • price           — nouveau prix estimé (optionnel)
//   • recipe_servings — nouveau nombre de personnes choisi
export async function updateBasketItemsBatch(updates) {
  // Supabase n'a pas d'UPDATE batch natif → on enchaîne les promises.
  // Pour un panier avec 5-15 ingrédients par recette, le coût réseau
  // reste raisonnable. Si cela devient un goulet (panier xxl), on
  // créera un RPC SECURITY DEFINER qui fait le batch côté Postgres.
  const errors = []
  await Promise.all(updates.map(async ({ id, ...fields }) => {
    const { error } = await supabase.from('basket_items').update(fields).eq('id', id)
    if (error) errors.push(error)
  }))
  if (errors.length && import.meta.env.DEV) {
    console.error('[basket] updateBasketItemsBatch — errors:', errors.length, errors[0])
  }
  return { error: errors.length ? errors[0] : null }
}
