import { describe, it, expect } from 'vitest'
import { categorizeIngredientsByStorage } from '@features/fridge/lib/categorize-ingredients'

describe('categorizeIngredientsByStorage (v3.231.0)', () => {
  it('liste vide → 0/0', () => {
    expect(categorizeIngredientsByStorage([])).toEqual({ fridge: 0, pantry: 0 })
    expect(categorizeIngredientsByStorage()).toEqual({ fridge: 0, pantry: 0 })
    expect(categorizeIngredientsByStorage(null)).toEqual({ fridge: 0, pantry: 0 })
  })

  it('frigo : fr-, vg-, frz-, jp-', () => {
    const r = categorizeIngredientsByStorage(['fr-tomate', 'vg-carotte', 'frz-petits-pois', 'jp-tofu'])
    expect(r).toEqual({ fridge: 4, pantry: 0 })
  })

  it('garde-manger : gp-, sp-, bk-', () => {
    const r = categorizeIngredientsByStorage(['gp-farine-ble', 'sp-poivre-noir', 'bk-pain'])
    expect(r).toEqual({ fridge: 0, pantry: 3 })
  })

  it('mixte', () => {
    const r = categorizeIngredientsByStorage([
      'fr-tomate', 'gp-farine-ble', 'vg-carotte', 'sp-sel', 'frz-glace',
    ])
    expect(r).toEqual({ fridge: 3, pantry: 2 })
  })

  it('préfixe inconnu → fallback frigo (par sécurité)', () => {
    const r = categorizeIngredientsByStorage(['inconnu-xyz', 'autre-abc'])
    expect(r).toEqual({ fridge: 2, pantry: 0 })
  })

  it('ignore les non-string', () => {
    const r = categorizeIngredientsByStorage(['fr-tomate', null, undefined, 42, 'gp-farine-ble'])
    expect(r).toEqual({ fridge: 1, pantry: 1 })
  })
})
