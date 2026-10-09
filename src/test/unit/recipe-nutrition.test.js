// Tests pour computeRecipeNutrition (shared helper extrait depuis recipe-to-schema-org.js).
// Refonte Recettes Phase 10b.3.
//
// Depuis le refactor « nutrition = source unique BDD », computeRecipeNutrition
// lit la nutrition exclusivement via `ingredientsById` (plus de fallback sur la
// table statique). Les tests de calcul injectent donc une map BDD factice.

import { describe, it, expect } from 'vitest'
import { computeRecipeNutrition } from '../../shared/lib/recipes/recipe-nutrition'

// frz-poulet : { cal: 120, prot: 18, carb: 0, fat: 5, fib: 0 } pour 100g.
const POULET_NUT = { cal: 120, prot: 18, carb: 0, fat: 5, fib: 0, al: [] }
const byId = new Map([['frz-poulet', { id: 'frz-poulet', nutrition: POULET_NUT }]])

const recipeWithPoulet = {
  id: 'test-poulet',
  servings: 2,
  ingredients: [
    { ids: ['frz-poulet'], qty: { amount: 200, unit: 'g' }, required: true },
  ],
}

describe('computeRecipeNutrition', () => {
  it('happy path — calcule correctement par portion', () => {
    const result = computeRecipeNutrition(recipeWithPoulet, byId)
    expect(result).not.toBeNull()
    // frz-poulet : cal=120 pour 100g. 200g = 240 cal total / 2 portions = 120 kcal/portion
    expect(result.kcal).toBeCloseTo(120, 1)
    // prot=18 pour 100g. 200g = 36g total / 2 portions = 18g/portion
    expect(result.protein).toBeCloseTo(18, 1)
    expect(result.carbs).toBeCloseTo(0, 1)
    expect(result.fat).toBeCloseTo(5, 1)
    expect(result.fiber).toBeCloseTo(0, 1)
  })

  it('recette sans servings → null', () => {
    const recipe = { id: 'x', ingredients: [{ ids: ['frz-poulet'], qty: { amount: 100, unit: 'g' } }] }
    expect(computeRecipeNutrition(recipe, byId)).toBeNull()
  })

  it('recette avec servings=0 → null', () => {
    const recipe = { id: 'x', servings: 0, ingredients: [{ ids: ['frz-poulet'], qty: { amount: 100, unit: 'g' } }] }
    expect(computeRecipeNutrition(recipe, byId)).toBeNull()
  })

  it('recette avec ingrédients sans données BDD → null', () => {
    const recipe = {
      servings: 2,
      ingredients: [
        { ids: ['ingredient-inconnu-xyz'], qty: { amount: 100, unit: 'g' } },
      ],
    }
    expect(computeRecipeNutrition(recipe, byId)).toBeNull()
  })

  it('unités exotiques (pcs) → ignorées, mais autres ingrédients comptent', () => {
    const recipe = {
      servings: 1,
      ingredients: [
        { ids: ['frz-poulet'], qty: { amount: 100, unit: 'g' }, required: true },
        { ids: ['frz-poulet'], qty: { amount: 2, unit: 'pcs' }, required: false }, // pcs → 0g → ignoré
      ],
    }
    const result = computeRecipeNutrition(recipe, byId)
    expect(result).not.toBeNull()
    // Seule la ligne 100g est comptée : cal=120/portion
    expect(result.kcal).toBeCloseTo(120, 1)
  })

  it('quantité nulle ou négative → ignorée', () => {
    const recipe = {
      servings: 1,
      ingredients: [
        { ids: ['frz-poulet'], qty: { amount: 0, unit: 'g' } },
      ],
    }
    expect(computeRecipeNutrition(recipe, byId)).toBeNull()
  })

  it('ingrédients mixtes connus/inconnus — seuls les connus comptent', () => {
    const recipe = {
      servings: 2,
      ingredients: [
        { ids: ['frz-poulet'], qty: { amount: 200, unit: 'g' } },
        { ids: ['ingredient-inconnu-xyz'], qty: { amount: 100, unit: 'g' } },
      ],
    }
    const result = computeRecipeNutrition(recipe, byId)
    expect(result).not.toBeNull()
    expect(result.kcal).toBeCloseTo(120, 1) // même que poulet seul
  })

  it('supporte le format enrichi v2 (groups)', () => {
    // frz-poulet : cal=120, prot=18, carb=0, fat=5, fib=0 pour 100g
    // 200g → 240 kcal total / 2 portions = 120 kcal/portion
    const recipe = {
      servings: 2,
      ingredients: {
        groups: [
          {
            name: { fr: 'Pour la sauce' },
            items: [{ id: 'frz-poulet', amount: 200, unit: 'g' }],
          },
        ],
      },
    }
    const n = computeRecipeNutrition(recipe, byId)
    expect(n).not.toBeNull()
    expect(n.kcal).toBeCloseTo(120, 1)
    expect(n.protein).toBeCloseTo(18, 1)
  })

  it('format v2 multi-groupes — agrège tous les groupes', () => {
    // 2 × 100g frz-poulet (un par groupe) → 240 kcal total / 2 portions = 120 kcal/portion
    const recipe = {
      servings: 2,
      ingredients: {
        groups: [
          { name: { fr: 'G1' }, items: [{ id: 'frz-poulet', amount: 100, unit: 'g' }] },
          { name: { fr: 'G2' }, items: [{ id: 'frz-poulet', amount: 100, unit: 'g' }] },
        ],
      },
    }
    const n = computeRecipeNutrition(recipe, byId)
    expect(n).not.toBeNull()
    expect(n.kcal).toBeCloseTo(120, 1)
  })

  it('utilise la nutrition BDD quand ingredientsById est fourni', () => {
    const recipe = { servings: 1, ingredients: [{ ids: ['frz-poulet'], qty: { amount: 100, unit: 'g' } }] }
    const byIdHigh = new Map([['frz-poulet', { id: 'frz-poulet', nutrition: { cal: 500, prot: 0, carb: 0, fat: 0, fib: 0, al: [] } }]])
    expect(computeRecipeNutrition(recipe, byIdHigh).kcal).toBe(500)
  })

  it('ingrédient absent de la BDD → null (plus de fallback statique)', () => {
    const recipe = { servings: 1, ingredients: [{ ids: ['frz-poulet'], qty: { amount: 100, unit: 'g' } }] }
    const emptyById = new Map() // frz-poulet absent de la BDD → aucune donnée nutritionnelle
    expect(computeRecipeNutrition(recipe, emptyById)).toBeNull()
  })
})
