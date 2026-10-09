// Validator : vérifie présence des champs essentiels (completeness dimension).
// Refonte Recettes Phase 2 — Sprint 18.
//
// Checks (sur status='published' ou recettes destinées à publish) :
//   - no_ingredients              → BLOCKING NO_INGREDIENTS
//   - description.fr manquante    → WARNING MISSING_DESCRIPTION_FR
//   - description.en manquante    → WARNING MISSING_DESCRIPTION_EN
//   - emoji manquant ou défaut    → WARNING MISSING_EMOJI
//   - country manquant            → WARNING MISSING_COUNTRY
//   - servings invalide           → WARNING INVALID_SERVINGS
//   - time_min invalide           → WARNING INVALID_TIME

import { makeError } from '../pipeline/orchestrator.mjs'
import { getIngredientItemsFlat } from '../../../shared/lib/recipes/recipe-ingredients.js'

const DEFAULT_EMOJIS = new Set(['', '🍳', '🍽️'])

export function completenessValidator(parsedData) {
  const errors = []
  const targetStatus = parsedData?.status ?? 'published'
  const isPublishCandidate = targetStatus === 'published' || targetStatus === 'featured'

  // BLOCKING : pas d'ingrédients (supporte format legacy array et format enrichi v2 object)
  if (getIngredientItemsFlat(parsedData).length === 0) {
    errors.push(makeError('NO_INGREDIENTS', { field: 'ingredients', raw: parsedData?.ingredients }))
  }

  // emoji manquant ou placeholder
  const emoji = parsedData?.emoji
  if (!emoji || DEFAULT_EMOJIS.has(emoji)) {
    errors.push(makeError('MISSING_EMOJI', { field: 'emoji', raw: emoji }))
  }

  // Pour les recettes à publier uniquement
  if (isPublishCandidate) {
    const desc = parsedData?.description ?? {}
    if (!desc.fr || desc.fr.trim() === '') {
      errors.push(makeError('MISSING_DESCRIPTION_FR', { field: 'description.fr', raw: desc.fr }))
    }
    if (!desc.en || desc.en.trim() === '') {
      errors.push(makeError('MISSING_DESCRIPTION_EN', { field: 'description.en', raw: desc.en }))
    }
    if (!parsedData?.country) {
      errors.push(makeError('MISSING_COUNTRY', { field: 'country', raw: parsedData?.country }))
    }
  }

  // Servings : 1-20 valides
  const servings = parsedData?.servings
  if (servings != null && (servings < 1 || servings > 20)) {
    errors.push(makeError('INVALID_SERVINGS', {
      field: 'servings', raw: servings, suggested: 'Entre 1 et 20 portions',
    }))
  }

  // Time : 1-480 min valides
  const time = parsedData?.time_min
  if (time != null && (time < 1 || time > 480)) {
    errors.push(makeError('INVALID_TIME', {
      field: 'time_min', raw: time, suggested: 'Entre 1 et 480 minutes (8h max)',
    }))
  }

  return { ok: errors.length === 0, errors, parsedData }
}

completenessValidator.displayName = 'completeness-validator'
