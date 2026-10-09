import { describe, it, expect } from 'vitest'
import {
  getUnitHints,
  getGramsPer,
  PREFIX_DEFAULTS,
  FALLBACK,
} from '@shared/static/ingredient-unit-hints'
import { toGrams } from '@shared/lib/recipes/recipe-utils'

describe('getUnitHints — résolution', () => {
  it('renvoie le FALLBACK pour un id null/undefined', () => {
    expect(getUnitHints(null)).toEqual(FALLBACK)
    expect(getUnitHints(undefined)).toEqual(FALLBACK)
  })
  it('priorise un override spécifique sur le préfixe', () => {
    // 'vg-ail' a un override (gousse) → ne tombe pas sur le défaut vg-* (g)
    expect(getUnitHints('vg-ail').defaultUnit).toBe('gousse')
    expect(getUnitHints('vg-ail').altUnits).toContain('tete')
  })
  it('utilise le préfixe quand aucun override n\'existe', () => {
    expect(getUnitHints('vg-quinoa-imaginaire').defaultUnit).toBe(PREFIX_DEFAULTS['vg-'].defaultUnit)
    expect(getUnitHints('sp-piment-x').defaultUnit).toBe('cc')
    expect(getUnitHints('gp-truc').defaultUnit).toBe('g')
  })
})

describe('Couverture des overrides emblématiques', () => {
  it('Ail → gousse / tête', () => {
    const h = getUnitHints('vg-ail')
    expect(h.defaultUnit).toBe('gousse')
    expect(h.gramsPer.gousse).toBe(5)
    expect(h.gramsPer.tete).toBe(50)
  })
  it('Herbes fraîches : feuille pour basilic/laurier, branche pour thym/romarin, botte pour persil', () => {
    expect(getUnitHints('sp-basilic').defaultUnit).toBe('feuille')
    expect(getUnitHints('sp-laurier').defaultUnit).toBe('feuille')
    expect(getUnitHints('sp-thym').defaultUnit).toBe('branche')
    expect(getUnitHints('sp-romarin').defaultUnit).toBe('branche')
    expect(getUnitHints('sp-persil').defaultUnit).toBe('botte')
    expect(getUnitHints('sp-coriandre').defaultUnit).toBe('botte')
  })
  it('Sel/poivre par défaut en pincée', () => {
    expect(getUnitHints('sp-sel-fin').defaultUnit).toBe('pincée')
    expect(getUnitHints('sp-poivre-noir').defaultUnit).toBe('pincée')
  })
  it('Levures et sucre vanillé en sachet', () => {
    expect(getUnitHints('gp-levure').defaultUnit).toBe('sachet')
    expect(getUnitHints('gp-levure-boul').defaultUnit).toBe('sachet')
    expect(getUnitHints('gp-sucre-vanille').defaultUnit).toBe('sachet')
  })
  it('Œufs en unité', () => {
    expect(getUnitHints('fr-oeuf').defaultUnit).toBe('unité')
    expect(getUnitHints('fr-oeuf').gramsPer['unité']).toBe(50)
  })
  it('Charcuterie en tranche, lardons en grammes', () => {
    expect(getUnitHints('fr-jambon-blanc').defaultUnit).toBe('tranche')
    expect(getUnitHints('fr-bacon').defaultUnit).toBe('tranche')
    expect(getUnitHints('fr-mortadelle').defaultUnit).toBe('tranche')
    // Lardons : g (override explicite, cohérent avec l'usage en barquette)
    expect(getUnitHints('fr-lardons').defaultUnit).toBe('g')
  })
  it('Légumes/fruits à la pièce', () => {
    expect(getUnitHints('vg-tomate').defaultUnit).toBe('unité')
    expect(getUnitHints('vg-oignon').defaultUnit).toBe('unité')
    expect(getUnitHints('vg-pomme-terre').defaultUnit).toBe('unité')
    expect(getUnitHints('fr-pomme').defaultUnit).toBe('unité')
    expect(getUnitHints('fr-citron').defaultUnit).toBe('unité')
  })
  it('Liquides spécifiques : cs / cl par défaut, g possible en alt', () => {
    expect(getUnitHints('sp-huile-olive').defaultUnit).toBe('cs')
    expect(getUnitHints('sp-huile-olive').altUnits).toContain('g')
    expect(getUnitHints('fr-lait').defaultUnit).toBe('cl')
    expect(getUnitHints('fr-lait').altUnits).toContain('g')
    expect(getUnitHints('fr-creme').altUnits).toContain('g')
  })
  it('Pain de mie en tranche', () => {
    expect(getUnitHints('gp-pain-mie').defaultUnit).toBe('tranche')
    expect(getUnitHints('gp-pain-mie').gramsPer.tranche).toBe(25)
  })
})

describe('getGramsPer', () => {
  it('renvoie le bon poids pour les unités-pièce connues', () => {
    expect(getGramsPer('vg-ail',          'gousse')).toBe(5)
    expect(getGramsPer('vg-ail',          'tete')).toBe(50)
    expect(getGramsPer('sp-thym',         'branche')).toBe(1)
    expect(getGramsPer('gp-levure-boul',  'sachet')).toBe(7)
    expect(getGramsPer('fr-jambon-blanc', 'tranche')).toBe(30)
    expect(getGramsPer('fr-oeuf',         'unité')).toBe(50)
  })
  it('renvoie 0 pour une unité non connue ou un id sans hints', () => {
    expect(getGramsPer('vg-ail',     'inconnu')).toBe(0)
    expect(getGramsPer('vg-tomate-x','gousse')).toBe(0)  // pas d'override + sans entry
    expect(getGramsPer(null,         'g')).toBe(0)
  })
})

describe('toGrams étendu — résolution via gramsPer', () => {
  it('reste compatible avec les unités basiques sans ingredientId', () => {
    expect(toGrams(150, 'g')).toBe(150)
    expect(toGrams(2,   'kg')).toBe(2000)
    expect(toGrams(50,  'cl')).toBe(500)
    expect(toGrams(0.5, 'L')).toBe(500)
  })
  it('résout les unités-pièce via l\'id ingrédient', () => {
    expect(toGrams(2, 'gousse',  'vg-ail')).toBe(10)        // 2 × 5 g
    expect(toGrams(1, 'tete',    'vg-ail')).toBe(50)
    expect(toGrams(3, 'branche', 'sp-thym')).toBe(3)        // 3 × 1 g
    expect(toGrams(1, 'sachet',  'gp-levure-boul')).toBe(7)
    expect(toGrams(2, 'tranche', 'fr-jambon-blanc')).toBe(60) // 2 × 30 g
    expect(toGrams(3, 'unité',   'fr-oeuf')).toBe(150)      // 3 × 50 g
    expect(toGrams(2, 'unité',   'vg-tomate')).toBe(240)    // 2 × 120 g
  })
  it('renvoie 0 quand l\'unité-pièce est inconnue pour l\'ingrédient', () => {
    expect(toGrams(2, 'gousse', 'vg-tomate')).toBe(0)
    expect(toGrams(2, 'sachet', 'vg-ail')).toBe(0)
  })
  it('renvoie 0 sans ingredientId pour une unité-pièce', () => {
    expect(toGrams(2, 'gousse')).toBe(0)
  })
})
