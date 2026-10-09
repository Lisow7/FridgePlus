/**
 * P10a — Tests unitaires pour les 5 filtres fonctionnels (functional_tags + cook_time_min).
 * Teste la logique pure des prédicats sans rendre le hook (qui dépend de contextes Supabase).
 */

import { describe, it, expect } from 'vitest'

// ─── Prédicats extraits de use-recipe-filters.js ─────────────────────────────
// Chaque filtre est un prédicat booléen :  (flag, recipe) → boolean
const noCookPredicate          = (flag, r) => !flag || r.cook_time_min === 0
const antiWastePredicate       = (flag, r) => !flag || (r.functional_tags ?? []).includes('anti_waste')
const freezerFriendlyPredicate = (flag, r) => !flag || (r.functional_tags ?? []).includes('freezer_friendly')
const kidsFriendlyPredicate    = (flag, r) => !flag || (r.functional_tags ?? []).includes('kids_friendly')
const batchCookingPredicate    = (flag, r) => !flag || (r.functional_tags ?? []).includes('batch_cooking')

// ─── Jeu de recettes mockées ──────────────────────────────────────────────────
const recipes = [
  { id: 'r1', cook_time_min: 0,    functional_tags: ['anti_waste', 'kids_friendly'] },
  { id: 'r2', cook_time_min: 20,   functional_tags: ['freezer_friendly', 'batch_cooking'] },
  { id: 'r3', cook_time_min: 0,    functional_tags: [] },
  { id: 'r4', cook_time_min: null, functional_tags: ['anti_waste'] },
  { id: 'r5', cook_time_min: 45,   functional_tags: ['batch_cooking', 'kids_friendly', 'freezer_friendly'] },
  { id: 'r6', cook_time_min: 10,   functional_tags: null },   // null guard test
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('P10a — noCookOnly (cook_time_min === 0)', () => {
  it('retourne toutes les recettes quand flag = false', () => {
    const result = recipes.filter(r => noCookPredicate(false, r))
    expect(result).toHaveLength(6)
  })

  it('ne retient que cook_time_min === 0 (null exclu)', () => {
    const result = recipes.filter(r => noCookPredicate(true, r))
    expect(result.map(r => r.id)).toEqual(['r1', 'r3'])
  })
})

describe('P10a — antiWasteOnly', () => {
  it('retourne toutes les recettes quand flag = false', () => {
    const result = recipes.filter(r => antiWastePredicate(false, r))
    expect(result).toHaveLength(6)
  })

  it('ne retient que les recettes avec anti_waste dans functional_tags', () => {
    const result = recipes.filter(r => antiWastePredicate(true, r))
    expect(result.map(r => r.id)).toEqual(['r1', 'r4'])
  })

  it('gère functional_tags null sans crash', () => {
    expect(() => antiWastePredicate(true, recipes[5])).not.toThrow()
    expect(antiWastePredicate(true, recipes[5])).toBe(false)
  })
})

describe('P10a — freezerFriendlyOnly', () => {
  it('ne retient que les recettes avec freezer_friendly', () => {
    const result = recipes.filter(r => freezerFriendlyPredicate(true, r))
    expect(result.map(r => r.id)).toEqual(['r2', 'r5'])
  })
})

describe('P10a — kidsFriendlyOnly', () => {
  it('ne retient que les recettes avec kids_friendly', () => {
    const result = recipes.filter(r => kidsFriendlyPredicate(true, r))
    expect(result.map(r => r.id)).toEqual(['r1', 'r5'])
  })
})

describe('P10a — batchCookingOnly', () => {
  it('ne retient que les recettes avec batch_cooking', () => {
    const result = recipes.filter(r => batchCookingPredicate(true, r))
    expect(result.map(r => r.id)).toEqual(['r2', 'r5'])
  })
})

describe('P10a — composition de filtres', () => {
  it('freezer + batch = intersection correcte', () => {
    const result = recipes.filter(r =>
      freezerFriendlyPredicate(true, r) && batchCookingPredicate(true, r),
    )
    expect(result.map(r => r.id)).toEqual(['r2', 'r5'])
  })

  it('noCook + antiWaste = recettes sans cuisson ET anti-gaspi', () => {
    const result = recipes.filter(r =>
      noCookPredicate(true, r) && antiWastePredicate(true, r),
    )
    // r1 (cook=0, has anti_waste), r3 (cook=0, no anti_waste ✗), r4 (cook=null ✗)
    expect(result.map(r => r.id)).toEqual(['r1'])
  })
})
