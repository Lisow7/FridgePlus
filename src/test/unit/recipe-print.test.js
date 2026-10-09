import { describe, it, expect } from 'vitest'
import { buildRecipePrintHtml } from '@features/recipes/lib/recipe-print'

const recipe = {
  id: 'caprese', emoji: '🥗', time: 10, difficulty: 'Très facile', servings: 2,
  name: { fr: 'Salade Caprese', en: 'Caprese' },
  steps: { fr: ['Trancher les tomates.', 'Dresser.'] },
  ingredients: [
    { ids: ['vg-tomate'], labels: { fr: 'Tomate' }, qty: { amount: 3, unit: 'pcs' }, required: true },
    { ids: ['fr-mozzarella'], labels: { fr: 'Mozzarella' }, qty: { amount: 125, unit: 'g' }, required: true },
  ],
}

describe('buildRecipePrintHtml', () => {
  const html = buildRecipePrintHtml(recipe, 'fr')
  it('contient le titre', () => expect(html).toContain('Salade Caprese'))
  it('contient les ingrédients avec quantités', () => {
    expect(html).toContain('Tomate')
    expect(html).toContain('Mozzarella')
    expect(html).toMatch(/125/)
  })
  it('contient les étapes', () => expect(html).toContain('Trancher les tomates.'))
  it("n'inclut pas de statut frigo ni de progression", () => {
    expect(html).not.toMatch(/frigo|Manquant/i)
    expect(html).not.toContain('ingrédients</span>')
  })
  it('déclenche window.print au chargement', () => expect(html).toContain('window.print()'))
})
