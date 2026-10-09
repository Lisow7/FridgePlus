import { getSubRecipes } from '@shared/lib/recipes/recipe-ingredients'

// Calcule le nombre de portions "verrouillé" d'une recette de base (baseRecipe)
// quand elle est vue en aperçu contextuel depuis une recette complète
// (originRecipe), qui l'a déjà mise à l'échelle à `originServings` portions.
// Retourne `null` si originRecipe ne déclare aucun usage substantiel de
// baseRecipe (pas d'entrée sub_recipes correspondante) — dans ce cas
// l'appelant garde le comportement non verrouillé actuel.
//
// Voir la conception « base-recipe-servings-lock » du 2026-07-15
export function computeLockedServings({ originRecipe, originServings, baseRecipe }) {
  const entry = getSubRecipes(originRecipe).find(sr => sr.recipe_id === baseRecipe.id)
  if (!entry) return null

  const scale = (typeof entry.scale === 'number' && entry.scale > 0) ? entry.scale : 1

  const originBaseServings = originRecipe.servings ?? 1
  const originScaleFactor = originServings / originBaseServings
  const effectiveScaleFactor = scale * originScaleFactor

  const baseDefaultServings = baseRecipe.servings ?? 1
  const minServings = baseDefaultServings === 1 ? 1 : 2

  const raw = baseDefaultServings * effectiveScaleFactor
  const clamped = Math.min(12, Math.max(minServings, raw))
  return Math.round(clamped * 10) / 10
}
