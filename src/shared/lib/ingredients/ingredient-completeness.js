// src/shared/lib/ingredients/ingredient-completeness.js
//
// Validateur pur de complétude d'un ingrédient. Réutilisé par la checklist
// admin (blocage publication) ET le script d'audit. Travaille sur la forme
// BDD canonique : { id, labels{fr,en}, emoji, subcategory, storage,
// default_unit, nutrition{cal,prot,carb,fat,fib}, pack_size{<lang>:[...]},
// allergens[], breaks_diets[] }.
//
// « Requis » bloquant vs « recommandé » non bloquant (cf. spec). Les listes
// explicitement vides (allergens/breaks_diets) sont valides : l'admin déclare
// « aucun », ce n'est pas un oubli.

const NUTRITION_KEYS = ['cal', 'prot', 'carb', 'fat', 'fib']

export const REQUIRED_FIELDS = [
  'labels.fr', 'labels.en', 'emoji', 'subcategory', 'storage',
  'default_unit', 'nutrition', 'pack_size',
]

export const RECOMMENDED_FIELDS = ['image_url', 'seasonal_months', 'group_id']

function hasNutrition(n) {
  return !!n && typeof n === 'object'
    && NUTRITION_KEYS.some(k => Number.isFinite(n[k]) && n[k] !== 0)
}

function hasAnyPack(packs) {
  return !!packs && typeof packs === 'object'
    && Object.values(packs).some(arr => Array.isArray(arr) && arr.length > 0)
}

export function getMissingFields(ing) {
  const missing = []
  if (!ing?.labels?.fr) missing.push('labels.fr')
  if (!ing?.labels?.en) missing.push('labels.en')
  if (!ing?.emoji) missing.push('emoji')
  if (!ing?.subcategory) missing.push('subcategory')
  if (!ing?.storage) missing.push('storage')
  if (!ing?.default_unit) missing.push('default_unit')
  if (!hasNutrition(ing?.nutrition)) missing.push('nutrition')
  if (!hasAnyPack(ing?.pack_size)) missing.push('pack_size')
  return missing
}

export function getMissingRecommended(ing) {
  const missing = []
  if (!ing?.image_url) missing.push('image_url')
  if (!Array.isArray(ing?.seasonal_months) || ing.seasonal_months.length === 0) missing.push('seasonal_months')
  if (!ing?.group_id) missing.push('group_id')
  return missing
}

export function isComplete(ing) {
  return getMissingFields(ing).length === 0
}
