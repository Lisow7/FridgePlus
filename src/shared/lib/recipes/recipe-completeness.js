// Validateur pur de complétude d'une recette. Réutilisé par la checklist du form,
// le badge de la file admin et le script d'audit (DRY). Sans I/O ni alias @ pour
// rester import-safe en Node (script d'audit).
//
// `resolveId(id) => bool` : l'id d'ingrédient existe-t-il au catalogue ? (optionnel
// — si absent, on ne juge pas les ids, pour éviter de faux orphelins). Un id
// orphelin = ni nutrition ni coût calculables : point de défaillance n°1, signalé
// explicitement (code `ingredient_unknown:<id>`).
//
// Codes retournés : 'servings' | 'time' | 'steps' | 'ingredients' | 'ingredient_unknown:<id>'

export function getRecipeIssues(recipe, resolveId) {
  const issues = []
  if (!recipe) return issues

  if (!recipe.servings || Number(recipe.servings) <= 0) issues.push('servings')

  // time peut être "30 min" ou "" : parseInt extrait le nombre, NaN/<=0 = manquant.
  if (!recipe.time || !(parseInt(recipe.time, 10) > 0)) issues.push('time')

  const steps = Array.isArray(recipe.steps) ? recipe.steps : []
  if (steps.length === 0 || steps.every(s => !String(s ?? '').trim())) issues.push('steps')

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  if (ingredients.length === 0) {
    issues.push('ingredients')
  } else if (typeof resolveId === 'function') {
    for (const ing of ingredients) {
      const ids = Array.isArray(ing?.ids) ? ing.ids : []
      for (const id of ids) {
        if (id && !resolveId(id)) issues.push(`ingredient_unknown:${id}`)
      }
    }
  }

  return issues
}

// Nombre total de problèmes (pour le badge admin). 0 = recette saine.
export function countRecipeIssues(recipe, resolveId) {
  return getRecipeIssues(recipe, resolveId).length
}
