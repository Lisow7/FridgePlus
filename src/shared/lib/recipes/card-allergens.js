// Dérivation des allergènes pour l'affichage carte recette.
//
// Le champ `recipe.allergens` (stocké) peut sous-déclarer : il ne reflète pas
// toujours les allergènes des substituts de slots ni les éditions ingrédient
// récentes (traces). Le MODAL dérive déjà `stored ∪ union(ingrédients)` ; la
// carte doit faire pareil pour rester cohérente et propager automatiquement les
// allergènes-traces ajoutés au niveau ingrédient (chantier traces 2026-06-28).

import { getIngredientItemsFlat, getIngredientIds, getSubRecipes } from './recipe-ingredients'
import { resolveAllergens } from '../ingredients/ingredient-resolver'

/**
 * Allergènes affichés d'une recette = champ stocké UNIONNÉ avec les allergènes
 * BDD de TOUS les substituts de chaque slot. Source ingrédient = `ingredientsById`.
 *
 * Filet de sécurité (chantier recettes de base, 2026-07-14) : si `recipesById`
 * est fourni, unionne EN PLUS les allergènes des ingrédients de chaque
 * sous-recette référencée (`sub_recipes`) — au cas où l'auteur de la recette
 * complète aurait oublié de dupliquer ces ingrédients dans ses propres
 * `groups` (règle de rédaction du chantier précédent). Non récursif (1 niveau).
 * @returns {string[]} trié, dédupliqué.
 */
export function deriveRecipeAllergens(recipe, ingredientsById, recipesById) {
  const set = new Set(recipe?.allergens ?? [])
  for (const ing of getIngredientItemsFlat(recipe)) {
    for (const id of getIngredientIds(ing)) {
      for (const a of resolveAllergens(id, ingredientsById)) set.add(a)
    }
  }
  if (recipesById) {
    for (const subRecipe of getSubRecipes(recipe)) {
      const baseRecipe = recipesById.get(subRecipe.recipe_id)
      if (!baseRecipe) continue
      for (const ing of getIngredientItemsFlat(baseRecipe)) {
        for (const id of getIngredientIds(ing)) {
          for (const a of resolveAllergens(id, ingredientsById)) set.add(a)
        }
      }
    }
  }
  return [...set].sort()
}

/**
 * Sélection pour l'affichage carte (cap limité, ex. 3 chips).
 * SÉCURITÉ : un allergène déclaré par l'utilisateur (`prefs`) est TOUJOURS visible
 * et placé en tête — jamais masqué par le cap (la carte est la surface de scan ;
 * un allergène caché = échec de sécurité). On complète avec les non-matchés
 * jusqu'à `cap`.
 * @returns {{ visible: string[], overflow: number, matched: Set<string> }}
 */
export function pickCardAllergens(allergens, prefs = [], cap = 3) {
  const prefSet = new Set(prefs)
  const matched = allergens.filter(a => prefSet.has(a))
  const others  = allergens.filter(a => !prefSet.has(a))
  const fill    = Math.max(0, cap - matched.length)
  const visible = [...matched, ...others.slice(0, fill)]
  return { visible, overflow: allergens.length - visible.length, matched: prefSet }
}
