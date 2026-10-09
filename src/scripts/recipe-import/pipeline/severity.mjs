// Hiérarchie de sévérité des erreurs du pipeline d'import recettes.
// Refonte Recettes Phase 2 — Sprint 18.
//
// Ordre croissant de gravité : INFO < WARNING < ERROR < BLOCKING.
// BLOCKING empêche publish automatique (admin obligé d'intervenir).

/** @typedef {'info'|'warning'|'error'|'blocking'} Severity */

/** @type {Record<string, Severity>} */
export const SEVERITY = Object.freeze({
  INFO:     'info',
  WARNING:  'warning',
  ERROR:    'error',
  BLOCKING: 'blocking',
})

// Ordre numérique pour comparaison (max severity, sort, etc.)
const ORDER = { info: 0, warning: 1, error: 2, blocking: 3 }

// Retourne true si a est plus sévère que b
export function isWorse(a, b) {
  return (ORDER[a] ?? -1) > (ORDER[b] ?? -1)
}

// Retourne la sévérité max d'une liste d'erreurs (utile pour status global)
export function maxSeverity(errors) {
  if (!errors?.length) return null
  return errors.reduce((max, e) => {
    const s = e.severity ?? null
    return s && (!max || isWorse(s, max)) ? s : max
  }, null)
}

// Compare 2 sévérités : -1, 0, 1 pour sort
export function compareSeverity(a, b) {
  return (ORDER[a] ?? -1) - (ORDER[b] ?? -1)
}
