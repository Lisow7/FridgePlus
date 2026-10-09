// Détermine si une recette n'a pas d'image personnalisée (émoji seul côté
// utilisateur). Gère les 2 formes : recette de base (colonne `image_url`)
// et recette communauté (JSONB `data.image_url`). Lecture seule.
export function hasNoImage(recipe) {
  if (!recipe) return true
  const url = recipe.data ? recipe.data.image_url : recipe.image_url
  return !url || String(url).trim() === ''
}

export function countMissingImages(recipes) {
  return (recipes ?? []).reduce((n, r) => n + (hasNoImage(r) ? 1 : 0), 0)
}
