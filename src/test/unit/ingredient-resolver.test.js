// src/test/unit/ingredient-resolver.test.js
import { describe, it, expect } from 'vitest'
import {
  resolveNutrition, resolveAllergens, resolveDefaultUnit, resolvePackEntry,
} from '@shared/lib/ingredients/ingredient-resolver'
import { getFullIngredient } from '@shared/lib/ingredients/ingredient-schema'
import { PACK_SIZES } from '@shared/static/pack-sizes'

function mapOf(obj) { return new Map(Object.entries(obj)) }

describe('ingredient-resolver — nutrition/allergènes BDD-only, unité/packs BDD-first', () => {
  it('resolveNutrition : valeur BDD non vide prioritaire', () => {
    const byId = mapOf({ 'x-1': { id: 'x-1', nutrition: { cal: 100, prot: 5, carb: 2, fat: 3, fib: 1, al: [] } } })
    expect(resolveNutrition('x-1', byId)).toEqual({ cal: 100, prot: 5, carb: 2, fat: 3, fib: 1, al: [] })
  })

  it('resolveNutrition : BDD vide (objet nutrition vide) → null (plus de fallback statique)', () => {
    const byId = mapOf({ 'frz-poulet': { id: 'frz-poulet', nutrition: {} } })
    expect(resolveNutrition('frz-poulet', byId)).toBeNull()
  })

  it('resolveNutrition : id absent de la map → null', () => {
    expect(resolveNutrition('frz-poulet', new Map())).toBeNull()
  })

  it('resolveNutrition : inconnu partout → null', () => {
    expect(resolveNutrition('zzz-inexistant', new Map())).toBeNull()
  })

  it('resolveAllergens : colonne BDD non vide prioritaire', () => {
    const byId = mapOf({ 'x-1': { id: 'x-1', allergens: ['milk'], nutrition: {} } })
    expect(resolveAllergens('x-1', byId)).toEqual(['milk'])
  })

  it('resolveAllergens : BDD vide (allergens [] et pas de nutrition.al) → [] (plus de fallback statique)', () => {
    const byId = mapOf({ 'frz-nuggets': { id: 'frz-nuggets', allergens: [] } })
    expect(resolveAllergens('frz-nuggets', byId)).toEqual([])
  })

  it('resolveDefaultUnit : BDD prioritaire, sinon hints statiques', () => {
    const byId = mapOf({ 'x-1': { id: 'x-1', default_unit: 'ml' } })
    expect(resolveDefaultUnit('x-1', byId)).toBe('ml')
    expect(typeof resolveDefaultUnit('frz-poulet', new Map())).toBe('string')
  })

  it('resolveAllergens : BDD sans top-level allergens mais nutrition.al → prioritaire', () => {
    const byId = mapOf({ 'x-1': { id: 'x-1', nutrition: { al: ['eggs'], cal: 0 } } })
    expect(resolveAllergens('x-1', byId)).toEqual(['eggs'])
  })

  it('resolvePackEntry : BDD prioritaire si au moins une langue non vide', () => {
    const dbPacks = { fr: [{ size: 250, unit: 'g', price: 2 }], en: [] }
    const byId = mapOf({ 'x-1': { id: 'x-1', pack_size: dbPacks } })
    expect(resolvePackEntry('x-1', byId)).toBe(dbPacks)
  })

  it('resolvePackEntry : BDD vide (objet vide ou tableaux vides) → fallback statique', () => {
    const byId = mapOf({
      'fr-beurre': { id: 'fr-beurre', pack_size: {} },
      'fr-lait-entier': { id: 'fr-lait-entier', pack_size: { fr: [], en: [] } },
    })
    expect(resolvePackEntry('fr-beurre', byId)).toBe(PACK_SIZES['fr-beurre'])
    expect(resolvePackEntry('fr-lait-entier', byId)).toBe(PACK_SIZES['fr-lait-entier'])
  })

  it('resolvePackEntry : ni BDD ni statique → null', () => {
    expect(resolvePackEntry('zzz-inexistant', new Map())).toBeNull()
  })

  it('garde-fous : map null ou id null ne throw pas et renvoie null', () => {
    expect(() => resolveNutrition('x', null)).not.toThrow()
    expect(resolveNutrition('frz-poulet', null)).toBeNull()
    expect(() => resolveNutrition(null, new Map())).not.toThrow()
    expect(resolveNutrition(null, new Map())).toBeNull()
  })
})

describe('getFullIngredient — DB-aware optionnel', () => {
  it('sans ingredientsById → nutrition null (nutrition = source unique BDD)', () => {
    const full = getFullIngredient('frz-poulet', 'fr')
    expect(full.nutrition).toBeNull()
  })
  it('avec ingredientsById non vide → nutrition BDD prioritaire', () => {
    const byId = new Map([['frz-poulet', { id: 'frz-poulet', nutrition: { cal: 999, prot: 1, carb: 1, fat: 1, fib: 1, al: [] } }]])
    const full = getFullIngredient('frz-poulet', 'fr', byId)
    expect(full.nutrition.cal).toBe(999)
  })
  it('avec ingredientsById → default_unit BDD prioritaire', () => {
    const byId = new Map([['frz-poulet', { id: 'frz-poulet', default_unit: 'pcs' }]])
    expect(getFullIngredient('frz-poulet', 'fr', byId).defaultUnit).toBe('pcs')
  })
})
