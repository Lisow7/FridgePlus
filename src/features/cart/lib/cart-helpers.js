// Helpers pour le panier de courses (panier UX).
//
// Sépare la logique de découverte des packs grande surface (spécifiques
// par ingrédient + fallback par sous-catégorie) du composant React
// CartManualAdd, pour faciliter les tests unitaires et la réutilisation.
//
// Chantier A — constantes rayons + smart phase detection extraites de
// shopping-cart-panel.jsx pour être partagées par les nouveaux composants.

import { getPacksFor } from './pack-optimizer'
import { getDefaultPacksFor } from '@shared/static/default-packs-by-category'

// Renvoie la liste des conditionnements grande surface pour un ingrédient.
//
// Stratégie :
//   1. Si l'ingrédient a des packs spécifiques dans `packSizes.js`
//      (ex: œufs, lait, beurre, fromages), on les utilise → données
//      précises (référence grande surface FR 2025-2026).
//   2. Sinon, on tombe sur les packs par sous-catégorie
//      (`defaultPacksByCategory.js`) → couvre tous les ingrédients
//      avec des conditionnements plausibles.
//
// Renvoie toujours un tableau non vide (au pire, fallback 'other').
//
// `subcat` peut être null si l'arbre INGREDIENTS n'a pas associé
// l'ingrédient à une sous-catégorie reconnue → le fallback 'other'
// s'applique automatiquement.
export function getPacksForIngredient(ingredientId, lang = 'fr', subcat = null) {
  if (!ingredientId) return getDefaultPacksFor(subcat)

  // 1. Packs spécifiques (référence grande surface FR précise)
  const specific = getPacksFor(ingredientId, lang)
  if (specific.length > 0) return specific

  // 2. Fallback par sous-catégorie (packs plausibles)
  return getDefaultPacksFor(subcat)
}

// ─── Constantes rayons ────────────────────────────────────────────────────────

export const AISLE_ORDER = [
  'produce', 'bakery', 'butcher', 'fishmonger', 'dairy',
  'vegan', 'grocery', 'condiments', 'oils', 'frozen', 'other',
]

export const AISLE_BY_SUBCAT = {
  vegetables: 'produce', fruits: 'produce', 'tropical-fruits': 'produce',
  bread: 'bakery',
  meat: 'butcher', deli: 'butcher',
  fish: 'fishmonger',
  dairy: 'dairy', cheese: 'dairy', eggs: 'dairy',
  bof: 'dairy',  // bac Beurre·Œufs·Fromage (agrégat frigo) → rayon Crèmerie & Œufs

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
  fr: {
    produce: 'Fruits & Légumes', bakery: 'Boulangerie', butcher: 'Boucherie & Charcuterie',
    fishmonger: 'Poissonnerie', dairy: 'Crèmerie & Œufs', vegan: 'Végé & Bio',
    grocery: 'Épicerie', condiments: 'Condiments & Épices', oils: 'Huiles & Vinaigres',
    frozen: 'Surgelés', other: 'Autres',
  },
  en: {
    produce: 'Fruit & Vegetables', bakery: 'Bakery', butcher: 'Meat & Deli',
    fishmonger: 'Fishmonger', dairy: 'Dairy & Eggs', vegan: 'Vegan & Organic',
    grocery: 'Grocery', condiments: 'Condiments & Spices', oils: 'Oils & Vinegars',
    frozen: 'Frozen', other: 'Other',
  },
}

export function getAisleForSubcat(subcat) {
  return AISLE_BY_SUBCAT[subcat] ?? 'other'
}

// ─── Groupement par recette ───────────────────────────────────────────────────

export function groupByRecipe(basket) {
  const map = new Map()
  basket.forEach(item => {
    if (!item.recipe_id) return
    if (!map.has(item.recipe_id)) {
      map.set(item.recipe_id, {
        recipe_id: item.recipe_id,
        recipe_name: item.recipe_name,
        recipe_emoji: item.recipe_emoji,
        items: [],
      })
    }
    map.get(item.recipe_id).items.push(item)
  })
  return [...map.values()]
}

// ─── Smart auto-détection de la phase active ─────────────────────────────────
//
// Règles :
//   0 items OU 0 cochés          → 'prepare'
//   ≥1 coché et < total          → 'shopping'
//   100% cochés (total > 0)      → 'home'
export function detectCartPhase(items, checkedCount) {
  if (items.length === 0 || checkedCount === 0) return 'prepare'
  if (checkedCount >= items.length) return 'home'
  return 'shopping'
}

// ─── Consolidation par rayon ──────────────────────────────────────────────────
//
// Fusionne les rows du basket par (ingredient_id, unité de base), regroupe
// par rayon, trie alphabétiquement. Pour les unités convertibles (kg↔g, L↔ml),
// normalise vers l'unité de base avant fusion. Sinon, rows séparés.

const UNIT_TO_BASE = { kg: 'g', g: 'g', L: 'ml', l: 'ml', cl: 'ml', ml: 'ml', pcs: 'pcs' }
const UNIT_FACTOR  = { kg: 1000, g: 1, L: 1000, l: 1000, cl: 10, ml: 1, pcs: 1 }

function toBaseAmount(amount, unit) {
  const base = UNIT_TO_BASE[unit] ?? unit
  const factor = UNIT_FACTOR[unit] ?? 1
  return { amount: amount * factor, unit: base }
}

// Accepte une Map<id, ingredient> (forme actuelle exposée par createIngredientLookup.byId)
// ou un plain object { id: ingredient } (forme test-friendly). Retourne null si miss.
function lookupIngredient(ingredientsById, id) {
  if (!ingredientsById || !id) return null
  if (typeof ingredientsById.get === 'function') return ingredientsById.get(id) ?? null
  return ingredientsById[id] ?? null
}

// Renvoie la sous-catégorie d'un ingrédient. Pour les ingrédients chargés via
// createIngredientLookup, la subcat n'est PAS stockée sur l'item lui-même
// (l'arbre INGREDIENTS est structuré par subcat en clé). On laisse l'appelant
// fournir un `subcatIndex` (Map<id, subcat>) optionnel pour la résolution.
function lookupSubcat(ingredientsById, subcatIndex, id, row) {
  if (subcatIndex && typeof subcatIndex.get === 'function') {
    const v = subcatIndex.get(id)
    if (v) return v
  }
  const meta = lookupIngredient(ingredientsById, id)
  return meta?.subcat ?? row?.subcat ?? null
}

export function groupByAisleConsolidated(basket, ingredientsById = undefined, lang = 'fr', subcatIndex = undefined) {
  if (!Array.isArray(basket) || basket.length === 0) return []

  // 1. Bucket par (ingredient_id + base unit)
  // Lookup canonique : si ingredientsById est fourni, on l'utilise pour
  // récupérer le label/emoji propres à l'ingrédient au lieu des valeurs
  // brutes du row (qui contiennent des libellés recette type « 1 kg de
  // pommes de terre »). Le subcat vient de subcatIndex (clé de l'arbre
  // INGREDIENTS) qui n'est PAS stocké sur l'item lui-même.
  const bucket = new Map()
  for (const row of basket) {
    if (!row?.ingredient_id) continue
    const meta = lookupIngredient(ingredientsById, row.ingredient_id)
    const canonicalLabel = meta?.labels?.[lang] ?? meta?.labels?.fr ?? row.label
    const canonicalSubcat = lookupSubcat(ingredientsById, subcatIndex, row.ingredient_id, row)
    const canonicalEmoji  = meta?.emoji ?? row.emoji ?? null
    const { amount: baseAmount, unit: baseUnit } = toBaseAmount(row.amount ?? 0, row.unit ?? 'pcs')
    const key = `${row.ingredient_id}::${baseUnit}`
    if (!bucket.has(key)) {
      bucket.set(key, {
        ingredient_id: row.ingredient_id,
        label: canonicalLabel,
        emoji: canonicalEmoji,
        subcat: canonicalSubcat,
        totalAmount: 0,
        unit: baseUnit,
        // basePrice = coût basé sur la quantité nécessaire (somme des prix des
        // rows). Sert de fallback budget quand aucun pack n'est explicitement
        // choisi pour cet ingrédient consolidé. Le choix de pack (côté UI,
        // par ingrédient) prime via getIngredientBuyPrice().
        basePrice: 0,
        sources: [],
        rowIds: [],
      })
    }
    const entry = bucket.get(key)
    entry.totalAmount += baseAmount
    entry.basePrice += row.price ?? 0
    entry.rowIds.push(row.id)
    if (row.recipe_id) {
      entry.sources.push({
        recipe_id: row.recipe_id,
        recipe_name: row.recipe_name,
        amount: baseAmount,
      })
    } else {
      entry.sources.push({ manual: true, amount: baseAmount })
    }
  }

  // 2. Regroupement par rayon
  const aislesMap = new Map()
  for (const entry of bucket.values()) {
    const aisle = getAisleForSubcat(entry.subcat)
    if (!aislesMap.has(aisle)) {
      aislesMap.set(aisle, {
        aisle,
        aisleLabel: AISLE_LABELS[lang]?.[aisle] ?? AISLE_LABELS.fr[aisle] ?? aisle,
        aisleEmoji: AISLE_EMOJI[aisle] ?? '📦',
        ingredients: [],
      })
    }
    aislesMap.get(aisle).ingredients.push(entry)
  }

  // 3. Tri alpha à l'intérieur de chaque rayon (locale-aware)
  const collator = new Intl.Collator(lang, { sensitivity: 'base' })
  for (const group of aislesMap.values()) {
    group.ingredients.sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''))
  }

  // 4. Tri des rayons selon AISLE_ORDER
  return AISLE_ORDER
    .map(aisle => aislesMap.get(aisle))
    .filter(Boolean)
}

// ─── Prix unitaire normalisé pour comparaison entre packs ──────────────────────

// Prix unitaire normalisé pour comparaison entre packs.
//   g, kg  → €/kg
//   ml, cl, L → €/L
//   pcs → €/pcs
export function getUnitPrice(pack) {
  if (!pack || pack.price == null) return null
  const { size, unit, price } = pack
  if (size <= 0) return null
  if (unit === 'g' || unit === 'kg') {
    const grams = unit === 'kg' ? size * 1000 : size
    return { value: Math.round((price / grams) * 1000 * 100) / 100, unit: '€/kg' }
  }
  if (unit === 'ml' || unit === 'cl' || unit === 'L' || unit === 'l') {
    const ml = unit === 'L' || unit === 'l' ? size * 1000 : unit === 'cl' ? size * 10 : size
    return { value: Math.round((price / ml) * 1000 * 100) / 100, unit: '€/L' }
  }
  return { value: Math.round((price / size) * 100) / 100, unit: '€/pcs' }
}

// ─── Prix d'achat consolidé (fix BUG-A8) ────────────────────────────────────
//
// Le pack est un choix d'ACHAT par ingrédient consolidé (PAS écrit dans les
// rows source — sinon la quantité/prix se multiplie pour les ingrédients
// multi-recettes, c'était le bug A8). `packChoice` = { pack, multiplier } tenu
// en état UI, indexé par ingredient_id.
//
//   - pack choisi   → prix réel = pack.price × multiplicateur
//   - sinon         → fallback basePrice (coût basé sur la quantité nécessaire)
export function getIngredientBuyPrice(entry, packChoice) {
  if (packChoice?.pack?.price != null) {
    const mult = packChoice.multiplier ?? 1
    return Math.round(packChoice.pack.price * mult * 100) / 100
  }
  return Math.round((entry?.basePrice ?? 0) * 100) / 100
}

// Budget total = somme des prix d'achat de chaque ingrédient consolidé.
// `packChoices` : map { [ingredient_id]: { pack, multiplier } }.
export function computeBasketBudget(aisles, packChoices = {}) {
  let total = 0
  for (const group of aisles ?? []) {
    for (const entry of group.ingredients) {
      total += getIngredientBuyPrice(entry, packChoices[entry.ingredient_id])
    }
  }
  return Math.round(total * 100) / 100
}
