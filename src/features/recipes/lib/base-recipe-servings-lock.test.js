import { describe, it, expect } from 'vitest'
import { computeLockedServings } from './base-recipe-servings-lock'

const bechamel = { id: 'bechamel-maison', servings: 4 }

function lasagnes({ servings = 6, scale } = {}) {
  return {
    id: 'lasagnes-legumes',
    servings,
    ingredients: {
      groups: [],
      sub_recipes: scale === undefined ? [] : [{ recipe_id: 'bechamel-maison', scale }],
    },
  }
}

describe('computeLockedServings', () => {
  it('applique scale × ratio de portions de l\'origine', () => {
    // lasagnes 8/6 portions × scale 0.75 × béchamel 4 portions par défaut = 4
    const result = computeLockedServings({
      originRecipe: lasagnes({ servings: 6, scale: 0.75 }),
      originServings: 8,
      baseRecipe: bechamel,
    })
    expect(result).toBe(4)
  })

  it('scale absent (sub_recipes sans champ scale) → traité comme 1', () => {
    const originRecipe = {
      id: 'x', servings: 6,
      ingredients: { groups: [], sub_recipes: [{ recipe_id: 'bechamel-maison' }] },
    }
    const result = computeLockedServings({ originRecipe, originServings: 6, baseRecipe: bechamel })
    expect(result).toBe(4) // ratio origine 6/6=1, scale défaut 1 → 4 × 1 × 1
  })

  it('scale <= 0 (donnée invalide) → traité comme 1', () => {
    const result = computeLockedServings({
      originRecipe: lasagnes({ servings: 6, scale: 0 }),
      originServings: 6,
      baseRecipe: bechamel,
    })
    expect(result).toBe(4)
  })

  it('aucune entrée sub_recipes correspondante → null (non verrouillé)', () => {
    const originRecipe = lasagnes({ servings: 6, scale: undefined })
    const result = computeLockedServings({ originRecipe, originServings: 8, baseRecipe: bechamel })
    expect(result).toBeNull()
  })

  it('plafonne à 12', () => {
    // lasagnes 24/6 portions × scale 1 × béchamel 4 = 16 → plafonné à 12
    const result = computeLockedServings({
      originRecipe: lasagnes({ servings: 6, scale: 1 }),
      originServings: 24,
      baseRecipe: bechamel,
    })
    expect(result).toBe(12)
  })

  it('plafonne au minimum (2, ou 1 si servings par défaut de la base = 1)', () => {
    // lasagnes 1/6 portion × scale 0.75 × béchamel 4 = 0.5 → plafonné à 2 (minServings pour baseServings=4)
    const result = computeLockedServings({
      originRecipe: lasagnes({ servings: 6, scale: 0.75 }),
      originServings: 1,
      baseRecipe: bechamel,
    })
    expect(result).toBe(2)
  })

  it('arrondit à 1 décimale', () => {
    // lasagnes 8/6 × scale 0.75 × béchamel 4 = 4 × 8/6 × 0.75 = 4 (exact) — cas non-entier :
    const result = computeLockedServings({
      originRecipe: lasagnes({ servings: 6, scale: 0.7 }),
      originServings: 8,
      baseRecipe: bechamel,
    })
    // 4 × (8/6) × 0.7 = 3.7333... → arrondi à 1 décimale = 3.7, puis clampé à [2,12]
    expect(result).toBe(3.7)
  })

  it('composition à 2 niveaux : le résultat du niveau 1 sert d\'originServings au niveau 2', () => {
    const roux = { id: 'roux-maison', servings: 4 }
    const level1 = computeLockedServings({
      originRecipe: lasagnes({ servings: 6, scale: 0.75 }),
      originServings: 6,
      baseRecipe: bechamel,
    })
    expect(level1).toBe(3) // ratio origine 6/6=1, scale 0.75 → 4 × 1 × 0.75 = 3 (pas de plafond atteint)
    const bechamelWithSubRecipe = {
      ...bechamel,
      ingredients: { groups: [], sub_recipes: [{ recipe_id: 'roux-maison', scale: 1 }] },
    }
    const level2 = computeLockedServings({
      originRecipe: bechamelWithSubRecipe,
      originServings: level1,
      baseRecipe: roux,
    })
    // ratio béchamel = level1(3) / bechamelWithSubRecipe.servings(4) = 0.75 ; roux 4 × 1 × 0.75 = 3
    expect(level2).toBe(3)
  })
})
