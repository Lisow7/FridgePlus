import { describe, it, expect } from 'vitest'
import { toFormState } from '@features/recipes/lib/recipe-form-state'

describe('toFormState', () => {
  it('aplati un tableau ingrédients legacy en lignes de formulaire', () => {
    const recipe = {
      name: 'Carbonara',
      ingredients: [
        { ids: ['gp-pates'], qty: { amount: 200, unit: 'g' }, required: true, labels: { fr: 'Pâtes' } },
      ],
    }
    const form = toFormState(recipe)
    expect(form.ingredients).toHaveLength(1)
    expect(form.ingredients[0].ingredientId).toBe('gp-pates')
    expect(form.ingredients[0].qty).toEqual({ amount: 200, unit: 'g' })
    expect(form.ingredients[0].required).toBe(true)
  })

  // Régression : format enrichi {groups, sub_recipes} crashait ici avec
  // "recipe.ingredients.map is not a function" (admin ouvre l'édition
  // d'une recette au format groupé) — trouvé en audit live 2026-07-14.
  it('ne crashe pas sur le format enrichi (groups + sub_recipes) et aplatit tous les groupes', () => {
    const recipe = {
      name: 'Lasagnes',
      ingredients: {
        groups: [
          { name: null, items: [
            { ids: ['gp-lasagnes-sec'], required: true, labels: { fr: 'Lasagnes' } },
          ] },
          { name: { fr: 'Pour la béchamel' }, items: [
            { ids: ['fr-beurre'], qty: { amount: 50, unit: 'g' }, required: true, labels: { fr: 'Beurre' } },
          ] },
        ],
        sub_recipes: [{ recipe_id: 'bechamel-maison', scale: 1 }],
      },
    }
    expect(() => toFormState(recipe)).not.toThrow()
    const form = toFormState(recipe)
    expect(form.ingredients).toHaveLength(2)
    expect(form.ingredients.map(i => i.ingredientId)).toEqual(['gp-lasagnes-sec', 'fr-beurre'])
    expect(form.ingredients[1].qty).toEqual({ amount: 50, unit: 'g' })
  })

  it('recette sans ingrédients → tableau vide sans crash', () => {
    expect(toFormState({ name: 'Vide' }).ingredients).toEqual([])
  })
})
