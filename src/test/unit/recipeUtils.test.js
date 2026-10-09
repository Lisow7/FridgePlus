import { describe, it, expect } from 'vitest'
import { formatQty, localizeUnit, toGrams } from '@shared/lib/recipes/recipe-utils'

describe('toGrams', () => {
  it('renvoie 0 pour amount falsy ou unit "pm"', () => {
    expect(toGrams(0,    'g')).toBe(0)
    expect(toGrams(null, 'g')).toBe(0)
    expect(toGrams(100,  'pm')).toBe(0)
  })
  it('convertit les unités usuelles', () => {
    expect(toGrams(150, 'g')).toBe(150)
    expect(toGrams(2,   'kg')).toBe(2000)
    expect(toGrams(50,  'cl')).toBe(500)
    expect(toGrams(250, 'ml')).toBe(250)
    expect(toGrams(3,   'pcs')).toBe(300)
  })
})

describe('localizeUnit', () => {
  describe('français', () => {
    it('singulier pour 1', () => {
      expect(localizeUnit(1, 'gousse',  'fr')).toBe('gousse')
      expect(localizeUnit(1, 'tranche', 'fr')).toBe('tranche')
      expect(localizeUnit(1, 'unité',   'fr')).toBe('pièce')
    })
    it('pluriel à partir de 2', () => {
      expect(localizeUnit(2, 'gousse',  'fr')).toBe('gousses')
      expect(localizeUnit(3, 'tranche', 'fr')).toBe('tranches')
      expect(localizeUnit(5, 'unité',   'fr')).toBe('pièces')
      expect(localizeUnit(2, 'sachet',  'fr')).toBe('sachets')
      expect(localizeUnit(2, 'botte',   'fr')).toBe('bottes')
      expect(localizeUnit(2, 'tasse',   'fr')).toBe('tasses')
    })
    it('pluriel pour les unités v1.2.66 (verre/bol/pot/louche/carré/tablette/morceau/noix/goutte)', () => {
      expect(localizeUnit(2, 'verre',    'fr')).toBe('verres')
      expect(localizeUnit(3, 'bol',      'fr')).toBe('bols')
      expect(localizeUnit(2, 'pot',      'fr')).toBe('pots')
      expect(localizeUnit(2, 'louche',   'fr')).toBe('louches')
      expect(localizeUnit(2, 'carré',    'fr')).toBe('carrés')
      expect(localizeUnit(2, 'tablette', 'fr')).toBe('tablettes')
      expect(localizeUnit(2, 'morceau',  'fr')).toBe('morceaux')
      expect(localizeUnit(2, 'noix',     'fr')).toBe('noix')   // invariable
      expect(localizeUnit(2, 'goutte',   'fr')).toBe('gouttes')
      // Mappings FR → EN
      expect(localizeUnit(2, 'verre',    'en')).toBe('glasses')
      expect(localizeUnit(2, 'tablette', 'en')).toBe('bars')
    })
    it('gère les anciens libellés "(s)" sauvés en DB', () => {
      expect(localizeUnit(2, 'unité(s)',  'fr')).toBe('pièces')
      expect(localizeUnit(2, 'pincée(s)', 'fr')).toBe('pincées')
    })
    it('cuillères : pas de pluriel typographique', () => {
      expect(localizeUnit(1, 'cs', 'fr')).toBe('c. à s.')
      expect(localizeUnit(5, 'cs', 'fr')).toBe('c. à s.')
      expect(localizeUnit(1, 'cc', 'fr')).toBe('c. à c.')
      expect(localizeUnit(5, 'cc', 'fr')).toBe('c. à c.')
    })
  })

  describe('anglais', () => {
    it('pluriel anglais classique', () => {
      expect(localizeUnit(1, 'clove',  'en')).toBe('clove')
      expect(localizeUnit(2, 'clove',  'en')).toBe('cloves')
      expect(localizeUnit(2, 'pinch',  'en')).toBe('pinches')
      expect(localizeUnit(2, 'leaf',   'en')).toBe('leaves')
    })
    it('mappe les codes FR vers EN (gousse→clove, branche→sprig)', () => {
      expect(localizeUnit(1, 'gousse',  'en')).toBe('clove')
      expect(localizeUnit(2, 'gousse',  'en')).toBe('cloves')
      expect(localizeUnit(2, 'branche', 'en')).toBe('sprigs')
      expect(localizeUnit(3, 'tranche', 'en')).toBe('slices')
    })
    it('tsp/tbsp : pas de pluriel', () => {
      expect(localizeUnit(5, 'tsp',  'en')).toBe('tsp')
      expect(localizeUnit(5, 'tbsp', 'en')).toBe('tbsp')
    })
  })

  // Sprint 7 PR S7.d — describe blocks espagnol/allemand/
  // japonais retirés (langues non plus supportées).

  describe('fallbacks', () => {
    it('renvoie l\'unité brute si aucune correspondance', () => {
      expect(localizeUnit(2, 'unknown_unit', 'fr')).toBe('unknown_unit')
    })
    it('renvoie chaîne vide si unit falsy', () => {
      expect(localizeUnit(2, '', 'fr')).toBe('')
      expect(localizeUnit(2, null, 'fr')).toBe('')
    })
  })
})

describe('formatQty', () => {
  describe('conversions automatiques', () => {
    it('g → kg au-delà de 1000', () => {
      expect(formatQty(999, 'g', 'fr')).toBe('999 g')
      expect(formatQty(1000, 'g', 'fr')).toBe('1 kg')
      expect(formatQty(1500, 'g', 'fr')).toBe('1.5 kg')
      expect(formatQty(2000, 'g', 'fr')).toBe('2 kg')
    })
    it('cl → L au-delà de 100', () => {
      expect(formatQty(99, 'cl', 'fr')).toBe('99 cl')
      expect(formatQty(100, 'cl', 'fr')).toBe('1 L')
      expect(formatQty(150, 'cl', 'fr')).toBe('1.5 L')
    })
  })

  describe('cas spéciaux', () => {
    it('pcs : nombre + "unité(s)" avec pluriel, fractions Unicode pour 0.5 / 1.5', () => {
      expect(formatQty(1,   'pcs', 'fr')).toBe('1 pièce')
      expect(formatQty(3,   'pcs', 'fr')).toBe('3 pièces')
      expect(formatQty(2,   'pcs', 'en')).toBe('2 units')
      expect(formatQty(0.5, 'pcs', 'fr')).toBe('½')
      expect(formatQty(1.5, 'pcs', 'fr')).toBe('1½')
    })
    it('"pm" et variantes "to taste" → null', () => {
      // Sprint 7 PR S7.d — Variantes ES/DE/JA retirées.
      expect(formatQty(null, 'pm', 'fr')).toBeNull()
      expect(formatQty(null, 'PM', 'fr')).toBeNull()
      expect(formatQty(null, 'to taste',       'en')).toBeNull()
    })
    it('amount null sans unit "pm" → null', () => {
      expect(formatQty(null, 'g', 'fr')).toBeNull()
    })
  })

  describe('pluralisation en sortie', () => {
    it('FR : "2 gousses" et non "2 gousse"', () => {
      expect(formatQty(2, 'gousse', 'fr')).toBe('2 gousses')
      expect(formatQty(1, 'gousse', 'fr')).toBe('1 gousse')
      expect(formatQty(3, 'tranche', 'fr')).toBe('3 tranches')
    })
    it('EN : "3 slices" / "1 clove"', () => {
      expect(formatQty(3, 'tranche', 'en')).toBe('3 slices')
      expect(formatQty(1, 'gousse',  'en')).toBe('1 clove')
    })
    // Sprint 7 PR S7.d — Tests ES/DE retirés (langues
    // non plus supportées).
  })

  describe('unités scientifiques inchangées', () => {
    it('g, kg, ml, cl, L identiques', () => {
      expect(formatQty(50,  'g',  'fr')).toBe('50 g')
      expect(formatQty(2,   'kg', 'en')).toBe('2 kg')
    })
  })
})
