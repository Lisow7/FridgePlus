import { describe, it, expect } from 'vitest'
import { isInSeason, recipeHasSeasonalIngredient } from '@shared/lib/ingredients/seasonality'

describe('isInSeason', () => {
  it('true si le mois est dans seasonal_months', () => {
    expect(isInSeason({ seasonal_months: [6, 7, 8] }, 7)).toBe(true)
  })

  it('false si le mois est absent de seasonal_months', () => {
    expect(isInSeason({ seasonal_months: [6, 7, 8] }, 1)).toBe(false)
  })

  it('false si seasonal_months est null (staple année-pleine)', () => {
    expect(isInSeason({ seasonal_months: null }, 7)).toBe(false)
  })
})

describe('recipeHasSeasonalIngredient', () => {
  const ingredientsById = new Map([
    ['vg-tomate', { seasonal_months: [6, 7, 8, 9] }],
    ['gp-farine', { seasonal_months: null }],
    ['fr-beurre', { seasonal_months: null }],
    ['fr-lait', { seasonal_months: null }],
  ])

  it('true si un ingrédient requis (format legacy) est de saison', () => {
    const recipe = { ingredients: [{ ids: ['vg-tomate'], required: true }] }
    expect(recipeHasSeasonalIngredient(recipe, ingredientsById, 7)).toBe(true)
  })

  it('false si aucun ingrédient requis n\'est de saison', () => {
    const recipe = { ingredients: [{ ids: ['gp-farine'], required: true }] }
    expect(recipeHasSeasonalIngredient(recipe, ingredientsById, 7)).toBe(false)
  })

  // Régression : format enrichi {groups, sub_recipes} crashait ici avec
  // "recipe.ingredients.some is not a function" — trouvé en test live 2026-07-14.
  it('ne crashe pas sur le format enrichi (groups + sub_recipes) et évalue les ingrédients de tous les groupes', () => {
    const recipe = {
      ingredients: {
        groups: [
          { name: null, items: [{ ids: ['gp-farine'], required: true }] },
          { name: { fr: 'Pour la sauce' }, items: [{ ids: ['vg-tomate'], required: true }] },
        ],
        sub_recipes: [],
      },
    }
    expect(() => recipeHasSeasonalIngredient(recipe, ingredientsById, 7)).not.toThrow()
    expect(recipeHasSeasonalIngredient(recipe, ingredientsById, 7)).toBe(true)
  })

  it('recipe sans ingredients → false sans crash', () => {
    expect(recipeHasSeasonalIngredient({}, ingredientsById, 7)).toBe(false)
  })
})
