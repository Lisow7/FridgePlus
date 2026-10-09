// Validator : champs RECOMMANDÉS par Google Recipe Schema pour meilleur SEO/CTR.
// Refonte Recettes Phase 5b — D11.
//
// Vérifie des champs qui NE SONT PAS déjà checkés par d'autres validators et
// dont l'absence dégrade la qualité du JSON-LD Schema.org Recipe émis :
//   - SEO_MISSING_TIME      → pas de time/prep_time/cook_time pour totalTime
//   - SEO_MISSING_KEYWORDS  → diet + functional_tags vides pour keywords
//   - SEO_MISSING_CATEGORY  → type manquant pour recipeCategory
//
// Severity : WARNING uniquement (n'empêche pas publish).
// Applique seulement aux recettes destinées à publish (status published/featured).

import { makeError } from '../pipeline/orchestrator.mjs'

export function seoSchemaValidator(parsedData) {
  const errors = []
  const targetStatus = parsedData?.status ?? 'published'
  const isPublishCandidate = targetStatus === 'published' || targetStatus === 'featured'

  if (!isPublishCandidate) {
    return { ok: true, errors: [], parsedData }
  }

  // 1) Au moins un champ temps doit être présent
  const hasTime = parsedData?.time_min != null
               || parsedData?.prep_time_min != null
               || parsedData?.cook_time_min != null
  if (!hasTime) {
    errors.push(makeError('SEO_MISSING_TIME', {
      field: 'time_min',
      raw: null,
      suggested: 'Renseigner au moins time_min, prep_time_min ou cook_time_min (Google rich card)',
    }))
  }

  // 2) Au moins une keyword source doit être non-vide
  const dietArr = Array.isArray(parsedData?.diet) ? parsedData.diet : []
  const fnArr   = Array.isArray(parsedData?.functional_tags) ? parsedData.functional_tags : []
  if (dietArr.length === 0 && fnArr.length === 0) {
    errors.push(makeError('SEO_MISSING_KEYWORDS', {
      field: 'keywords',
      raw: null,
      suggested: 'Renseigner diet et/ou functional_tags pour générer Schema.org keywords',
    }))
  }

  // 3) type doit être présent (mappé vers recipeCategory)
  if (!parsedData?.type) {
    errors.push(makeError('SEO_MISSING_CATEGORY', {
      field: 'type',
      raw: parsedData?.type,
      suggested: 'Renseigner type (main, dessert, starter, etc.) → recipeCategory Schema.org',
    }))
  }

  return { ok: errors.length === 0, errors, parsedData }
}

seoSchemaValidator.displayName = 'seo-schema-validator'
