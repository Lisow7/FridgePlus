// Validator : détecte les ingrédients orphelins (refs inexistantes dans le catalogue).
// Refonte Recettes Phase 2 — Sprint 18.
//
// Format ingredients MVP (array plat) :
//   [{ "id": "gp-...", "amount": 100, "unit": "g", "required": true }]
//
// Si un id n'existe pas dans context.ingredients (catalogue 612 items) :
//   - required=true  → BLOCKING (INGREDIENT_ORPHAN_REQUIRED) — recette inutilisable
//   - required=false → ERROR     (INGREDIENT_ORPHAN_OPTIONAL) — admin doit décider
//
// Si manque qty ET unit → WARNING (INGREDIENT_SLOTS_MISSING_QTY).

import { makeError } from '../pipeline/orchestrator.mjs'
import { getIngredientItemsFlat, getIngredientId, getIngredientQty } from '../../../shared/lib/recipes/recipe-ingredients.js'

export function ingredientMapper(parsedData, context) {
  const errors = []
  const items = getIngredientItemsFlat(parsedData)
  const catalogue = context?.ingredients // Map<id, ingredient>

  if (items.length === 0) {
    // Pas d'ingrédient = autre validator (completeness/no_ingredients) couvrira
    return { ok: true, errors: [], parsedData }
  }

  if (!catalogue) {
    throw new Error('ingredientMapper requires context.ingredients (Map<id, ingredient>)')
  }

  items.forEach((item, idx) => {
    const id = getIngredientId(item)
    if (!id) return // sera couvert par steps/completeness

    if (!catalogue.has(id)) {
      // Suggestion : fuzzy match simple via lowercase prefix
      const suggested = suggestSimilarId(id, catalogue)
      const code = item.required
        ? 'INGREDIENT_ORPHAN_REQUIRED'
        : 'INGREDIENT_ORPHAN_OPTIONAL'
      errors.push(makeError(code, {
        field: `ingredients[${idx}].id`,
        raw: id,
        suggested,
      }))
    }

    const qty = getIngredientQty(item)
    const hasQty = qty?.amount != null && qty.amount !== ''
    const hasUnit = (qty?.unit != null && qty.unit !== '') || (item.unit != null && item.unit !== '')
    if (!hasQty && !hasUnit) {
      errors.push(makeError('INGREDIENT_SLOTS_MISSING_QTY', {
        field: `ingredients[${idx}]`,
        raw: { amount: qty?.amount, unit: qty?.unit },
      }))
    }
  })

  return { ok: errors.length === 0, errors, parsedData }
}

// Donne ingredientMapper.name = 'ingredientMapper' pour annotation orchestrator
ingredientMapper.displayName = 'ingredient-mapper'

// Helper minimaliste : trouve un id qui partage les 4 premiers caractères + label proche
function suggestSimilarId(rawId, catalogue) {
  if (!rawId || typeof rawId !== 'string') return null
  const normalized = rawId.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [id] of catalogue) {
    const idNorm = id.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (idNorm === normalized) return id
    if (idNorm.startsWith(normalized.slice(0, 5)) && normalized.length >= 5) return id
  }
  return null
}
