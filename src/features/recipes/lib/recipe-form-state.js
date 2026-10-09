import { getIngredientItemsFlat, getIngredientId, getIngredientQty } from '@shared/lib/recipes/recipe-ingredients'

export function toFormState(recipe) {
  if (!recipe) return { name:'', emoji:'', country:'', time:'', difficulty:'', type:'', servings:4, diet:['vegetarian','vegan','gluten-free','dairy-free'], allergens:[], ingredients:[], steps:[] }
  return {
    name: recipe.name ?? '',
    emoji: recipe.emoji ?? '',
    country: recipe.country ?? '',
    time: recipe.time ? recipe.time.replace(/\s?min\.?/i, '').trim() : '',
    difficulty: recipe.difficulty ?? '',
    type: recipe.type ?? '',
    servings: recipe.servings ?? 4,
    diet: recipe.diet ?? [],
    allergens: recipe.allergens ?? [],
    ingredients: getIngredientItemsFlat(recipe).map(ing => ({
      _key: `ing-${Math.random().toString(36).slice(2)}`,
      ingredientId: getIngredientId(ing) ?? '',
      labels: ing.labels ?? {},
      qty: getIngredientQty(ing) ?? { amount: '', unit: 'g' },
      required: ing.required ?? true,
    })),
    steps: (recipe.steps ?? []).map(text => ({ id: `s-${Math.random().toString(36).slice(2)}`, text })),
  }
}
