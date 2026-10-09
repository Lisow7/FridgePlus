import { describe, it, expect } from 'vitest'
import { RECIPES } from '@shared/static/recipes'
import { INGREDIENTS } from '@shared/static/ingredients'
import { scoreRecipes } from '@features/recipes/lib/recipe-scoring'
import { computeStapleIds } from '@features/recipes/lib/pantry-staples'
import { QUICK_ADD_IDS } from '@features/onboarding/lib/quick-add-ingredients'

const ingredientsById = Object.fromEntries(
  Object.values(INGREDIENTS).flat().map((i) => [i.id, i]),
)
const stapleIds = computeStapleIds(ingredientsById)
const knownIds = new Set(Object.keys(ingredientsById))

describe('QUICK_ADD_IDS (pré-amorce frigo)', () => {
  it('contient 3 à 6 ids', () => {
    expect(QUICK_ADD_IDS.length).toBeGreaterThanOrEqual(3)
    expect(QUICK_ADD_IDS.length).toBeLessThanOrEqual(6)
  })
  it('tous les ids existent dans le catalogue (pas de fantôme)', () => {
    for (const id of QUICK_ADD_IDS) expect(knownIds.has(id)).toBe(true)
  })
  it('GARANTIT ≥ 1 recette READY (Blocker C)', () => {
    // scoreRecipes sans groupMaps = CONSERVATEUR (pas d'expansion parent→enfant) :
    // si READY ici, l'est a fortiori dans l'app (vrais groupMaps élargissent le match).
    const scored = scoreRecipes(RECIPES, new Set(QUICK_ADD_IDS), {}, stapleIds)
    const ready = scored.filter((r) => r.matchPercent === 1)
    expect(ready.length).toBeGreaterThan(0)
    // Recette cible actuelle (marge = 1) : le jeu de puces a été tuné pour `carbonara`.
    // Si cette assertion casse (catalogue modifié), RE-TUNER QUICK_ADD_IDS pour garantir
    // ≥1 READY, pas juste supprimer cette ligne.
    expect(ready.map((r) => r.id)).toContain('carbonara')
  })
})
