import { describe, it, expect } from 'vitest'
import {
  mergePricingEdits,
  formatPricingForDownload,
  getDownloadFilename,
  countPricedIngredients,
  validateEdits,
} from '@shared/lib/pricing/pricing-export'

const FIXED_DATE = new Date('2026-05-04T03:00:00Z')

const SAMPLE_PRICING = {
  year: 2026,
  lastUpdated: '2026-05-01',
  source: 'GS-FR 2026',
  currencyByLang: { fr: 'EUR', en: 'GBP', es: 'EUR', de: 'EUR', ja: 'JPY' },
  prices: {
    'fr-oeufs-standard': {
      fr: [
        { size: 6, unit: 'pcs', price: 1.80 },
        { size: 12, unit: 'pcs', price: 3.20 },
      ],
      en: [{ size: 6, unit: 'pcs', price: 1.50 }],
    },
    'gp-spaghetti': {
      fr: [{ size: 500, unit: 'g', price: 0.95 }],
    },
  },
}

describe('mergePricingEdits', () => {
  it('renvoie un nouveau pricing avec lastUpdated à la date courante', () => {
    const r = mergePricingEdits(SAMPLE_PRICING, {}, FIXED_DATE)
    expect(r.lastUpdated).toBe('2026-05-04')
  })

  it('ne mute pas l\'objet d\'origine', () => {
    const original = JSON.parse(JSON.stringify(SAMPLE_PRICING))
    mergePricingEdits(SAMPLE_PRICING, { 'fr-oeufs-standard': { fr: [{ size: 6, unit: 'pcs', price: 99 }] } }, FIXED_DATE)
    expect(SAMPLE_PRICING).toEqual(original)
  })

  it('override les packs d\'un ingrédient existant', () => {
    const edits = {
      'fr-oeufs-standard': {
        fr: [{ size: 6, unit: 'pcs', price: 2.00 }],
      },
    }
    const r = mergePricingEdits(SAMPLE_PRICING, edits, FIXED_DATE)
    expect(r.prices['fr-oeufs-standard'].fr[0].price).toBe(2.00)
    // Les packs originaux EN ne sont pas touchés (override REMPLACE l'objet entier)
    // → le caller doit fournir toutes les langues qu'il veut conserver
  })

  it('ajoute un nouvel ingrédient absent du base pricing', () => {
    const edits = {
      'gp-new-ingredient': {
        fr: [{ size: 1, unit: 'kg', price: 5 }],
      },
    }
    const r = mergePricingEdits(SAMPLE_PRICING, edits, FIXED_DATE)
    expect(r.prices['gp-new-ingredient']).toBeDefined()
    expect(r.prices['gp-new-ingredient'].fr[0].price).toBe(5)
    // Les ingrédients existants restent
    expect(r.prices['gp-spaghetti']).toBeDefined()
  })

  it('preserve les autres ingrédients (gp-spaghetti) lors d\'un override partiel', () => {
    const edits = { 'fr-oeufs-standard': { fr: [{ size: 6, unit: 'pcs', price: 9 }] } }
    const r = mergePricingEdits(SAMPLE_PRICING, edits, FIXED_DATE)
    expect(r.prices['gp-spaghetti']).toEqual(SAMPLE_PRICING.prices['gp-spaghetti'])
  })

  it('preserve les meta (year, source, currencyByLang)', () => {
    const r = mergePricingEdits(SAMPLE_PRICING, {}, FIXED_DATE)
    expect(r.year).toBe(2026)
    expect(r.source).toBe('GS-FR 2026')
    expect(r.currencyByLang).toEqual(SAMPLE_PRICING.currencyByLang)
  })

  it('edits null/undefined → no-op (juste lastUpdated maj)', () => {
    expect(mergePricingEdits(SAMPLE_PRICING, null, FIXED_DATE).prices)
      .toEqual(SAMPLE_PRICING.prices)
    expect(mergePricingEdits(SAMPLE_PRICING, undefined, FIXED_DATE).prices)
      .toEqual(SAMPLE_PRICING.prices)
  })

  it('throw si basePricing absent', () => {
    expect(() => mergePricingEdits(null, {})).toThrow(TypeError)
    expect(() => mergePricingEdits(undefined, {})).toThrow(TypeError)
  })

  it('skip silencieusement les edits malformés', () => {
    const edits = {
      '': { fr: [] },               // id vide
      'gp-x': null,                 // pas un objet
      'gp-y': 'not-an-object',      // pas un objet
      'gp-spaghetti': { fr: [{ size: 1, unit: 'kg', price: 9 }] }, // valide
    }
    const r = mergePricingEdits(SAMPLE_PRICING, edits, FIXED_DATE)
    expect(r.prices['gp-spaghetti'].fr[0].price).toBe(9)
    expect(r.prices['']).toBeUndefined()
    expect(r.prices['gp-x']).toBeUndefined()
  })
})

describe('formatPricingForDownload', () => {
  it('renvoie un JSON indenté 2 espaces + newline final', () => {
    const out = formatPricingForDownload({ a: 1 })
    expect(out).toBe('{\n  "a": 1\n}\n')
  })

  it('reproduit le format de scripts/generate-pricing-json.mjs (idempotent)', () => {
    const out = formatPricingForDownload(SAMPLE_PRICING)
    expect(out.endsWith('\n')).toBe(true)
    expect(out).toContain('  "year": 2026')
    expect(out).toContain('  "prices": {')
  })
})

describe('getDownloadFilename', () => {
  it('utilise l\'année du pricing', () => {
    expect(getDownloadFilename({ year: 2026 })).toBe('pricing-2026.json')
    expect(getDownloadFilename({ year: 2030 })).toBe('pricing-2030.json')
  })

  it('fallback sur l\'année courante si year manquant', () => {
    const currentYear = new Date().getFullYear()
    expect(getDownloadFilename({})).toBe(`pricing-${currentYear}.json`)
    expect(getDownloadFilename(null)).toBe(`pricing-${currentYear}.json`)
  })
})

describe('countPricedIngredients', () => {
  it('compte les clés de prices', () => {
    expect(countPricedIngredients(SAMPLE_PRICING)).toBe(2)
    expect(countPricedIngredients({ prices: {} })).toBe(0)
    expect(countPricedIngredients({})).toBe(0)
    expect(countPricedIngredients(null)).toBe(0)
  })
})

describe('validateEdits', () => {
  it('valid: true pour edits vides', () => {
    expect(validateEdits({})).toEqual({ valid: true, errors: [] })
    expect(validateEdits(null)).toEqual({ valid: true, errors: [] })
  })

  it('valid: true pour edits corrects', () => {
    const edits = {
      'gp-x': { fr: [{ size: 500, unit: 'g', price: 1.5 }] },
    }
    expect(validateEdits(edits).valid).toBe(true)
  })

  it('détecte un prix négatif', () => {
    const edits = { 'gp-x': { fr: [{ size: 500, unit: 'g', price: -1 }] } }
    const r = validateEdits(edits)
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatchObject({ id: 'gp-x', lang: 'fr', packIdx: 0, reason: 'invalid_price' })
  })

  it('détecte un prix NaN ou null', () => {
    const edits = {
      'gp-x': { fr: [{ size: 500, unit: 'g', price: NaN }] },
      'gp-y': { fr: [{ size: 500, unit: 'g', price: null }] },
    }
    const r = validateEdits(edits)
    expect(r.valid).toBe(false)
    expect(r.errors).toHaveLength(2)
  })

  it('détecte une unité manquante', () => {
    const edits = { 'gp-x': { fr: [{ size: 500, unit: '', price: 1 }] } }
    const r = validateEdits(edits)
    expect(r.valid).toBe(false)
    expect(r.errors[0].reason).toBe('missing_unit')
  })

  it('détecte une taille invalide', () => {
    const edits = { 'gp-x': { fr: [{ size: 0, unit: 'g', price: 1 }] } }
    const r = validateEdits(edits)
    expect(r.valid).toBe(false)
    expect(r.errors.find(e => e.reason === 'invalid_size')).toBeDefined()
  })

  it('cumule plusieurs erreurs sur le même pack', () => {
    const edits = { 'gp-x': { fr: [{ size: -1, unit: '', price: 0 }] } }
    const r = validateEdits(edits)
    expect(r.valid).toBe(false)
    expect(r.errors.length).toBeGreaterThanOrEqual(3)
  })
})

describe('intégration mergePricingEdits + formatPricingForDownload', () => {
  it('le JSON exporté est parsable et contient les modifs', () => {
    const edits = { 'gp-spaghetti': { fr: [{ size: 500, unit: 'g', price: 1.50 }] } }
    const merged = mergePricingEdits(SAMPLE_PRICING, edits, FIXED_DATE)
    const json = formatPricingForDownload(merged)
    const reparsed = JSON.parse(json)
    expect(reparsed.prices['gp-spaghetti'].fr[0].price).toBe(1.50)
    expect(reparsed.lastUpdated).toBe('2026-05-04')
  })
})
