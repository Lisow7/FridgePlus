// Taxonomie centralisée des codes d'erreur du pipeline d'import recettes.
// Refonte Recettes Phase 2 — Sprint 18.
//
// Pattern : 1 seul endroit pour la sémantique. Permet :
//   - tests unitaires asserter ERROR_CODES.X.severity === 'blocking'
//   - UI admin Qualité v3 filtrer par severity / category
//   - cohérence avec Qualité v2 (recipe_health_check view)
//   - i18n future (mapper code → label localisé)
//
// Spec source : la conception « recipes-massive-import-and-validation » du 2026-05-18 (section 6)

import { SEVERITY } from './severity.mjs'

/** @typedef {'completeness'|'accuracy'|'consistency'|'validity'|'uniqueness'} ErrorCategory */
/** @typedef {{ severity: import('./severity.mjs').Severity, category: ErrorCategory }} ErrorMeta */

/** @type {Record<string, ErrorMeta>} */
export const ERROR_CODES = {
  // ─── BLOCKING — empêche publish (admin doit obligatoirement corriger) ──────
  INGREDIENT_ORPHAN_REQUIRED:    { severity: SEVERITY.BLOCKING, category: 'consistency' },
  DIET_INCONSISTENT_HARD:        { severity: SEVERITY.BLOCKING, category: 'consistency' },
  STEPS_MISSING:                 { severity: SEVERITY.BLOCKING, category: 'completeness' },
  NO_INGREDIENTS:                { severity: SEVERITY.BLOCKING, category: 'completeness' },

  // ─── ERROR — admin doit corriger avant publish (mais workflow autorise queue)
  INGREDIENT_ORPHAN_OPTIONAL:    { severity: SEVERITY.ERROR, category: 'consistency' },
  STEPS_NOT_ARRAY:               { severity: SEVERITY.ERROR, category: 'validity' },
  RELATIONS_PARENT_UNRESOLVED:   { severity: SEVERITY.ERROR, category: 'consistency' },

  // ─── WARNING — recommandation, publish autorisé ───────────────────────────
  INGREDIENT_SLOTS_MISSING_QTY:  { severity: SEVERITY.WARNING, category: 'validity' },
  STEPS_TOO_SHORT:               { severity: SEVERITY.WARNING, category: 'validity' },
  NUTRITION_MACROS_INCONSISTENT: { severity: SEVERITY.WARNING, category: 'consistency' },
  NUTRITION_ZERO_KCAL:           { severity: SEVERITY.WARNING, category: 'consistency' },
  DUPLICATE_NAME_FUZZY:          { severity: SEVERITY.WARNING, category: 'uniqueness' },
  DUPLICATE_NAME_EXACT:          { severity: SEVERITY.WARNING, category: 'uniqueness' },
  MISSING_DESCRIPTION_FR:        { severity: SEVERITY.WARNING, category: 'completeness' },
  MISSING_DESCRIPTION_EN:        { severity: SEVERITY.WARNING, category: 'completeness' },
  MISSING_EMOJI:                 { severity: SEVERITY.WARNING, category: 'completeness' },
  MISSING_COUNTRY:               { severity: SEVERITY.WARNING, category: 'completeness' },
  INVALID_SERVINGS:              { severity: SEVERITY.WARNING, category: 'accuracy' },
  INVALID_TIME:                  { severity: SEVERITY.WARNING, category: 'accuracy' },
  SEO_MISSING_TIME:              { severity: SEVERITY.WARNING, category: 'completeness' },
  SEO_MISSING_KEYWORDS:          { severity: SEVERITY.WARNING, category: 'completeness' },
  SEO_MISSING_CATEGORY:          { severity: SEVERITY.WARNING, category: 'completeness' },

  // ─── INFO — observations, n'empêchent rien (P11.d schema migration) ───────
  SCHEMA_LEGACY_INGREDIENTS:     { severity: SEVERITY.INFO, category: 'completeness' },
}

// Helper : list tous les codes d'une sévérité donnée
export function codesBySeverity(severity) {
  return Object.entries(ERROR_CODES)
    .filter(([, meta]) => meta.severity === severity)
    .map(([code]) => code)
}

// Helper : list tous les codes d'une catégorie donnée
export function codesByCategory(category) {
  return Object.entries(ERROR_CODES)
    .filter(([, meta]) => meta.category === category)
    .map(([code]) => code)
}

// Helper : retourne true si au moins 1 erreur est blocking → bloque publish
export function hasBlockingError(errors) {
  return errors.some(e => ERROR_CODES[e.code]?.severity === SEVERITY.BLOCKING)
}
