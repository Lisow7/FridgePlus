import { describe, it, expect } from 'vitest'
import { matchIngredient, buildLabels } from '@shared/lib/recipes/recipe-ingredient-helpers'

const CATALOG = [
  { id: 'vg-tomate', labels: { fr: 'Tomate', en: 'Tomato' } },
  { id: 'fr-mozzarella', labels: { fr: 'Mozzarella', en: 'Mozzarella' } },
  { id: 'sp-basilic', labels: { fr: 'Basilic', en: 'Basil' } },
  { id: 'vg-oignon', labels: { fr: 'Oignon', en: 'Onion' } },
  { id: 'vg-champignon', labels: { fr: 'Champignons', en: 'Mushrooms' } },
  { id: 'gp-farine', labels: { fr: 'Farine de blé', en: 'Wheat flour' } },
  { id: 'gp-sorbet-fraise', labels: { fr: 'Sorbet fraise', en: 'Strawberry sorbet' } },
  { id: 'vg-tomate-cerise', labels: { fr: 'Tomate cerise', en: 'Cherry tomato' } },
]

describe('matchIngredient — rapprochement au catalogue', () => {
  it('trouve l’ingrédient malgré pluriel/casse', () => {
    expect(matchIngredient('tomates', CATALOG)?.id).toBe('vg-tomate')
    expect(matchIngredient('Mozzarella', CATALOG)?.id).toBe('fr-mozzarella')
  })
  it('pluriel : « oignons » → Oignon (PAS Champignons)', () => {
    expect(matchIngredient('oignons', CATALOG)?.id).toBe('vg-oignon')
  })
  it('nom multi-mots : « basilic frais » → Basilic (PAS Sorbet fraise)', () => {
    expect(matchIngredient('basilic frais', CATALOG)?.id).toBe('sp-basilic')
  })
  it('descripteur ne pollue pas : « fraise » ≠ « frais »', () => {
    // « basilic frais » ne doit jamais matcher « Sorbet fraise » via le descripteur
    expect(matchIngredient('basilic frais', CATALOG)?.id).not.toBe('gp-sorbet-fraise')
  })
  it('libellé le plus court gagne : « tomate » → Tomate (pas Tomate cerise)', () => {
    expect(matchIngredient('tomate', CATALOG)?.id).toBe('vg-tomate')
  })
  it('mot présent dans un libellé multi-mots : « farine » → Farine de blé', () => {
    expect(matchIngredient('farine', CATALOG)?.id).toBe('gp-farine')
  })
  it('retourne null si rien de proche (préfère null à un faux match)', () => {
    expect(matchIngredient('zzzinconnuxyz', CATALOG)).toBeNull()
  })
  it('expose une confiance (high/low)', () => {
    expect(matchIngredient('tomate', CATALOG)?.confidence).toBe('high')
  })
})

describe('buildLabels — auto-génération de libellé multilingue', () => {
  it('unité métrique : amount + unit + nom', () => {
    expect(buildLabels({ amount: 200, unit: 'g' }, { fr: 'Farine', en: 'Flour' }))
      .toEqual({ fr: '200 g Farine', en: '200 g Flour' })
  })
  it('unité « pcs » omise', () => {
    expect(buildLabels({ amount: 3, unit: 'pcs' }, { fr: 'Tomate' }))
      .toEqual({ fr: '3 Tomate' })
  })
  it('fraction jolie + unité FR traduite par langue', () => {
    expect(buildLabels({ amount: 0.5, unit: 'bouquet' }, { fr: 'Basilic' }))
      .toEqual({ fr: '½ bouquet Basilic' })
    expect(buildLabels({ amount: 3, unit: 'cs' }, { fr: 'Huile', en: 'Oil' }))
      .toEqual({ fr: '3 c. à s. Huile', en: '3 tbsp Oil' })
  })
  it('sans quantité ni unité : juste le nom', () => {
    expect(buildLabels({ amount: null, unit: null }, { fr: 'Sel' })).toEqual({ fr: 'Sel' })
  })
})
