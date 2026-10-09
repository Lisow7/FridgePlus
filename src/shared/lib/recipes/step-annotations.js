// Fusionne le glossaire culinaire (verbes/techniques) et les liens vers
// recettes de base (noms de préparations) en UN SEUL passage sur le texte
// d'une étape — deux passages indépendants concaténés casseraient sur des
// plages qui se chevauchent. Précédence : si un même mot correspond aux deux
// dictionnaires, le lien recette de base gagne (naviguer vers une recette
// complète est plus utile qu'une infobulle de définition) — garanti par
// l'ordre d'insertion dans buildTermMatcher (dernier inséré gagne).

import { buildTermMatcher, splitTextWithMatcher } from './text-term-matcher'
import { CULINARY_GLOSSARY } from './culinary-glossary'
import { BASE_RECIPE_LINKS, resolveBaseRecipeLink } from './base-recipe-links'

/**
 * @param {string} text
 * @param {string} lang
 * @param {{currentRecipeId?: string, recipesById?: Map<string,object>}} ctx
 * @returns {Array<
 *   {type:'text', value:string} |
 *   {type:'glossary', value:string, id:string, payload:{fr:string,en:string}} |
 *   {type:'base-recipe', value:string, id:string, payload:string[]}
 * >}
 */
export function splitStepWithAnnotations(text, lang, { currentRecipeId, recipesById } = {}) {
  if (!text) return [{ type: 'text', value: text ?? '' }]

  const glossaryEntries = CULINARY_GLOSSARY.map(entry => ({
    formId: entry.id,
    kind: 'glossary',
    forms: entry.match[lang] ?? [],
    payload: entry.def,
  }))

  const baseRecipeEntries = BASE_RECIPE_LINKS
    .map(entry => ({ entry, resolvedIds: resolveBaseRecipeLink(entry, recipesById, currentRecipeId) }))
    .filter(({ resolvedIds }) => resolvedIds.length > 0)
    .map(({ entry, resolvedIds }) => ({
      formId: entry.id,
      kind: 'base-recipe',
      forms: entry.match[lang] ?? [],
      payload: resolvedIds,
    }))

  // Glossaire inséré EN PREMIER, liens recette de base EN SECOND : sur
  // collision exacte de forme, le second gagne (Map.set écrase).
  const matcher = buildTermMatcher([...glossaryEntries, ...baseRecipeEntries])
  return splitTextWithMatcher(text, matcher)
}
