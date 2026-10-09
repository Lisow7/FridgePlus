// Scoring de recettes en fonction du stock — SOURCE CANONIQUE PARTAGÉE.
// Vit dans @shared/lib pour être importable par TOUTES les features sans violer
// l'isolation (recipes, cart, fridge, onboarding…). Avant, deux copies divergentes
// existaient (@features/recipes/lib + @shared/static/recipes) ; elles re-exportent
// désormais ce module.
//
// Une recette est notée selon le pourcentage de ses ingrédients required présents
// dans le stock. `groupMaps` gère les variantes (fr-oeufs-bio compte pour le parent
// fr-oeuf et inversement). `stapleIds` (sel/huile/épices) est assumé présent.

import { getIngredientItemsFlat, getIngredientIds, isIngredientRequired } from './recipe-ingredients'

export function expandStock(stock, groupMaps) {
  if (!groupMaps) return stock
  const { groupMap, parentMap } = groupMaps
  const expanded = new Set(stock)
  for (const id of stock) {
    const parent = parentMap?.[id]
    if (parent) expanded.add(parent)
    const children = groupMap?.[id]
    if (children) children.forEach(c => expanded.add(c))
  }
  return expanded
}

// Sépare les ingrédients requis en présents / manquants POUR L'AFFICHAGE, avec le
// même verdict que le pourcentage : une recette passée par `scoreRecipes` porte
// déjà `missing` (variantes + basiques de placard pris en compte). Comparer le
// stock brut ici mettait en rouge un « Beurre doux » que le score comptait
// présent (carte à 67 % avec beurre et œufs manquants, 2026-10-02).
export function splitPresentMissing(recipe, stock) {
  const required = getIngredientItemsFlat(recipe).filter(isIngredientRequired)
  const keyOf = i => getIngredientIds(i).join('|')
  const isMissing = Array.isArray(recipe.missing)
    ? (keys => i => keys.has(keyOf(i)))(new Set(recipe.missing.map(keyOf)))
    : i => !getIngredientIds(i).some(id => stock.has(id))
  return {
    present: required.filter(i => !isMissing(i)),
    missing: required.filter(isMissing),
  }
}

export function scoreRecipes(recipes, stock, groupMaps, stapleIds = null) {
  const effectiveStock = expandStock(stock, groupMaps)
  // Garde-manger assumé : les basiques de placard (sel, huile, épices…) comptent
  // comme présents pour ne pas pénaliser le match (cf. pantry-staples.js).
  if (stapleIds) for (const id of stapleIds) effectiveStock.add(id)
  return recipes
    .map(recipe => {
      const required = getIngredientItemsFlat(recipe).filter(isIngredientRequired)
      const matchCount = required.filter(i => getIngredientIds(i).some(id => effectiveStock.has(id))).length
      const missing = required.filter(i => !getIngredientIds(i).some(id => effectiveStock.has(id)))
      const matchPercent = required.length > 0 ? matchCount / required.length : 0
      return { ...recipe, matchCount, requiredCount: required.length, missing, matchPercent }
    })
    .sort((a, b) => b.matchPercent - a.matchPercent)
}
