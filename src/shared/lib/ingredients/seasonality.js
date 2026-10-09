// Helpers saisonnalité fruits/légumes (hémisphère nord MVP).
//
import { getIngredientItemsFlat, getIngredientIds, isIngredientRequired } from '../recipes/recipe-ingredients'

// Source des données : colonne `seasonal_months smallint[]` sur la table
// `ingredients` Supabase. Chargée dans le DataContext via le hook
// `useIngredientsById()` (chaque ingrédient porte `seasonal_months`).
//
// Données peuplées (migration 20260705_seasonal_months_produce) pour les fruits
// & légumes saisonniers utilisés en recette — calendrier France métropolitaine /
// hémisphère nord (réf. ADEME). Les staples année-pleine (oignon, ail, pomme de
// terre, champignon…) et fruits importés (tropicaux, agrumes verts) restent NULL
// à dessein, sinon le filtre « de saison » perdrait son sens.
//
// Pays : tous les pays de la taxonomie actuelle sont en hémisphère nord → le
// calendrier FR s'applique. Une adaptation par pays/hémisphère (ex. décalage
// +6 mois pour l'hémisphère sud via profiles.country_code) est une évolution
// future, activable dès qu'un pays de l'hémisphère sud est ajouté.

/**
 * @returns {number} mois en cours, 1-12
 */
export function getCurrentMonth() {
  return new Date().getMonth() + 1
}

/**
 * Vérifie si un ingrédient est de saison ce mois-ci.
 *
 * @param {object} ingredient — doit porter `seasonal_months: number[] | null`
 * @param {number} month      — 1-12, défaut = mois courant
 * @returns {boolean}
 */
export function isInSeason(ingredient, month = getCurrentMonth()) {
  const months = ingredient?.seasonal_months
  if (!Array.isArray(months) || months.length === 0) return false
  return months.includes(month)
}

/**
 * Vérifie si une recette utilise au moins un ingrédient required de saison.
 * Critère permissif (1 ingrédient suffit) pour favoriser la découverte.
 *
 * @param {object} recipe              — ingredients au format legacy (array) ou enrichi ({groups, sub_recipes})
 * @param {Map<string, object>} ingredientsById — Map id→ingrédient (cf. DataContext)
 * @param {number} month
 * @returns {boolean}
 */
export function recipeHasSeasonalIngredient(recipe, ingredientsById, month = getCurrentMonth()) {
  if (!recipe?.ingredients) return false
  const get = (id) => ingredientsById?.get?.(id) ?? null
  return getIngredientItemsFlat(recipe).some(ing => {
    if (!isIngredientRequired(ing)) return false
    return getIngredientIds(ing).some(id => isInSeason(get(id), month))
  })
}
