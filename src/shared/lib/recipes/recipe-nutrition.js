// Calcul de la nutrition agrégée d'une recette à partir de la nutrition BDD
// (résolue via `ingredientsById` / resolveNutrition — source unique).
// Refonte Recettes Phase 10b.3 — extrait depuis recipe-to-schema-org.js
// pour réutilisation par les filtres nutrition (drawer) + Schema.org mapper.
// Refonte Recettes Phase 11.b — migré vers recipe-ingredients helpers (compat v2).

import { resolveNutrition } from '@shared/lib/ingredients/ingredient-resolver'
import { getIngredientItemsFlat, getIngredientId, getIngredientQty } from './recipe-ingredients'

// Convertit qty (objet `{amount, unit}`) en grammes. Unités volumétriques :
// densité approximation = 1 g/ml (acceptable pour les approximations
// nutrition ; valable pour aqueux, ±20% pour huiles/dairy). Unités non
// massiques (pcs/cs/cc/etc) → 0 pour éviter le bruit.
function computeGrams(qty) {
  if (!qty?.amount || qty.amount <= 0) return 0
  const a = qty.amount
  switch (qty.unit) {
    case 'g':  return a
    case 'kg': return a * 1000
    case 'mg': return a / 1000
    case 'ml': return a
    case 'cl': return a * 10
    case 'L':
    case 'l':  return a * 1000
    default:   return 0
  }
}

/**
 * Calcule la nutrition par portion d'une recette (BDD-first, fallback statique).
 * Supporte le format legacy `[{ ids, qty }]` et le format enrichi v2 `{ groups }`.
 *
 * @param {Object} recipe - recette avec `servings` et `ingredients` (legacy ou v2)
 * @param {Map<string,object>|null} [ingredientsById] - Map id→item du data-provider
 *   (BDD-first) ; `null` ou omis → fallback statique uniquement.
 * @returns {{ kcal, protein, carbs, fat, fiber } | null} Par portion, ou null si pas de data
 */
export function computeRecipeNutrition(recipe, ingredientsById = null) {
  if (!recipe?.servings || recipe.servings <= 0) return null
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  let anyData = false
  for (const ing of getIngredientItemsFlat(recipe)) {
    const id = getIngredientId(ing)
    if (!id) continue
    const nut = resolveNutrition(id, ingredientsById)
    if (!nut) continue
    const grams = computeGrams(getIngredientQty(ing))
    if (grams <= 0) continue
    anyData = true
    const factor = grams / 100
    totals.kcal    += (nut.cal  ?? 0) * factor
    totals.protein += (nut.prot ?? 0) * factor
    totals.carbs   += (nut.carb ?? 0) * factor
    totals.fat     += (nut.fat  ?? 0) * factor
    totals.fiber   += (nut.fib  ?? 0) * factor
  }
  if (!anyData) return null
  return {
    kcal:    totals.kcal    / recipe.servings,
    protein: totals.protein / recipe.servings,
    carbs:   totals.carbs   / recipe.servings,
    fat:     totals.fat     / recipe.servings,
    fiber:   totals.fiber   / recipe.servings,
  }
}
