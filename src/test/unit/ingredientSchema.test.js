import { describe, it, expect } from 'vitest'
import {
  getFullIngredient,
  getFullIngredientsBySubcat,
  getUnitConversions,
} from '@shared/lib/ingredients/ingredient-schema'

describe('getFullIngredient (v3.29.0)', () => {
  describe('agrégation des sources', () => {
    it('renvoie null pour un id inconnu', () => {
      expect(getFullIngredient('inexistant')).toBeNull()
      expect(getFullIngredient('')).toBeNull()
      expect(getFullIngredient(null)).toBeNull()
    })

    it('agrège ingredients + nutrition + packs + hints + conservation', () => {
      // Nutrition = source unique BDD : on injecte une map ingredientsById factice.
      const byId = new Map([['gp-farine-ble', { id: 'gp-farine-ble', nutrition: { cal: 364, prot: 10, carb: 76, fat: 1, fib: 3, al: ['gluten'] } }]])
      const r = getFullIngredient('gp-farine-ble', 'fr', byId)
      expect(r).not.toBeNull()
      // Identité
      expect(r.id).toBe('gp-farine-ble')
      expect(r.subcat).toBe('cereals')
      // Labels
      expect(r.label).toBe('Farine de blé')
      expect(r.labels).toMatchObject({ fr: 'Farine de blé', en: 'Wheat flour' })
      // Unités
      expect(r.defaultUnit).toBeDefined()
      // Packs (gp-farine-ble a des packs spécifiques en v3.27.5)
      expect(r.hasSpecificPacks).toBe(true)
      expect(r.packs.length).toBeGreaterThan(0)
      // Nutrition (résolue depuis la BDD via ingredientsById)
      expect(r.nutrition).not.toBeNull()
      expect(typeof r.nutrition.cal).toBe('number')
      // Conservation : préfixe gp- → pantry
      expect(r.conservation.method).toBe('pantry')
      expect(r.storage.location).toBe('pantry')
    })

    // Deux ingrédients du catalogue n'ont pas de prix propre dans
    // pricing/2026.json (fr-beurre-doux, fr-beurre-demi-sel) : ils héritent des
    // packs de leur sous-catégorie. Le test était ignoré depuis que `vg-radis`
    // avait reçu les siens (audit du 2026-10-04, ARCH-17 (3)).
    it('hasSpecificPacks=false pour un ingrédient sans pack spécifique : il hérite de la sous-catégorie', () => {
      const r = getFullIngredient('fr-beurre-doux', 'fr')
      expect(r).not.toBeNull()
      expect(r.hasSpecificPacks).toBe(false)
      expect(r.packs.length).toBeGreaterThan(0)
    })
  })

  describe('multilingue', () => {
    it('label suit la langue demandée', () => {
      // Sprint 7 PR S7.h — Test ES retiré (langue non supportée).
      expect(getFullIngredient('gp-farine-ble', 'fr').label).toBe('Farine de blé')
      expect(getFullIngredient('gp-farine-ble', 'en').label).toBe('Wheat flour')
    })

    it('packs varient selon la langue', () => {
      const fr = getFullIngredient('fr-oeufs-standard', 'fr')
      const en = getFullIngredient('fr-oeufs-standard', 'en')
      // FR : 6/10/12 ; EN : 6/12 (pas de 10)
      expect(fr.packs.some(p => p.size === 10)).toBe(true)
      expect(en.packs.some(p => p.size === 10)).toBe(false)
    })
  })

  describe('conservation par préfixe', () => {
    it('frz- → freezer', () => {
      const r = getFullIngredient('frz-petits-pois', 'fr')
      expect(r.conservation.method).toBe('freezer')
      expect(r.storage.location).toBe('freezer')
    })

    it('vg- → fridge crisper (par défaut)', () => {
      const r = getFullIngredient('vg-tomate-cerise', 'fr')
      expect(r.conservation.method).toBe('fridge')
      expect(r.storage.compartment).toBe('crisper')
    })

    it('sp- → spice-rack', () => {
      const r = getFullIngredient('sp-poivre-noir', 'fr')
      expect(r.storage.location).toBe('spice-rack')
    })
  })

  describe('overrides spécifiques', () => {
    it('fr-banane → fruit-bowl (pas frigo)', () => {
      const r = getFullIngredient('fr-banane', 'fr')
      expect(r.storage.location).toBe('fruit-bowl')
      expect(r.conservation.notes).toContain('mûrir')
    })

    it('vg-pomme-terre → pantry (pas frigo crisper)', () => {
      const r = getFullIngredient('vg-pomme-terre', 'fr')
      expect(r.storage.location).toBe('pantry')
    })

    it('fr-lait-entier → pantry tant que non ouvert', () => {
      const r = getFullIngredient('fr-lait-entier', 'fr')
      expect(r.conservation.method).toBe('pantry')
      expect(r.conservation.notes).toContain('frigo')
    })
  })

  describe('reconstitutes (v3.27.7)', () => {
    it('gp-bouillon-cube expose reconstitutes', () => {
      const r = getFullIngredient('gp-bouillon-cube', 'fr')
      expect(r.reconstitutes).not.toBeNull()
      expect(r.reconstitutes.amount).toBe(100)
      expect(r.reconstitutes.unit).toBe('cl')
    })

    it('un ingrédient sans reconstitutes renvoie null', () => {
      const r = getFullIngredient('gp-spaghetti', 'fr')
      expect(r.reconstitutes).toBeNull()
    })
  })
})

describe('getFullIngredientsBySubcat', () => {
  it('renvoie tous les ingrédients d\'une sous-catégorie unifiés', () => {
    const items = getFullIngredientsBySubcat('eggs', 'fr')
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(i => i.subcat === 'eggs')).toBe(true)
    expect(items.every(i => i.label !== '')).toBe(true)
  })

  it('renvoie [] pour une sous-cat inconnue', () => {
    expect(getFullIngredientsBySubcat('inexistant', 'fr')).toEqual([])
  })
})

describe('getUnitConversions', () => {
  it('renvoie les équivalences gramsPer d\'un ingrédient', () => {
    // vg-ail : { gousse: 5, tete: 50 }
    const c = getUnitConversions('vg-ail')
    expect(c).toEqual(expect.arrayContaining([
      { unit: 'gousse', gramsEquivalent: 5 },
      { unit: 'tete',   gramsEquivalent: 50 },
    ]))
  })

  it('renvoie [] si pas de gramsPer défini', () => {
    expect(getUnitConversions('inexistant')).toEqual([])
  })
})
