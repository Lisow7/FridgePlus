// Validator : vérifie cohérence nutrition via formule Atwater (±30% tolerance).
// Refonte Recettes Phase 2 — Sprint 18.
//
// Formule Atwater : kcal = (protein + carbs) * 4 + fat * 9
// Source : ANSES / CIQUAL standards nutritionnels.
//
// Cases :
//   - kcal=0 mais P+G+L > 5g  → WARNING NUTRITION_ZERO_KCAL
//   - écart kcal déclaré vs Atwater > ±30% → WARNING NUTRITION_MACROS_INCONSISTENT
//
// Pas d'erreur BLOCKING (nutrition = info utile mais pas critique pour utiliser la recette).

import { makeError } from '../pipeline/orchestrator.mjs'

export function nutritionValidator(parsedData) {
  const errors = []
  const n = parsedData?.nutrition

  if (!n || typeof n !== 'object') return { ok: true, errors: [], parsedData }

  const kcal = num(n.calories)
  const p = num(n.protein)
  const g = num(n.carbs)
  const l = num(n.fat)

  if (kcal == null) return { ok: true, errors: [], parsedData }

  // Case 1 : kcal=0 mais macros présents
  if (kcal === 0 && (p ?? 0) + (g ?? 0) + (l ?? 0) > 5) {
    errors.push(makeError('NUTRITION_ZERO_KCAL', {
      field: 'nutrition.calories',
      raw: { kcal, p, g, l },
      suggested: Math.round((p ?? 0) * 4 + (g ?? 0) * 4 + (l ?? 0) * 9),
    }))
    return { ok: false, errors, parsedData }
  }

  // Case 2 : écart vs formule Atwater > 30%
  if (kcal > 0 && p != null && g != null && l != null) {
    const atwater = p * 4 + g * 4 + l * 9
    if (atwater > 0) {
      const diff = Math.abs(kcal - atwater)
      const tolerance = kcal * 0.30
      if (diff > tolerance) {
        errors.push(makeError('NUTRITION_MACROS_INCONSISTENT', {
          field: 'nutrition',
          raw: { kcal_declared: kcal, kcal_atwater: Math.round(atwater), diff_pct: Math.round(diff / kcal * 100) },
          suggested: Math.round(atwater),
        }))
      }
    }
  }

  return { ok: errors.length === 0, errors, parsedData }
}

nutritionValidator.displayName = 'nutrition-validator'

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
