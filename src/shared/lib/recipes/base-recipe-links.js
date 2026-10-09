// Glossaire des recettes de base référencées depuis les étapes d'une recette
// (ex. « béchamel » → recette dédiée). Même esprit que culinary-glossary.js :
// liste statique, détection de texte via text-term-matcher.js (voir
// step-annotations.js pour la fusion des deux dictionnaires).
//
// `recipeIds` est TOUJOURS un tableau, même à 1 élément — même convention que
// les alternatives d'ingrédient d'une recette (`ingredients[].ids[]`). Permet
// d'ajouter plus tard plusieurs recettes cibles (ex. véloutés, marinades —
// différé, cf. la conception « base-recipe-links » du 2026-07-14)
// sans changer la forme des données.
//
// Priorisation initiale basée sur la fréquence réelle dans les 501 recettes
// du catalogue (comptage SQL sur recipes_unified.steps, 2026-07-14). Seule
// « houmous » existe déjà comme recette autonome ; les autres `recipeIds`
// n'existent pas encore — resolveBaseRecipeLink les filtre silencieusement
// tant qu'elles ne sont pas créées (fallback texte simple, jamais un lien mort).
export const BASE_RECIPE_LINKS = [
  { id: 'bechamel', recipeIds: ['bechamel-maison'],
    match: { fr: ['béchamel', 'sauce béchamel'], en: ['béchamel', 'white sauce', 'bechamel sauce'] } },
  { id: 'mayonnaise', recipeIds: ['mayonnaise-maison'],
    match: { fr: ['mayonnaise'], en: ['mayonnaise'] } },
  { id: 'sauce-tomate-maison', recipeIds: ['sauce-tomate-maison'],
    match: { fr: ['sauce tomate maison', 'sauce tomate'], en: ['homemade tomato sauce', 'tomato sauce'] } },
  { id: 'vinaigrette', recipeIds: ['vinaigrette-maison'],
    match: { fr: ['vinaigrette'], en: ['vinaigrette', 'salad dressing'] } },
  { id: 'caramel', recipeIds: ['caramel-maison'],
    match: { fr: ['caramel'], en: ['caramel'] } },
  { id: 'houmous', recipeIds: ['houmous'],
    match: { fr: ['houmous'], en: ['hummus'] } },
  { id: 'pate-brisee', recipeIds: ['pate-brisee-maison'],
    match: { fr: ['pâte brisée'], en: ['shortcrust pastry', 'pie dough'] } },
  { id: 'bouillon-legumes', recipeIds: ['bouillon-legumes-maison'],
    match: { fr: ['bouillon de légumes maison', 'bouillon de légumes'], en: ['homemade vegetable stock', 'vegetable stock'] } },
  { id: 'roux', recipeIds: ['roux-maison'],
    match: { fr: ['roux'], en: ['roux'] } },
  { id: 'chantilly', recipeIds: ['chantilly-maison'],
    match: { fr: ['chantilly'], en: ['whipped cream', 'chantilly cream'] } },
  { id: 'pate-a-crepes', recipeIds: ['pate-a-crepes-maison'],
    match: { fr: ['pâte à crêpes'], en: ['crêpe batter', 'pancake batter'] } },
  { id: 'pate-a-choux', recipeIds: ['pate-a-choux-maison'],
    match: { fr: ['pâte à choux'], en: ['choux pastry'] } },
  { id: 'creme-patissiere', recipeIds: ['creme-patissiere-maison'],
    match: { fr: ['crème pâtissière'], en: ['pastry cream'] } },
  { id: 'pate-sablee', recipeIds: ['pate-sablee-maison'],
    match: { fr: ['pâte sablée'], en: ['sweet shortcrust pastry'] } },
  { id: 'pesto', recipeIds: ['pesto-maison'],
    match: { fr: ['pesto'], en: ['pesto'] } },
]

/**
 * Filtre les `recipeIds` d'une entrée vers ceux qui existent réellement et ne
 * sont pas la recette actuellement affichée (garde-fou anti-auto-lien).
 * @param {{recipeIds:string[]}} entry
 * @param {Map<string,object>|undefined} recipesById
 * @param {string} currentRecipeId
 * @returns {string[]}
 */
export function resolveBaseRecipeLink(entry, recipesById, currentRecipeId) {
  if (!recipesById) return []
  return entry.recipeIds.filter(id => id !== currentRecipeId && recipesById.has(id))
}
