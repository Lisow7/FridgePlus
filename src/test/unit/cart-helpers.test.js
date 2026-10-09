import { describe, it, expect } from 'vitest'
import {
  AISLE_ORDER,
  AISLE_BY_SUBCAT,
  getAisleForSubcat,
  groupByRecipe,
  detectCartPhase,
  groupByAisleConsolidated,
  getUnitPrice,
  getIngredientBuyPrice,
  computeBasketBudget,
} from '@features/cart/lib/cart-helpers'

describe('getAisleForSubcat', () => {
  it('retourne le rayon pour une sous-cat connue', () => {
    expect(getAisleForSubcat('vegetables')).toBe('produce')
    expect(getAisleForSubcat('meat')).toBe('butcher')
    expect(getAisleForSubcat('dairy')).toBe('dairy')
    expect(getAisleForSubcat('bread')).toBe('bakery')
  })
  it('retourne other pour une sous-cat inconnue', () => {
    expect(getAisleForSubcat('unknown')).toBe('other')
    expect(getAisleForSubcat(undefined)).toBe('other')
    expect(getAisleForSubcat(null)).toBe('other')
  })
})

describe('AISLE_ORDER', () => {
  it('contient 11 rayons dans le bon ordre', () => {
    expect(AISLE_ORDER).toHaveLength(11)
    expect(AISLE_ORDER[0]).toBe('produce')
    expect(AISLE_ORDER[AISLE_ORDER.length - 1]).toBe('other')
  })
  it('tous les rayons de AISLE_BY_SUBCAT sont dans AISLE_ORDER', () => {
    const aisleSet = new Set(AISLE_ORDER)
    Object.values(AISLE_BY_SUBCAT).forEach(aisle => {
      expect(aisleSet.has(aisle)).toBe(true)
    })
  })
})

describe('groupByRecipe', () => {
  it('groupe les items par recipe_id', () => {
    const basket = [
      { id: '1', recipe_id: 'r1', recipe_name: 'Pâtes', recipe_emoji: '🍝', label: 'Pâtes' },
      { id: '2', recipe_id: 'r1', recipe_name: 'Pâtes', recipe_emoji: '🍝', label: 'Œufs' },
      { id: '3', recipe_id: null, label: 'Pain' },
    ]
    const result = groupByRecipe(basket)
    expect(result).toHaveLength(1)
    expect(result[0].recipe_id).toBe('r1')
    expect(result[0].items).toHaveLength(2)
  })
  it('ignore les items sans recipe_id', () => {
    const basket = [
      { id: '1', recipe_id: null, label: 'Pain' },
      { id: '2', recipe_id: undefined, label: 'Sel' },
    ]
    expect(groupByRecipe(basket)).toHaveLength(0)
  })
  it('retourne [] pour panier vide', () => {
    expect(groupByRecipe([])).toHaveLength(0)
  })
  it('gère plusieurs recettes distinctes', () => {
    const basket = [
      { id: '1', recipe_id: 'r1', recipe_name: 'Pâtes', recipe_emoji: '🍝', label: 'A' },
      { id: '2', recipe_id: 'r2', recipe_name: 'Soupe', recipe_emoji: '🍜', label: 'B' },
    ]
    const result = groupByRecipe(basket)
    expect(result).toHaveLength(2)
  })
})

describe('detectCartPhase', () => {
  it('retourne prepare si 0 items', () => {
    expect(detectCartPhase([], 0)).toBe('prepare')
  })
  it('retourne prepare si items mais 0 cochés', () => {
    expect(detectCartPhase([{}, {}], 0)).toBe('prepare')
  })
  it('retourne shopping si ≥1 coché et < total', () => {
    expect(detectCartPhase([{}, {}], 1)).toBe('shopping')
    expect(detectCartPhase([{}, {}, {}], 2)).toBe('shopping')
  })
  it('retourne home si 100% cochés', () => {
    expect(detectCartPhase([{}, {}], 2)).toBe('home')
    expect(detectCartPhase([{}], 1)).toBe('home')
  })
  it('retourne home si checkedCount > items.length', () => {
    expect(detectCartPhase([{}], 5)).toBe('home')
  })
})

describe('groupByAisleConsolidated', () => {
  it('returns [] for empty basket', () => {
    expect(groupByAisleConsolidated([])).toEqual([])
  })

  it('consolidates same ingredient_id+unit across recipes', () => {
    const basket = [
      { id: 'r1', recipe_id: 'spaghetti', recipe_name: 'Spaghetti', ingredient_id: 'fr-tomate', label: 'Tomates', amount: 200, unit: 'g', subcat: 'vegetables' },
      { id: 'r2', recipe_id: 'cesar', recipe_name: 'César', ingredient_id: 'fr-tomate', label: 'Tomates', amount: 300, unit: 'g', subcat: 'vegetables' },
    ]
    const result = groupByAisleConsolidated(basket)
    expect(result).toHaveLength(1)
    expect(result[0].aisle).toBe('produce')
    expect(result[0].ingredients).toHaveLength(1)
    const ing = result[0].ingredients[0]
    expect(ing.ingredient_id).toBe('fr-tomate')
    expect(ing.totalAmount).toBe(500)
    expect(ing.unit).toBe('g')
    expect(ing.sources).toHaveLength(2)
    expect(ing.rowIds).toEqual(['r1', 'r2'])
  })

  it('keeps rows separated when units differ and are not convertible', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-tomate', label: 'Tomates', amount: 2, unit: 'pcs', subcat: 'vegetables' },
      { id: 'r2', recipe_id: 'b', ingredient_id: 'fr-tomate', label: 'Tomates', amount: 300, unit: 'g', subcat: 'vegetables' },
    ]
    const result = groupByAisleConsolidated(basket)
    expect(result[0].ingredients).toHaveLength(2)
  })

  it('normalises kg to g and L to ml when grouping', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-farine', label: 'Farine', amount: 500, unit: 'g', subcat: 'dry' },
      { id: 'r2', recipe_id: 'b', ingredient_id: 'fr-farine', label: 'Farine', amount: 1, unit: 'kg', subcat: 'dry' },
    ]
    const result = groupByAisleConsolidated(basket)
    expect(result[0].ingredients).toHaveLength(1)
    expect(result[0].ingredients[0].totalAmount).toBe(1500)
    expect(result[0].ingredients[0].unit).toBe('g')
  })

  it('marks manual items in sources', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', recipe_name: 'A', ingredient_id: 'fr-pain', label: 'Pain', amount: 1, unit: 'pcs', subcat: 'bread' },
      { id: 'r2', recipe_id: null, recipe_name: null, ingredient_id: 'fr-pain', label: 'Pain', amount: 1, unit: 'pcs', subcat: 'bread' },
    ]
    const result = groupByAisleConsolidated(basket)
    const sources = result[0].ingredients[0].sources
    expect(sources).toHaveLength(2)
    expect(sources.some(s => s.manual === true)).toBe(true)
  })

  it('sorts ingredients alphabetically inside an aisle (fr locale)', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-tomate', label: 'Tomates', amount: 1, unit: 'pcs', subcat: 'vegetables' },
      { id: 'r2', recipe_id: 'a', ingredient_id: 'fr-aubergine', label: 'Aubergines', amount: 1, unit: 'pcs', subcat: 'vegetables' },
      { id: 'r3', recipe_id: 'a', ingredient_id: 'fr-courgette', label: 'Courgettes', amount: 1, unit: 'pcs', subcat: 'vegetables' },
    ]
    const result = groupByAisleConsolidated(basket, undefined, 'fr')
    const labels = result[0].ingredients.map(i => i.label)
    expect(labels).toEqual(['Aubergines', 'Courgettes', 'Tomates'])
  })

  it('orders aisles per AISLE_ORDER', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-pain', label: 'Pain', amount: 1, unit: 'pcs', subcat: 'bread' },
      { id: 'r2', recipe_id: 'a', ingredient_id: 'fr-tomate', label: 'Tomates', amount: 1, unit: 'pcs', subcat: 'vegetables' },
    ]
    const result = groupByAisleConsolidated(basket)
    expect(result.map(g => g.aisle)).toEqual(['produce', 'bakery'])
  })

  it('skips aisles with no surviving ingredients', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-tomate', label: 'Tomates', amount: 1, unit: 'pcs', subcat: 'vegetables' },
    ]
    const result = groupByAisleConsolidated(basket)
    // Only 'produce' should be returned, no empty 'bakery' / 'other'.
    expect(result.map(g => g.aisle)).toEqual(['produce'])
  })

  // ── Lookup ingredientsById : override label brut + subcat manquant ───────
  // Résout BUG-A1 (rayon AUTRES) + BUG-A2 (doublons) + demande UX
  // (titre = nom canonique de l'ingrédient, pas le libellé brut recette).

  it('overrides row.label with canonical label from ingredientsById', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-tomate', label: '1 kg de tomates (ou 800g en boîte)', amount: 1000, unit: 'g', subcat: null },
    ]
    const ingredientsById = {
      'fr-tomate': { id: 'fr-tomate', labels: { fr: 'Tomates', en: 'Tomatoes' }, subcat: 'vegetables', emoji: '🍅' },
    }
    const result = groupByAisleConsolidated(basket, ingredientsById, 'fr')
    expect(result[0].aisle).toBe('produce')
    expect(result[0].ingredients[0].label).toBe('Tomates')
    expect(result[0].ingredients[0].emoji).toBe('🍅')
  })

  it('uses canonical subcat from ingredientsById when row.subcat is missing', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-oignon', label: '1 oignon', amount: 700, unit: 'g', subcat: null },
      { id: 'r2', recipe_id: 'b', ingredient_id: 'fr-oignon', label: '1 oignon', amount: 1, unit: 'pcs', subcat: null },
    ]
    const ingredientsById = {
      'fr-oignon': { id: 'fr-oignon', labels: { fr: 'Oignon' }, subcat: 'vegetables', emoji: '🧅' },
    }
    const result = groupByAisleConsolidated(basket, ingredientsById, 'fr')
    expect(result).toHaveLength(1)
    expect(result[0].aisle).toBe('produce')
    // 2 sources avec unités différentes (g vs pcs) restent séparées
    // mais elles partagent le même nom canonique et le même rayon
    expect(result[0].ingredients.every(i => i.label === 'Oignon')).toBe(true)
  })

  it('falls back to row.label / row.subcat when ingredientsById lookup misses', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-unknown', label: 'Mystère', amount: 1, unit: 'pcs', subcat: 'vegetables' },
    ]
    const ingredientsById = {} // pas d'entrée pour fr-unknown
    const result = groupByAisleConsolidated(basket, ingredientsById, 'fr')
    expect(result[0].aisle).toBe('produce')
    expect(result[0].ingredients[0].label).toBe('Mystère')
  })

  it('supports Map<id, ingredient> as ingredientsById (real prod shape)', () => {
    // createIngredientLookup.byId est une Map JS, pas un plain object.
    // Le helper doit gérer les deux formes (regression v0.16.x).
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-oignon', label: '1 oignon', amount: 700, unit: 'g', subcat: null },
    ]
    const ingredientsById = new Map([
      ['fr-oignon', { id: 'fr-oignon', labels: { fr: 'Oignon' }, emoji: '🧅' }],
    ])
    const subcatById = new Map([['fr-oignon', 'vegetables']])
    const result = groupByAisleConsolidated(basket, ingredientsById, 'fr', subcatById)
    expect(result[0].aisle).toBe('produce')
    expect(result[0].ingredients[0].label).toBe('Oignon')
    expect(result[0].ingredients[0].emoji).toBe('🧅')
  })

  it('resolves subcat via subcatIndex when item itself has no subcat field', () => {
    // L'arbre INGREDIENTS structure la subcat en CLÉ (pas une prop de l'item).
    // Le subcatIndex Map<id, subcat> fournit le mapping nécessaire.
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-beurre', label: '60g de beurre', amount: 60, unit: 'g', subcat: null },
    ]
    const ingredientsById = new Map([
      ['fr-beurre', { id: 'fr-beurre', labels: { fr: 'Beurre' } }],
    ])
    const subcatById = new Map([['fr-beurre', 'dairy']])
    const result = groupByAisleConsolidated(basket, ingredientsById, 'fr', subcatById)
    expect(result[0].aisle).toBe('dairy')
    expect(result[0].ingredients[0].label).toBe('Beurre')
  })

  it('uses lang-specific canonical label', () => {
    const basket = [
      { id: 'r1', recipe_id: 'a', ingredient_id: 'fr-beurre', label: '60g de beurre', amount: 60, unit: 'g', subcat: null },
    ]
    const ingredientsById = {
      'fr-beurre': { id: 'fr-beurre', labels: { fr: 'Beurre', en: 'Butter' }, subcat: 'dairy' },
    }
    expect(groupByAisleConsolidated(basket, ingredientsById, 'en')[0].ingredients[0].label).toBe('Butter')
    expect(groupByAisleConsolidated(basket, ingredientsById, 'fr')[0].ingredients[0].label).toBe('Beurre')
  })
})

describe('getUnitPrice', () => {
  it('returns null when pack has no price', () => {
    expect(getUnitPrice({ size: 250, unit: 'g', price: null })).toBeNull()
    expect(getUnitPrice({ size: 250, unit: 'g' })).toBeNull()
  })

  it('returns price per kg for g packs', () => {
    // 250g for 0.60 € → 2.40 €/kg
    expect(getUnitPrice({ size: 250, unit: 'g', price: 0.60 })).toEqual({ value: 2.40, unit: '€/kg' })
  })

  it('returns price per kg for kg packs', () => {
    expect(getUnitPrice({ size: 1, unit: 'kg', price: 1.80 })).toEqual({ value: 1.80, unit: '€/kg' })
  })

  it('returns price per L for ml packs', () => {
    expect(getUnitPrice({ size: 500, unit: 'ml', price: 1.00 })).toEqual({ value: 2.00, unit: '€/L' })
  })

  it('returns price per L for cl packs', () => {
    expect(getUnitPrice({ size: 25, unit: 'cl', price: 0.50 })).toEqual({ value: 2.00, unit: '€/L' })
  })

  it('returns price per pcs for pcs packs', () => {
    expect(getUnitPrice({ size: 6, unit: 'pcs', price: 1.20 })).toEqual({ value: 0.20, unit: '€/pcs' })
  })

  it('rounds to 2 decimals', () => {
    expect(getUnitPrice({ size: 333, unit: 'g', price: 1.00 })).toEqual({ value: 3.00, unit: '€/kg' })
  })
})

describe('BUG-A8 — prix d\'achat consolidé (pack par ingrédient, pas par row)', () => {
  // Tomates dans 2 recettes = 2 rows du même ingrédient.
  const multiSourceBasket = [
    { id: 'r1', ingredient_id: 'vg-tomate', label: 'Tomates', amount: 200, unit: 'g', price: 0.40, recipe_id: 'a', recipe_name: 'Salade' },
    { id: 'r2', ingredient_id: 'vg-tomate', label: 'Tomates', amount: 300, unit: 'g', price: 0.60, recipe_id: 'b', recipe_name: 'Sauce' },
  ]

  it('groupByAisleConsolidated additionne basePrice par ingrédient', () => {
    const [aisle] = groupByAisleConsolidated(multiSourceBasket, undefined, 'fr')
    const entry = aisle.ingredients[0]
    expect(entry.totalAmount).toBe(500)        // 200 + 300 (besoin), PAS multiplié
    expect(entry.basePrice).toBeCloseTo(1.00)  // 0.40 + 0.60
    expect(entry.rowIds).toEqual(['r1', 'r2'])
  })

  it('getIngredientBuyPrice : sans pack → basePrice ; avec pack → pack.price × multiplicateur', () => {
    const entry = { basePrice: 1.00 }
    expect(getIngredientBuyPrice(entry, undefined)).toBe(1.00)
    expect(getIngredientBuyPrice(entry, { pack: { price: 1.50 }, multiplier: 1 })).toBe(1.50)
    expect(getIngredientBuyPrice(entry, { pack: { price: 1.50 }, multiplier: 2 })).toBe(3.00)
  })

  it('computeBasketBudget : choisir un pack sur un ingrédient MULTI-sources ne compte le pack qu\'UNE fois (fix A8)', () => {
    const aisles = groupByAisleConsolidated(multiSourceBasket, undefined, 'fr')
    // Sans choix de pack → fallback basePrice (1.00)
    expect(computeBasketBudget(aisles, {})).toBeCloseTo(1.00)
    // Avec un pack 500 g à 1,20 € choisi pour les tomates → 1,20 € (PAS 2,40 €)
    const budget = computeBasketBudget(aisles, { 'vg-tomate': { pack: { size: 500, unit: 'g', price: 1.20 }, multiplier: 1 } })
    expect(budget).toBeCloseTo(1.20)
  })

  it('computeBasketBudget : tolère aisles vide / null', () => {
    expect(computeBasketBudget([], {})).toBe(0)
    expect(computeBasketBudget(undefined, {})).toBe(0)
  })
})
