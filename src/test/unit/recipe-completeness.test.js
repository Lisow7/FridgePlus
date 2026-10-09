import { describe, it, expect } from 'vitest'
import { getRecipeIssues, countRecipeIssues } from '@shared/lib/recipes/recipe-completeness'

// resolveId(id) => bool : l'id existe-t-il au catalogue ?
const known = new Set(['frz-poulet', 'vg-tomate'])
const resolveId = (id) => known.has(id)

const ok = {
  servings: 4,
  time: '30 min',
  steps: ['Faire revenir', 'Servir'],
  ingredients: [{ ids: ['frz-poulet'], qty: { amount: 200, unit: 'g' } }],
}

describe('getRecipeIssues', () => {
  it('recette complète + ids connus → aucun problème', () => {
    expect(getRecipeIssues(ok, resolveId)).toEqual([])
  })
  it('servings manquant', () => {
    expect(getRecipeIssues({ ...ok, servings: 0 }, resolveId)).toContain('servings')
  })
  it('time manquant (vide ou 0)', () => {
    expect(getRecipeIssues({ ...ok, time: '' }, resolveId)).toContain('time')
    expect(getRecipeIssues({ ...ok, time: '0 min' }, resolveId)).toContain('time')
  })
  it('étapes vides', () => {
    expect(getRecipeIssues({ ...ok, steps: [] }, resolveId)).toContain('steps')
    expect(getRecipeIssues({ ...ok, steps: ['  '] }, resolveId)).toContain('steps')
  })
  it('aucun ingrédient', () => {
    expect(getRecipeIssues({ ...ok, ingredients: [] }, resolveId)).toContain('ingredients')
  })
  it('id d\'ingrédient inconnu → signalé nommément', () => {
    const r = { ...ok, ingredients: [{ ids: ['zzz-inconnu'], qty: {} }] }
    const issues = getRecipeIssues(r, resolveId)
    expect(issues.some(i => i.includes('zzz-inconnu'))).toBe(true)
  })
  it('resolveId absent → on ne signale pas de faux orphelins', () => {
    const issues = getRecipeIssues(ok, undefined)
    expect(issues.some(i => i.startsWith('ingredient_unknown'))).toBe(false)
  })
})

describe('countRecipeIssues', () => {
  it('compte les problèmes d\'une recette', () => {
    const r = { servings: 0, time: '', steps: [], ingredients: [{ ids: ['zzz'] }] }
    expect(countRecipeIssues(r, resolveId)).toBe(4) // servings + time + steps + 1 orphelin
  })
  it('0 pour une recette saine', () => {
    const r = { servings: 4, time: '20 min', steps: ['a'], ingredients: [{ ids: ['frz-poulet'] }] }
    expect(countRecipeIssues(r, resolveId)).toBe(0)
  })
})
