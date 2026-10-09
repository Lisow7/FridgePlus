import { describe, it, expect } from 'vitest'
import { countRecipeIssues } from '@shared/lib/recipes/recipe-completeness'

// Le badge admin s'affiche ssi countRecipeIssues(recipe.data, resolveId) > 0
// sur une recette « pending ». On teste ici la logique de seuil.
describe('badge complétude admin — logique', () => {
  const resolveId = (id) => new Set(['frz-poulet']).has(id)

  it('recette avec id orphelin → badge (>0)', () => {
    const data = { servings: 4, time: '20 min', steps: ['a'], ingredients: [{ ids: ['zzz'] }] }
    expect(countRecipeIssues(data, resolveId) > 0).toBe(true)
  })

  it('recette incomplète → badge (>0)', () => {
    const data = { servings: 0, time: '', steps: [], ingredients: [] }
    expect(countRecipeIssues(data, resolveId)).toBeGreaterThan(0)
  })

  it('recette saine → pas de badge', () => {
    const data = { servings: 4, time: '20 min', steps: ['a'], ingredients: [{ ids: ['frz-poulet'] }] }
    expect(countRecipeIssues(data, resolveId) > 0).toBe(false)
  })
})
