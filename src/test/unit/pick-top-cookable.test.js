import { describe, it, expect } from 'vitest'
import { RECIPES } from '@shared/static/recipes'
import { INGREDIENTS } from '@shared/static/ingredients'
import { computeStapleIds } from '@features/recipes/lib/pantry-staples'
import { pickTopCookable } from '@features/onboarding/lib/pick-top-cookable'

const ingredientsById = Object.fromEntries(Object.values(INGREDIENTS).flat().map((i) => [i.id, i]))
const stapleIds = computeStapleIds(ingredientsById)
const base = { recipes: RECIPES, groupMaps: {}, stapleIds }
// Ingrédients carbonara (cf. PR2) : tous présents → READY.
const CARBONARA = ['fr-oeufs-standard', 'gp-spaghetti', 'fr-lardons', 'fr-parmesan']

describe('pickTopCookable', () => {
  it('stock vide → null', () => {
    expect(pickTopCookable({ ...base, stock: new Set() })).toBeNull()
  })
  it('tous les ingrédients d\'une recette → READY', () => {
    const r = pickTopCookable({ ...base, stock: new Set(CARBONARA) })
    expect(r).not.toBeNull()
    expect(r.status).toBe('READY')
    expect(r.recipe.matchPercent).toBe(1)
  })
  it('un ingrédient required manquant → ALMOST avec le slot manquant', () => {
    const r = pickTopCookable({ ...base, stock: new Set(CARBONARA.filter((id) => id !== 'fr-parmesan')) })
    expect(r).not.toBeNull()
    expect(r.status).toBe('ALMOST')
    expect(r.recipe.matchPercent).toBeGreaterThanOrEqual(0.6)
    expect(r.recipe.matchPercent).toBeLessThan(1)
    expect(r.missing).toBeTruthy()
  })
  it('stock qui ne matche (presque) rien → null', () => {
    // 1 ingrédient réel mais isolé (aucune recette n'atteint 0.6 avec lui + staples).
    expect(pickTopCookable({ ...base, stock: new Set(['vg-endives']) })).toBeNull()
  })
})
