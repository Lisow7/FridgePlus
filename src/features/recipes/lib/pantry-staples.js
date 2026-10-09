// Garde-manger assumé — sous-catégories d'ingrédients considérés comme
// TOUJOURS présents dans le matching des recettes (basiques de placard que
// tout le monde a). Ils ne pénalisent donc pas le score d'une recette : « le
// titre apporte l'ingrédient principal + les basiques sont assumés ».
//
// Scope volontairement sûr : sel/poivre/épices/bouillon (salt-spices) +
// huiles/vinaigres (oils). PAS le beurre, l'ail, le sucre, la farine ni les
// herbes fraîches — vrais ingrédients périssables qu'on peut ne pas avoir.
export const STAPLE_SUBCATEGORIES = new Set(['salt-spices', 'oils'])

// Dérive l'ensemble des ids d'ingrédients « staple » depuis le catalogue
// (`ingredientsById` = { id: { subcategory, ... } }, cf. data-provider).
export function computeStapleIds(ingredientsById) {
  const ids = new Set()
  for (const [id, ing] of Object.entries(ingredientsById ?? {})) {
    if (STAPLE_SUBCATEGORIES.has(ing?.subcategory)) ids.add(id)
  }
  return ids
}
