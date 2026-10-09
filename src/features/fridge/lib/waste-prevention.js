// Helper anti-gaspillage Premium.
//
// Filtre les recettes du catalogue par % d'ingrédients dispos dans le frigo,
// au-dessus d'un seuil minimum (par défaut 50%) — l'idée est de ne montrer
// que les recettes qu'on peut faire SANS aller acheter (ou presque).
//
// Garde une archi simple : réutilise scoreRecipes, ajoute un filtre seuil.

import { scoreRecipes } from '@shared/static/recipes'

const DEFAULT_MIN_MATCH = 0.5  // 50% des ingrédients requis dispos minimum

/**
 * Retourne les recettes anti-gaspi : utilisent le stock courant à >= minMatch %.
 * Triées par matchPercent décroissant.
 *
 * @param {Array} recipes — catalogue (RECIPES + custom user)
 * @param {Set<string>} stock — ids ingrédients disponibles
 * @param {object} groupMaps — pour expansion famille→variantes (cf. recipes.js)
 * @param {number} minMatch — seuil [0..1], défaut 0.5
 * @returns {Array} recettes scorées triées
 */
export function getWastePreventionRecipes(recipes, stock, groupMaps, minMatch = DEFAULT_MIN_MATCH) {
  if (!recipes?.length || !stock || stock.size === 0) return []
  return scoreRecipes(recipes, stock, groupMaps)
    .filter(r => r.matchPercent >= minMatch)
}
