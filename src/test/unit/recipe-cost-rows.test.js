// Tests unit — computeCostRows, logique de résolution de prix par ingrédient
// extraite de recipe-modal.jsx (audit front §2). On teste l'ORCHESTRATION
// (priorité BDD → live → pack, inStock, itemPrice null) en mockant les
// dépendances feuilles.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@shared/lib/recipes/recipe-ingredients', () => ({
  getIngredientItemsFlat: vi.fn(),
  getIngredientIds: vi.fn(ing => ing.ids),
  getIngredientQty: vi.fn(ing => ing.qty),
  isIngredientRequired: vi.fn(ing => ing.required),
}))
vi.mock('@shared/lib/recipes/recipe-utils', () => ({
  embeddedPricePer100g: vi.fn(),
  // export réel = `toGrams` (recipe-cost-rows l'importe `toGrams as sharedToGrams`).
  // simplifie : 1 unité = 1 g (grams == amount), pour des calculs prévisibles
  toGrams: vi.fn((amount) => amount),
  formatQty: vi.fn((amount, unit) => `${amount}${unit}`),
}))
vi.mock('@shared/static/pack-sizes', () => ({ PACK_SIZES: {} }))

import { computeCostRows } from '@features/recipes/lib/recipe-cost-rows'
import { getIngredientItemsFlat } from '@shared/lib/recipes/recipe-ingredients'
import { embeddedPricePer100g } from '@shared/lib/recipes/recipe-utils'
import { PACK_SIZES } from '@shared/static/pack-sizes'

const ing = (over = {}) => ({ ids: ['a'], qty: { amount: 100, unit: 'g' }, required: true, labels: { fr: 'Beurre' }, ...over })
const base = { recipe: {}, lang: 'fr', ingredientsById: new Map(), livePrices: {}, scaleFactor: 1, stock: new Set() }

beforeEach(() => {
  vi.clearAllMocks()
  embeddedPricePer100g.mockReturnValue(0)
  for (const k of Object.keys(PACK_SIZES)) delete PACK_SIZES[k]
})

describe('computeCostRows', () => {
  it('priorité 1 — prix BDD : itemPrice calculé, isLive false', () => {
    getIngredientItemsFlat.mockReturnValue([ing()])
    embeddedPricePer100g.mockReturnValue(2) // 2 €/100g
    const [row] = computeCostRows(base)
    expect(row.itemPrice).toBe(2) // 2 * 100g / 100
    expect(row.isLive).toBe(false)
    expect(row.label).toBe('Beurre')
    expect(row.required).toBe(true)
  })

  it('priorité 2 — prix live quand pas de BDD : isLive true', () => {
    getIngredientItemsFlat.mockReturnValue([ing()])
    const [row] = computeCostRows({ ...base, livePrices: { a: 3 } })
    expect(row.itemPrice).toBe(3)
    expect(row.isLive).toBe(true)
  })

  it('priorité 3 — fallback PACK_SIZES (pack le moins cher) quand ni BDD ni live', () => {
    getIngredientItemsFlat.mockReturnValue([ing()])
    PACK_SIZES.a = { fr: [{ size: 250, unit: 'g', price: 5 }] } // 5/250*100 = 2 €/100g
    const [row] = computeCostRows(base)
    expect(row.itemPrice).toBe(2)
    expect(row.isLive).toBe(false)
  })

  it('itemPrice null quand aucun prix disponible', () => {
    getIngredientItemsFlat.mockReturnValue([ing()])
    const [row] = computeCostRows(base)
    expect(row.itemPrice).toBeNull()
  })

  it('inStock true quand un des ids est dans le stock', () => {
    getIngredientItemsFlat.mockReturnValue([ing({ ids: ['a', 'b'] })])
    const [row] = computeCostRows({ ...base, stock: new Set(['b']) })
    expect(row.inStock).toBe(true)
  })

  it('applique le scaleFactor au prix', () => {
    getIngredientItemsFlat.mockReturnValue([ing()])
    embeddedPricePer100g.mockReturnValue(2)
    const [row] = computeCostRows({ ...base, scaleFactor: 2 })
    expect(row.itemPrice).toBe(4) // 2 €/100g * 100g * 2 portions
  })
})
