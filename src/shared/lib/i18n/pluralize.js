// Sprint 6 PR S6.b — Pure function `pluralize`.
//
// Helper i18n unifié pour la pluralisation simple (singulier/pluriel)
// dans les 5 langues supportées. Centralise la règle pour éviter les
// répétitions inline dans les toasts (~5 endroits avant cette PR).
//
// Règle linguistique :
//   - FR / JA : `count <= 1` → singulier (« 0 ingrédient », « 1 ingrédient »)
//     Le japonais n'a pas de marque morphologique de pluriel → les deux
//     formes sont en pratique identiques côté caller.
//   - EN / ES / DE : `count === 1` → singulier (« 1 item / 0 items / 2 items »)
//
// Usage typique :
//   pluralize(0, 'en', { one: 'item', other: 'items' })          → 'items'
//   pluralize(1, 'fr', { one: 'élément', other: 'éléments' })    → 'élément'
//   pluralize(2, 'de', { one: 'Eintrag', other: 'Einträge' })    → 'Einträge'
//
// Pour des messages plus complexes (préfixes/suffixes variables, accord
// d'adjectifs), préférer une fonction dédiée par message qui appelle
// `pluralize` ou fait son propre choix.

const SINGULAR_INCLUDES_ZERO = new Set(['fr', 'ja'])

export function pluralize(count, lang, forms) {
  if (!forms) return ''
  const { one, other } = forms
  const isSingular = SINGULAR_INCLUDES_ZERO.has(lang) ? count <= 1 : count === 1
  return isSingular ? (one ?? '') : (other ?? one ?? '')
}

// Helper convenience : retourne juste le suffixe `s` (anglais/espagnol/français/etc.)
// en respectant la règle de la langue. Cas le plus fréquent dans les
// toasts : « 2 ingrédient${suffixS(count, lang)} ajouté${suffixS(count, lang)} ».
export function suffixS(count, lang) {
  return pluralize(count, lang, { one: '', other: 's' })
}
