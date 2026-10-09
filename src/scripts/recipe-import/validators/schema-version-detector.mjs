// Validator : détecte les recettes au format ingrédient LEGACY (array).
// Refonte Recettes Phase 11.d — D18 schema v2 migration progressive.
//
// Format LEGACY  : recipe.ingredients = [{ ids, qty, required }, ...]
// Format ENRICHI : recipe.ingredients = { groups: [...], sub_recipes: [...] }
//
// Pourquoi WARNING (pas blocking) ? :
//   - La rétro-compatibilité backend (P11.a/b) garantit que les helpers
//     `getIngredientItemsFlat` etc. gèrent les 2 formats sans casser.
//   - Le format v2 apporte des avantages UX (groupes mise-en-place, notes,
//     alternatives, sub-recettes) mais n'est pas requis pour publier.
//   - Permet à l'admin de voir dans la queue Import les recettes legacy
//     qui mériteraient d'être enrichies (catalogue gourmand → groupes).
//
// Branché via le CLI `npm run recipes:revalidate-existing` (Phase 9) pour
// surface dans l'admin queue les ~101 recettes officielles legacy.

import { makeError } from '../pipeline/orchestrator.mjs'

export function schemaVersionDetector(parsedData) {
  const ingredients = parsedData?.ingredients
  if (!ingredients) return { ok: true, errors: [], parsedData }

  // Format ENRICHI v2 = objet avec `groups` → OK
  if (!Array.isArray(ingredients) && typeof ingredients === 'object' && Array.isArray(ingredients.groups)) {
    return { ok: true, errors: [], parsedData }
  }

  // Format LEGACY (array) → warning
  if (Array.isArray(ingredients)) {
    return {
      ok: false,
      errors: [makeError('SCHEMA_LEGACY_INGREDIENTS', {
        field: 'ingredients',
        raw: 'array (legacy format)',
        suggested: 'Migrer vers format enrichi { groups: [{ name, items }], sub_recipes? } pour bénéficier des groupes mise-en-place + alternatives + notes (D18)',
      })],
      parsedData,
    }
  }

  // Format inattendu (ni array ni objet avec groups) → idem warning
  return {
    ok: false,
    errors: [makeError('SCHEMA_LEGACY_INGREDIENTS', {
      field: 'ingredients',
      raw: `format inconnu: ${typeof ingredients}`,
      suggested: 'Migrer vers format enrichi { groups: [{ name, items }] } (D18)',
    })],
    parsedData,
  }
}

schemaVersionDetector.displayName = 'schema-version-detector'
