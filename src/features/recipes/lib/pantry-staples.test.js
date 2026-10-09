import { describe, it, expect } from 'vitest'
import { computeStapleIds, STAPLE_SUBCATEGORIES } from './pantry-staples'
import { scoreRecipes } from './recipe-scoring'

describe('computeStapleIds', () => {
  it('retourne les ids des sous-catégories staple (salt-spices + oils)', () => {
    const ingById = {
      'sp-sel':       { subcategory: 'salt-spices' },
      'sp-huile':     { subcategory: 'oils' },
      'fr-oignon':    { subcategory: 'vegetables' },
      'fr-beurre':    { subcategory: 'dairy' },
    }
    expect([...computeStapleIds(ingById)].sort()).toEqual(['sp-huile', 'sp-sel'])
  })

  it('catalogue vide / null → set vide', () => {
    expect(computeStapleIds(null).size).toBe(0)
    expect(computeStapleIds({}).size).toBe(0)
  })

  it('inclut bien salt-spices et oils', () => {
    expect(STAPLE_SUBCATEGORIES.has('salt-spices')).toBe(true)
    expect(STAPLE_SUBCATEGORIES.has('oils')).toBe(true)
    expect(STAPLE_SUBCATEGORIES.has('vegetables')).toBe(false)
  })
})

describe('scoreRecipes — garde-manger assumé', () => {
  const soupe = {
    id: 'soupe',
    ingredients: [
      { ids: ['vg-oignon'], required: true },
      { ids: ['sp-huile-olive-ex'], required: true }, // staple
      { ids: ['sp-thym'], required: false },           // optionnel, ignoré du score
    ],
  }

  it('sans staples : huile manquante → 50%', () => {
    const [r] = scoreRecipes([soupe], new Set(['vg-oignon']), null)
    expect(r.matchPercent).toBe(0.5)
    expect(r.missing.map(s => s.ids[0])).toEqual(['sp-huile-olive-ex'])
  })

  it('avec staples : huile assumée présente → 100%, absente de missing', () => {
    const staples = new Set(['sp-huile-olive-ex'])
    const [r] = scoreRecipes([soupe], new Set(['vg-oignon']), null, staples)
    expect(r.matchPercent).toBe(1)
    expect(r.missing).toEqual([])
  })
})
