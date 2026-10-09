import { supabase } from '@shared/lib/supabase/client'
import { logError } from '@shared/lib/observability/sentry'

// 🔴 Durci le 2026-08-28 (audit), sur deux points qui allaient ensemble.
//
// 1. `loadStockFromDB` renvoyait un Set VIDE sur erreur — strictement
//    indistinguable d'un frigo réellement vide. L'utilisateur voyait un frigo
//    vide après une coupure réseau, cliquait « Vider le frigo », et le DELETE
//    sans condition supprimait des lignes JAMAIS CHARGÉES. Le chargement
//    remonte donc désormais `error`, et l'appelant refuse de détruire tant
//    qu'aucun chargement n'a réussi.
//
// 2. Les mutations signalaient leurs erreurs derrière `import.meta.env.DEV`,
//    donc JAMAIS en production : ni trace, ni Sentry, ni message, ni retour
//    arrière. Une régression de RLS comme celle du 21 août serait restée
//    invisible. Elles renvoient maintenant `{ error }` et journalisent.
//
// 🥇 Le patron de référence du dépôt est `use-basket.js` : remonter l'erreur,
// rafraîchir depuis la base, et laisser l'appelant décider.

// Renvoie { stock, meta, error }.
// `error` non nul ⇒ stock/meta ne sont PAS une image fiable de la base :
// l'appelant doit conserver son état précédent et interdire les destructions.
export async function loadStockFromDB(userId) {
  const { data, error } = await supabase
    .from('user_stock')
    .select('ingredient_id, added_at, expires_at')
    .eq('user_id', userId)
  if (error) {
    logError(error, { tag: 'stock.loadStockFromDB' })
    return { stock: new Set(), meta: new Map(), error }
  }
  const stock = new Set(data.map(r => r.ingredient_id))
  const meta = new Map(data.map(r => [r.ingredient_id, { addedAt: r.added_at, expiresAt: r.expires_at }]))
  return { stock, meta, error: null }
}

// Override manuel de la date de péremption d'un ingrédient du stock.
export async function setStockExpiry(userId, ingredientId, expiresAt) {
  const { error } = await supabase.from('user_stock')
    .update({ expires_at: expiresAt })
    .eq('user_id', userId)
    .eq('ingredient_id', ingredientId)
  if (error) logError(error, { tag: 'stock.setStockExpiry' })
  return { error: error ?? null }
}

export async function addToStock(userId, ingredientId) {
  const { error } = await supabase.from('user_stock')
    .upsert({ user_id: userId, ingredient_id: ingredientId }, { onConflict: 'user_id,ingredient_id', ignoreDuplicates: true })
  if (error) logError(error, { tag: 'stock.addToStock' })
  return { error: error ?? null }
}

export async function removeFromStock(userId, ingredientId) {
  const { error } = await supabase.from('user_stock')
    .delete()
    .eq('user_id', userId)
    .eq('ingredient_id', ingredientId)
  if (error) logError(error, { tag: 'stock.removeFromStock' })
  return { error: error ?? null }
}

// 🔴 Ne supprime QUE les ingrédients passés en argument — jamais « tout ce que
// porte cet utilisateur ». C'est la garantie qui rend un chargement raté
// inoffensif : si la base n'a pas répondu, l'écran montre un frigo vide, la
// liste transmise est vide, et « Vider le frigo » ne détruit RIEN. Avant le
// 2026-08-28, le DELETE portait sur `user_id` seul et effaçait des lignes que
// personne n'avait jamais lues.
//
// ⛔ Ne jamais « simplifier » en retirant le filtre sur les identifiants : la
// sûreté de l'opération vient précisément de là.
export async function clearStock(userId, ingredientIds) {
  const ids = [...(ingredientIds ?? [])]
  if (ids.length === 0) return { error: null, deleted: 0 }
  const { error } = await supabase.from('user_stock')
    .delete()
    .eq('user_id', userId)
    .in('ingredient_id', ids)
  if (error) logError(error, { tag: 'stock.clearStock' })
  return { error: error ?? null, deleted: error ? 0 : ids.length }
}
