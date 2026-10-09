// Rayons de magasin et consolidation du panier avant ajout au frigo.
//
// Extrait de `add-to-fridge-modal.jsx` le 2026-07-31 (§2 audit front) : données
// et fonctions pures, sans état ni JSX.
//
// ⚠️ PISTE NON TRAITÉE : des constantes de même nom (`AISLE_ORDER`,
// `AISLE_BY_SUBCAT`, `AISLE_EMOJI`, `AISLE_LABELS`) existent dans 3 à 5 autres
// fichiers. Ce module ne fait que DÉPLACER celles-ci, il ne les mutualise pas —
// mutualiser demanderait de diffuser chaque copie d'abord, deux copies pouvant
// avoir divergé (cf. `pickDefaultIngredients` en #906, où c'était le cas).

export const AISLE_ORDER = ['produce', 'bakery', 'butcher', 'fishmonger', 'dairy', 'vegan', 'grocery', 'condiments', 'oils', 'frozen', 'other']
export const AISLE_BY_SUBCAT = {
  vegetables: 'produce', fruits: 'produce', 'tropical-fruits': 'produce',
  bread: 'bakery',
  meat: 'butcher', deli: 'butcher',
  fish: 'fishmonger',
  dairy: 'dairy', cheese: 'dairy', eggs: 'dairy',
  'vegan-proteins': 'vegan', tofu: 'vegan',
  'pasta-rice': 'grocery', canned: 'grocery', cereals: 'grocery',
  sweet: 'grocery', 'nuts-dried': 'grocery', rice: 'grocery',
  dry: 'grocery', basic: 'grocery',
  'salt-spices': 'condiments', herbs: 'condiments', sauces: 'condiments',
  oils: 'oils',
  'frozen-meat': 'frozen', 'frozen-fish': 'frozen', 'frozen-veg': 'frozen',
  'ready-meals': 'frozen', 'ice-cream': 'frozen', 'frozen-bread': 'frozen',
}
export const AISLE_EMOJI = {
  produce: '🥬', bakery: '🥖', butcher: '🥩', fishmonger: '🐟',
  dairy: '🧀', vegan: '🌱', grocery: '🛒', condiments: '🌶️',
  oils: '🫒', frozen: '❄️', other: '📦',
}
export const AISLE_LABELS = {
  fr: { produce: 'Fruits & Légumes', bakery: 'Boulangerie', butcher: 'Boucherie & Charcuterie', fishmonger: 'Poissonnerie', dairy: 'Crèmerie & Œufs', vegan: 'Végé & Bio', grocery: 'Épicerie', condiments: 'Condiments & Épices', oils: 'Huiles & Vinaigres', frozen: 'Surgelés', other: 'Autres' },
  en: { produce: 'Fruit & Vegetables', bakery: 'Bakery', butcher: 'Meat & Deli', fishmonger: 'Fish counter', dairy: 'Dairy & Eggs', vegan: 'Vegan & Organic', grocery: 'Grocery', condiments: 'Condiments & Spices', oils: 'Oils & Vinegars', frozen: 'Frozen', other: 'Other' },
}

// Groupes dont les variantes sont vraiment interchangeables — regroupés sous
// le parent à l'affichage (tous les œufs = une seule ligne « Œuf(s) »).
export const CONSOLIDABLE_PARENTS = new Set(['fr-oeuf'])



export function aisleFromSubcat(subcat) {
  return AISLE_BY_SUBCAT[subcat] ?? 'other'
}

// Consolide les items du panier pour l'affichage frigo.
// Pour les groupes CONSOLIDABLE_PARENTS (œufs) : regroupe toutes les variantes
// sous le parent (fr-oeuf), en gardant l'id de la première variante trouvée
// pour la présélection du sélecteur.
// Pour les autres ingrédients : une ligne par ingredient_id.
export function consolidateForFridge(basket, lookup) {
  const map = new Map()
  for (const item of basket) {
    if (!item.ingredient_id) continue
    const canonical = lookup.getCanonicalKey(item.ingredient_id) ?? item.ingredient_id
    const useParent = CONSOLIDABLE_PARENTS.has(canonical)
    const key = useParent ? canonical : item.ingredient_id
    if (!map.has(key)) {
      map.set(key, {
        ingredient_id: key,
        items: [item],
        firstVariantId: item.ingredient_id,
      })
    } else {
      map.get(key).items.push(item)
    }
  }
  return [...map.values()]
}
