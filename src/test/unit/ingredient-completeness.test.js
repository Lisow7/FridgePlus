// src/test/unit/ingredient-completeness.test.js
import { describe, it, expect } from 'vitest'
import { getMissingFields, REQUIRED_FIELDS } from '@shared/lib/ingredients/ingredient-completeness'

const complete = {
  id: 'fr-beurre-doux',
  labels: { fr: 'Beurre doux', en: 'Unsalted butter' },
  emoji: '🧈', subcategory: 'dairy', storage: 'fr',
  default_unit: 'g',
  nutrition: { cal: 745, prot: 0.6, carb: 0.5, fat: 82, fib: 0, al: ['milk'] },
  pack_size: { fr: [{ size: 250, unit: 'g', price: 2.2 }] },
  allergens: ['milk'], breaks_diets: ['vegan', 'dairy-free'],
}

describe('getMissingFields', () => {
  it('ingrédient complet → aucun champ requis manquant', () => {
    expect(getMissingFields(complete)).toEqual([])
  })
  it('détecte labels.en manquant', () => {
    const x = { ...complete, labels: { fr: 'Beurre doux' } }
    expect(getMissingFields(x)).toContain('labels.en')
  })
  it('détecte nutrition vide', () => {
    const x = { ...complete, nutrition: {} }
    expect(getMissingFields(x)).toContain('nutrition')
  })
  it('détecte aucun pack', () => {
    const x = { ...complete, pack_size: {} }
    expect(getMissingFields(x)).toContain('pack_size')
  })
  it('allergens vide est AUTORISÉ (liste explicite)', () => {
    const x = { ...complete, allergens: [] }
    expect(getMissingFields(x)).not.toContain('allergens')
  })
  it('REQUIRED_FIELDS est exporté pour réutilisation (audit)', () => {
    expect(REQUIRED_FIELDS).toContain('nutrition')
  })
})
