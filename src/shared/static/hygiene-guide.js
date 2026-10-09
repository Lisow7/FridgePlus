export const HYGIENE_GUIDE = [
 { emoji: '🥩', days: 3, fr: 'Viande cuite', en: 'Cooked meat'},
 { emoji: '🐟', days: 2, fr: 'Poisson cuit', en: 'Cooked fish'},
 { emoji: '🍲', days: 3, fr: 'Plat cuisiné', en: 'Cooked dish'},
 { emoji: '🍚', days: 2, fr: 'Riz / Pâtes cuits', en: 'Cooked rice / pasta'},
 { emoji: '🥣', days: 3, fr: 'Soupe / Bouillon', en: 'Soup / Broth'},
 { emoji: '🥗', days: 1, fr: 'Salade assaisonnée', en: 'Dressed salad'},
 { emoji: '🍰', days: 3, fr: 'Dessert / Pâtisserie', en: 'Dessert / Pastry'},
 { emoji: '🥚', days: 2, fr: 'Œufs cuits', en: 'Cooked eggs'},
 { emoji: '🥦', days: 3, fr: 'Légumes cuits', en: 'Cooked vegetables'},
 { emoji: '🧀', days: 5, fr: 'Fromage ouvert', en: 'Opened cheese'},
]

// DLC recommandée par sous-catégorie d'ingrédient (en jours, max 5).
// Reflète les règles du guide hygiène ci-dessus.
const SUBCATEGORY_TO_DLC = {
 meat: 3, deli: 3, 'frozen-meat': 3,
 fish: 2, 'frozen-fish': 2,
 'ready-meals': 3,
 'pasta-rice': 2, rice: 2, cereals: 2,
 vegetables: 3, 'frozen-veg': 3, 'vegan-proteins': 3,
 fruits: 3, 'tropical-fruits': 3,
 bread: 3, 'frozen-bread': 3,
 sweet: 3,
 canned: 3,
 'nuts-dried': 5,
 'salt-spices': 5,
 sauces: 3,
 oils: 5,
 herbs: 1,
 tofu: 3,
 'ice-cream': 1,
 dairy: 3,
 cheese: 5,
 eggs: 2,
 bof: 3,
 dry: 3,
 basic: 3,
}

const DEFAULT_DLC = 3

// Retourne la DLC recommandée (1-5) pour un ingrédient donné, en cherchant
// dans quelle sous-catégorie il se trouve dans INGREDIENTS.
export function getDlcForIngredient(ingredientId, INGREDIENTS) {
 if (!ingredientId || !INGREDIENTS) return DEFAULT_DLC
 for (const [subId, arr] of Object.entries(INGREDIENTS)) {
 if (arr.some(i => i.id === ingredientId)) {
 return SUBCATEGORY_TO_DLC[subId] ?? DEFAULT_DLC
 }
 }
 return DEFAULT_DLC
}
