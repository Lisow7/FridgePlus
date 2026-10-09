import { supabase } from '@shared/lib/supabase/client'
import { logError } from '@shared/lib/observability/sentry'

// Durci le 2026-08-28 (audit) : le chargement remonte son erreur au lieu de
// rendre un Set vide indistinguable d'une absence de favoris, et les mutations
// ne signalent plus leurs echecs derriere import.meta.env.DEV — donc jamais en
// production. Voir le commentaire detaille de features/fridge/api/stock.js.

export async function loadFavoritesFromDB(userId) {
  const { data, error } = await supabase
    .from('user_favorites')
    .select('recipe_id')
    .eq('user_id', userId)
  if (error) {
    logError(error, { tag: 'favorites.loadFavoritesFromDB' })
    return { favorites: new Set(), error }
  }
  return { favorites: new Set(data.map(r => r.recipe_id)), error: null }
}

export async function addFavorite(userId, recipeId) {
  const { error } = await supabase.from('user_favorites')
    .upsert({ user_id: userId, recipe_id: recipeId }, { onConflict: 'user_id,recipe_id', ignoreDuplicates: true })
  if (error) logError(error, { tag: 'favorites.addFavorite' })
  return { error: error ?? null }
}

export async function removeFavorite(userId, recipeId) {
  const { error } = await supabase.from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
  if (error) logError(error, { tag: 'favorites.removeFavorite' })
  return { error: error ?? null }
}
