// Validator : vérifie format + qualité des étapes (recipe.steps).
// Refonte Recettes Phase 2 — Sprint 18.
//
// Formats acceptés :
//   - { fr: [...], en: [...], ... } — jsonb i18n (préféré)
//   - [...] — array simple (legacy)
//   - string brut — INVALID (devrait être array)
//
// Checks :
//   - steps absent ou vide → BLOCKING STEPS_MISSING
//   - steps.fr pas un array → ERROR STEPS_NOT_ARRAY
//   - steps.fr a <3 étapes ou étapes courtes (<10 chars) → WARNING STEPS_TOO_SHORT

import { makeError } from '../pipeline/orchestrator.mjs'

export function stepsValidator(parsedData) {
  const errors = []
  const steps = parsedData?.steps

  // Case 0 : steps absent / null / vide
  if (!steps || (Array.isArray(steps) && steps.length === 0)
              || (typeof steps === 'object' && Object.keys(steps).length === 0)) {
    errors.push(makeError('STEPS_MISSING', { field: 'steps', raw: steps }))
    return { ok: false, errors, parsedData }
  }

  // Cas 1 : steps est une string brute (mal formé)
  if (typeof steps === 'string') {
    errors.push(makeError('STEPS_NOT_ARRAY', {
      field: 'steps',
      raw: steps.slice(0, 100),
      suggested: 'Convert to array per language : { fr: [...steps] }',
    }))
    return { ok: false, errors, parsedData }
  }

  // Cas 2 : steps est un array (legacy) — on accepte mais on flag
  let frSteps = null
  if (Array.isArray(steps)) {
    frSteps = steps
  } else if (typeof steps === 'object') {
    // Format jsonb i18n
    frSteps = steps.fr ?? steps.en ?? Object.values(steps)[0]
    if (!Array.isArray(frSteps)) {
      errors.push(makeError('STEPS_NOT_ARRAY', {
        field: 'steps.fr',
        raw: frSteps,
        suggested: 'steps.fr doit être un array de strings',
      }))
      return { ok: false, errors, parsedData }
    }
  }

  // Cas 3 : steps_too_short
  if (frSteps && Array.isArray(frSteps)) {
    if (frSteps.length < 3) {
      errors.push(makeError('STEPS_TOO_SHORT', {
        field: 'steps.fr',
        raw: { count: frSteps.length, steps: frSteps.slice(0, 3) },
        suggested: 'Minimum 3 étapes recommandées pour clarté UX',
      }))
    } else {
      // Au moins 1 étape <10 chars = probable erreur (ex: "Mélanger")
      const shortStep = frSteps.find(s => typeof s === 'string' && s.trim().length < 10)
      if (shortStep) {
        errors.push(makeError('STEPS_TOO_SHORT', {
          field: 'steps.fr',
          raw: shortStep,
          suggested: 'Étape trop courte (<10 chars) — détailler la consigne',
        }))
      }
    }
  }

  return { ok: errors.length === 0, errors, parsedData }
}

stepsValidator.displayName = 'steps-validator'
