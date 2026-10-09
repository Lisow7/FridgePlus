// Critère « healthy » pour le filtre dans le panel des recettes.
//
// Source des données : `src/data/nutrition.js` (kcal, prot, carb, fat, fib
// par 100g pour chaque ingrédient). Les quantités viennent de `recipe.qty`
// converties en grammes via `sharedToGrams`. Calcul par portion en
// divisant par `recipe.servings`.
//
// Critère retenu pour le MVP (cf. brainstorm validé 2026-05-02) :
//   • Total ≤ 600 kcal par portion
//
// Volontairement simple et prévisible. Si les retours users demandent un
// score plus fin (ratio lipides, fibres, sucres), on pourra évoluer vers
// un score composite type Nutri-Score, mais on commence light.

import { resolveNutrition } from '@shared/lib/ingredients/ingredient-resolver'
import { toGrams as sharedToGrams } from '@shared/lib/recipes/recipe-utils'
import { getIngredientItemsFlat, getIngredientIds, getIngredientQty } from '@shared/lib/recipes/recipe-ingredients'

export const HEALTHY_KCAL_THRESHOLD = 600

/**
 * Calcule les kcal par portion d'une recette à partir de NUTRITION.
 *
 * @param {object} recipe — { ingredients, servings } — ingredients au format
 *   legacy (tableau) ou enrichi ({groups, sub_recipes}), lu via getIngredientItemsFlat.
 * @returns {{ hasData: boolean, kcalPerServing: number }}
 *   • hasData = true si au moins un ingrédient a des données nutritionnelles
 *   • kcalPerServing = kcal par portion (arrondi)
 */
export function calcKcalPerServing(recipe, ingredientsById = null) {
  if (!recipe?.ingredients) return { hasData: false, kcalPerServing: 0 }
  let cal = 0
  let hasData = false
  for (const ing of getIngredientItemsFlat(recipe)) {
    const ids = getIngredientIds(ing)
    const id  = ids.find(id => resolveNutrition(id, ingredientsById)) ?? ids[0]
    const nut = id ? resolveNutrition(id, ingredientsById) : null
    if (!nut) continue
    hasData = true
    const qData  = getIngredientQty(ing)
    const grams  = qData ? sharedToGrams(qData.amount, qData.unit, id) : 100
    const factor = grams / 100
    cal += (nut.cal ?? 0) * factor
  }
  const servings = recipe.servings ?? 1
  return { hasData, kcalPerServing: Math.round(cal / servings) }
}

/**
 * Vérifie si une recette est « healthy » selon le critère MVP.
 *
 * On exige `hasData = true` : une recette sans données nutritionnelles
 * n'est pas considérée healthy (sinon on aurait des faux positifs sur
 * toutes les recettes pour lesquelles on n'a pas la donnée).
 *
 * @param {object} recipe
 * @returns {boolean}
 */
export function isHealthyRecipe(recipe, ingredientsById = null) {
  const { hasData, kcalPerServing } = calcKcalPerServing(recipe, ingredientsById)
  return hasData && kcalPerServing <= HEALTHY_KCAL_THRESHOLD
}
