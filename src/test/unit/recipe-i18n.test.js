// Tests pour les helpers de résolution des noms multi-locales.
// Refonte Recettes Phase 7 — D6.1.

import { describe, it, expect } from 'vitest'
import { pickLocalizedName, pickRecipeName } from '../../shared/lib/recipes/recipe-i18n'

describe('pickLocalizedName — cascade D6.1', () => {
  const fullName = { 'fr-FR': 'Bolognaise', fr: 'Bolo', en: 'Bolognese' }

  it('FR + locale fr-FR → locale spécifique', () => {
    expect(pickLocalizedName(fullName, 'fr-FR', 'fr')).toBe('Bolognaise')
  })

  it('FR + locale fr-CA non présent → fallback langue fr', () => {
    expect(pickLocalizedName(fullName, 'fr-CA', 'fr')).toBe('Bolo')
  })

  it('FR-CA présent dans name → locale spécifique', () => {
    const name = { 'fr-CA': 'Sauce à viande', fr: 'Bolo' }
    expect(pickLocalizedName(name, 'fr-CA', 'fr')).toBe('Sauce à viande')
  })

  it('FR + locale NULL → fallback langue fr (D6.1 cas par défaut)', () => {
    expect(pickLocalizedName(fullName, null, 'fr')).toBe('Bolo')
    expect(pickLocalizedName(fullName, undefined, 'fr')).toBe('Bolo')
  })

  it('EN + locale NULL → fallback langue en', () => {
    expect(pickLocalizedName(fullName, null, 'en')).toBe('Bolognese')
  })

  it('ES + locale NULL + pas de name.es → fallback ultime fr', () => {
    expect(pickLocalizedName(fullName, null, 'es')).toBe('Bolo')
  })

  it('ES + name sans fr → fallback ultime en', () => {
    const name = { en: 'Bolognese', it: 'Bolognese' }
    expect(pickLocalizedName(name, null, 'es')).toBe('Bolognese')
  })

  it('Aucune correspondance → première valeur string non-vide', () => {
    const name = { it: 'Bolognese', es: 'Boloñesa' }
    expect(pickLocalizedName(name, null, 'fr')).toBe('Bolognese')
  })

  it('name string passthrough', () => {
    expect(pickLocalizedName('Plat custom', 'fr-FR', 'fr')).toBe('Plat custom')
  })

  it('name null → fallbackId', () => {
    expect(pickLocalizedName(null, 'fr-FR', 'fr', 'pates-tomate')).toBe('pates-tomate')
  })

  it('name undefined sans fallbackId → string vide', () => {
    expect(pickLocalizedName(undefined, 'fr-FR', 'fr')).toBe('')
  })

  it('name object vide → fallbackId', () => {
    expect(pickLocalizedName({}, null, 'fr', 'r-1')).toBe('r-1')
  })

  it('locale match mais valeur vide → cascade suivante', () => {
    const name = { 'fr-FR': '', fr: 'Bolo' }
    expect(pickLocalizedName(name, 'fr-FR', 'fr')).toBe('Bolo')
  })
})

describe('pickRecipeName — wrapper recipe', () => {
  it('utilise recipe.name + cascade', () => {
    const recipe = { id: 'bolo', name: { fr: 'Bolognaise', en: 'Bolognese' } }
    expect(pickRecipeName(recipe, null, 'fr')).toBe('Bolognaise')
    expect(pickRecipeName(recipe, null, 'en')).toBe('Bolognese')
  })

  it('recipe.name string (legacy custom) passthrough', () => {
    const recipe = { id: 'r1', name: 'Mon plat à moi' }
    expect(pickRecipeName(recipe, null, 'fr')).toBe('Mon plat à moi')
  })

  it('recipe sans name → fallback id', () => {
    expect(pickRecipeName({ id: 'r-42' }, null, 'fr')).toBe('r-42')
  })

  it('recipe sans name ni id → string vide', () => {
    expect(pickRecipeName({}, null, 'fr')).toBe('')
  })

  it('recipe null/undefined → string vide', () => {
    expect(pickRecipeName(null, null, 'fr')).toBe('')
    expect(pickRecipeName(undefined, null, 'fr')).toBe('')
  })

  it('locale ja + name avec ja → locale spécifique', () => {
    const recipe = { id: 'sushi', name: { fr: 'Sushi', ja: '寿司' } }
    expect(pickRecipeName(recipe, 'ja-JP', 'ja')).toBe('寿司')
  })

  it('locale ja-JP non présent + langue ja présent → fallback langue', () => {
    const recipe = { id: 'sushi', name: { fr: 'Sushi', ja: '寿司' } }
    expect(pickRecipeName(recipe, 'ja-JP', 'ja')).toBe('寿司')
  })
})
