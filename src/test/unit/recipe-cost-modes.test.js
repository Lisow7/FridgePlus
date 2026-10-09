// Tests pour calcRecipeCostByMode (3 modes + Q Factor).
// Refonte Recettes Phase 12.a — D20 simplifié.

import { describe, it, expect } from 'vitest'
import { calcRecipeCostByMode, COST_MODES } from '../../shared/lib/recipes/recipe-utils'

// Mock catalogue ingrédients : prix au /100g par lang
const catalogue = new Map([
  ['gp-pates',   { price: { fr: 0.30 } }],   // 0.30 €/100g
  ['fr-poulet',  { price: { fr: 1.20 } }],   // 1.20 €/100g
  ['gp-tomate',  { price: { fr: 0.40 } }],   // 0.40 €/100g
])

// Recette test : 4 portions, 3 ingrédients required
const baseRecipe = {
  id: 'r-test',
  servings: 4,
  ingredients: [
    { ids: ['gp-pates'],  qty: { amount: 400, unit: 'g' }, required: true },  // 400g × 0.30/100 = 1.20€
    { ids: ['fr-poulet'], qty: { amount: 300, unit: 'g' }, required: true },  // 300g × 1.20/100 = 3.60€
    { ids: ['gp-tomate'], qty: { amount: 200, unit: 'g' }, required: false }, // 200g × 0.40/100 = 0.80€
  ],
}
// Total attendu : 1.20 + 3.60 + 0.80 = 5.60€

describe('calcRecipeCostByMode — mode total', () => {
  it('calcule le coût total brut par défaut', () => {
    const cost = calcRecipeCostByMode(baseRecipe, { ingredientsById: catalogue })
    expect(cost).toBeCloseTo(5.60, 1)
  })

  it('respecte scaleFactor (×2 → coût doublé)', () => {
    const cost = calcRecipeCostByMode(baseRecipe, { ingredientsById: catalogue, scaleFactor: 2 })
    expect(cost).toBeCloseTo(11.20, 1)
  })

  it('retourne null si aucun prix dispo', () => {
    const cost = calcRecipeCostByMode(baseRecipe, { ingredientsById: new Map() })
    expect(cost).toBeNull()
  })
})

describe('calcRecipeCostByMode — mode per_serving', () => {
  it('calcule total / servings', () => {
    const cost = calcRecipeCostByMode(baseRecipe, {
      mode: COST_MODES.PER_SERVING,
      ingredientsById: catalogue,
    })
    expect(cost).toBeCloseTo(5.60 / 4, 2) // 1.40€/portion
  })

  it('retourne null si servings absent', () => {
    const recipe = { ...baseRecipe, servings: null }
    const cost = calcRecipeCostByMode(recipe, {
      mode: COST_MODES.PER_SERVING,
      ingredientsById: catalogue,
    })
    expect(cost).toBeNull()
  })

  it('retourne null si servings = 0', () => {
    const recipe = { ...baseRecipe, servings: 0 }
    const cost = calcRecipeCostByMode(recipe, {
      mode: COST_MODES.PER_SERVING,
      ingredientsById: catalogue,
    })
    expect(cost).toBeNull()
  })
})

describe('calcRecipeCostByMode — mode marginal (frigo-aware)', () => {
  it('coût des required ingredients NON en stock', () => {
    // Stock contient pates → marginal = poulet uniquement (tomate non required)
    const stock = new Set(['gp-pates'])
    const cost = calcRecipeCostByMode(baseRecipe, {
      mode: COST_MODES.MARGINAL,
      ingredientsById: catalogue,
      stock,
    })
    expect(cost).toBeCloseTo(3.60, 1) // juste le poulet
  })

  it('coût = total si stock vide', () => {
    const cost = calcRecipeCostByMode(baseRecipe, {
      mode: COST_MODES.MARGINAL,
      ingredientsById: catalogue,
      stock: new Set(),
    })
    // 2 required (pates + poulet) en marginal, tomate exclue car required=false
    expect(cost).toBeCloseTo(1.20 + 3.60, 1)
  })

  it('coût = 0 si tous required sont en stock', () => {
    const stock = new Set(['gp-pates', 'fr-poulet'])
    const cost = calcRecipeCostByMode(baseRecipe, {
      mode: COST_MODES.MARGINAL,
      ingredientsById: catalogue,
      stock,
    })
    expect(cost).toBeNull() // calcMissingCost retourne null si hasPrice=false (rien à acheter)
  })

  it('retourne null si stock pas fourni', () => {
    const cost = calcRecipeCostByMode(baseRecipe, {
      mode: COST_MODES.MARGINAL,
      ingredientsById: catalogue,
      // stock manquant
    })
    expect(cost).toBeNull()
  })
})

describe('calcRecipeCostByMode — Q Factor', () => {
  it('qFactor=1 (default) → pas de modification', () => {
    const cost = calcRecipeCostByMode(baseRecipe, { ingredientsById: catalogue })
    expect(cost).toBeCloseTo(5.60, 1)
  })

  it('qFactor=1.10 → coût × 1.10 (10% waste)', () => {
    const cost = calcRecipeCostByMode(baseRecipe, {
      ingredientsById: catalogue,
      qFactor: 1.10,
    })
    expect(cost).toBeCloseTo(5.60 * 1.10, 1)
  })

  it('qFactor=1.05 → coût × 1.05 (5% waste sit-down)', () => {
    const cost = calcRecipeCostByMode(baseRecipe, {
      ingredientsById: catalogue,
      qFactor: 1.05,
    })
    expect(cost).toBeCloseTo(5.60 * 1.05, 1)
  })

  it('qFactor s\'applique aussi en mode per_serving', () => {
    const cost = calcRecipeCostByMode(baseRecipe, {
      mode: COST_MODES.PER_SERVING,
      ingredientsById: catalogue,
      qFactor: 1.10,
    })
    expect(cost).toBeCloseTo((5.60 / 4) * 1.10, 2)
  })
})

describe('COST_MODES export', () => {
  it('expose les 3 constants modes', () => {
    expect(COST_MODES.TOTAL).toBe('total')
    expect(COST_MODES.PER_SERVING).toBe('per_serving')
    expect(COST_MODES.MARGINAL).toBe('marginal')
  })

  it('frozen (immutable)', () => {
    expect(Object.isFrozen(COST_MODES)).toBe(true)
  })
})
