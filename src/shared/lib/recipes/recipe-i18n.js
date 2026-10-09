// Helpers de résolution des noms de recettes multi-locales.
// Refonte Recettes Phase 7 — D6.1.
//
// Cascade de fallback :
//   1. userLocale spécifique présent dans le name jsonb (ex: 'fr-CA')
//   2. userLanguage présent (ex: 'fr')
//   3. Fallback ultime : name.fr → name.en → première valeur → id
//
// Le helper gère explicitement le cas userLocale=NULL (état par défaut côté
// préférences user) : on cascade direct sur userLanguage sans erreur.

/**
 * Résout un name jsonb multi-locales vers une string affichable.
 *
 * @param {Object|string|null|undefined} nameObj
 *   - jsonb `{fr: '...', en: '...', 'fr-CA': '...'}` (cas courant)
 *   - string (recettes legacy custom — passthrough)
 *   - null/undefined (fallback id)
 * @param {string} [userLocale]   - Locale BCP-47 (ex: 'fr-FR', 'fr-CA'). NULL = pas de préf.
 * @param {string} [userLanguage] - Langue ISO 2 lettres (ex: 'fr', 'en').
 * @param {string} [fallbackId]   - Fallback ultime si aucune locale/langue ne match.
 * @returns {string}
 */
export function pickLocalizedName(nameObj, userLocale, userLanguage, fallbackId = '') {
  if (nameObj == null) return fallbackId
  if (typeof nameObj === 'string') return nameObj

  if (userLocale && nameObj[userLocale]) return nameObj[userLocale]
  if (userLanguage && nameObj[userLanguage]) return nameObj[userLanguage]
  if (nameObj.fr) return nameObj.fr
  if (nameObj.en) return nameObj.en
  const firstVal = Object.values(nameObj).find(v => typeof v === 'string' && v.length > 0)
  return firstVal ?? fallbackId
}

/**
 * Wrapper de `pickLocalizedName` qui prend un objet recette directement.
 * Gère les recettes custom (name = string ou jsonb) et officials (jsonb).
 *
 * @param {Object} recipe   - Recette {id, name?, ...}
 * @param {string} [userLocale]
 * @param {string} [userLanguage]
 * @returns {string}
 */
export function pickRecipeName(recipe, userLocale, userLanguage) {
  if (!recipe) return ''
  return pickLocalizedName(recipe.name, userLocale, userLanguage, recipe.id ?? '')
}
