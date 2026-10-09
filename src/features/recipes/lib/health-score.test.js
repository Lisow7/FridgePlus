import { describe, it, expect } from 'vitest'
import { calcKcalPerServing, isHealthyRecipe } from './health-score'

const ingredientsById = new Map([
  ['fr-beurre', { id: 'fr-beurre', nutrition: { cal: 700 } }],
  ['gp-farine', { id: 'gp-farine', nutrition: { cal: 350 } }],
])

describe('calcKcalPerServing', () => {
  it('calcule les kcal par portion au format legacy (tableau)', () => {
    const recipe = {
      servings: 2,
      ingredients: [
        { ids: ['fr-beurre'], qty: { amount: 100, unit: 'g' } },
      ],
    }
    const result = calcKcalPerServing(recipe, ingredientsById)
    expect(result).toEqual({ hasData: true, kcalPerServing: 350 })
  })

  it('calcule les kcal par portion au format enrichi (groups/sub_recipes) sans planter', () => {
    const recipe = {
      servings: 2,
      ingredients: {
        groups: [
          { name: null, items: [{ id: 'fr-beurre', amount: 100, unit: 'g' }] },
          { name: { fr: 'Pour la sauce' }, items: [{ id: 'gp-farine', amount: 100, unit: 'g' }] },
        ],
        sub_recipes: [],
      },
    }
    const result = calcKcalPerServing(recipe, ingredientsById)
    expect(result).toEqual({ hasData: true, kcalPerServing: 525 })
  })

  it('recette sans ingrédients (format enrichi vide) → hasData false', () => {
    const recipe = { servings: 2, ingredients: { groups: [], sub_recipes: [] } }
    expect(calcKcalPerServing(recipe, ingredientsById)).toEqual({ hasData: false, kcalPerServing: 0 })
  })
})

describe('isHealthyRecipe', () => {
  it('format enrichi sous le seuil → true', () => {
    const recipe = {
      servings: 4,
      ingredients: { groups: [{ name: null, items: [{ id: 'gp-farine', amount: 100, unit: 'g' }] }], sub_recipes: [] },
    }
    expect(isHealthyRecipe(recipe, ingredientsById)).toBe(true)
  })
})
