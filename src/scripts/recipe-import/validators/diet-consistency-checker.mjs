// Validator : vérifie cohérence entre recipe.diet et ingredients.breaks_diets.
// Refonte Recettes Phase 2 — Sprint 18.
//
// Logique :
//   - Récupère tous les ingrédients référencés
//   - Aggrège leurs breaks_diets
//   - Pour chaque diet déclaré sur la recette : si dans breaks_diets → BLOCKING
//
// Ex : recipe.diet = ['vegan'] mais contient gp-lait (breaks_diets=['vegan'])
//       → DIET_INCONSISTENT_HARD
//
// Note : avec le trigger D22 (Phase 1), allergens/diet sont auto-dérivés à
// l'INSERT/UPDATE de recipes_unified. Ce validator reste utile car il
// s'exécute SUR LE STAGING (raw_payload IA peut mentir sur diet), avant
// le INSERT qui déclencherait le trigger. Permet à l'admin de voir l'erreur
// AVANT publish.

import { makeError } from '../pipeline/orchestrator.mjs'
import { getIngredientItemsFlat, getIngredientId } from '../../../shared/lib/recipes/recipe-ingredients.js'

export function dietConsistencyChecker(parsedData, context) {
  const errors = []
  const recipeDiets = parsedData?.diet ?? []
  const catalogue = context?.ingredients

  if (!Array.isArray(recipeDiets) || recipeDiets.length === 0) {
    return { ok: true, errors: [], parsedData }
  }

  const items = getIngredientItemsFlat(parsedData)
  if (items.length === 0) {
    return { ok: true, errors: [], parsedData }
  }

  if (!catalogue) {
    throw new Error('dietConsistencyChecker requires context.ingredients')
  }

  // Aggrège tous les breaks_diets des ingrédients référencés
  const brokenDiets = new Set()
  const offendingIngredients = {} // { diet: [ingredientId, ...] }

  for (const item of items) {
    const id = getIngredientId(item)
    if (!id) continue
    const ing = catalogue.get(id)
    if (!ing?.breaks_diets) continue
    for (const broken of ing.breaks_diets) {
      brokenDiets.add(broken)
      offendingIngredients[broken] = offendingIngredients[broken] ?? []
      offendingIngredients[broken].push(id)
    }
  }

  // Pour chaque diet déclarée, vérifie si elle est cassée
  for (const diet of recipeDiets) {
    if (brokenDiets.has(diet)) {
      errors.push(makeError('DIET_INCONSISTENT_HARD', {
        field: 'diet',
        raw: { declared: diet, broken_by: offendingIngredients[diet] },
        suggested: `Retirer "${diet}" de recipe.diet ou substituer les ingrédients : ${offendingIngredients[diet].join(', ')}`,
      }))
    }
  }

  return { ok: errors.length === 0, errors, parsedData }
}

dietConsistencyChecker.displayName = 'diet-consistency-checker'
