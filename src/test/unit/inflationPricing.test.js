import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Helpers extraits du script (testables unitairement) ─────────────────────
// On reproduit ici la logique pure du script pour l'isoler des I/O.

function roundPrice(price, lang) {
  if (lang === 'ja') return Math.round(price / 5) * 5
  return Math.round(price * 100) / 100
}

function buildCategorize(categories) {
  return function categorize(id) {
    for (const cat of categories) {
      for (const pattern of cat.match_id_contains) {
        if (id.includes(pattern)) return cat.coicop
      }
    }
    return null
  }
}

function applyRatio(prices, ratios, categorize) {
  const batch = {}
  let adjusted = 0
  let skipped = 0

  for (const [id, byLang] of Object.entries(prices)) {
    const coicop = categorize(id)
    if (!coicop || !ratios[coicop]) { skipped++; continue }

    const ratio = ratios[coicop]
    const adjustedByLang = {}
    for (const [lang, packs] of Object.entries(byLang)) {
      adjustedByLang[lang] = packs.map(p => ({ ...p, price: roundPrice(p.price * ratio, lang) }))
    }
    batch[id] = adjustedByLang
    adjusted++
  }

  return { batch, adjusted, skipped }
}

// ─── Données de test ──────────────────────────────────────────────────────────

const MAPPING_PATH = resolve(process.cwd(), 'scripts/data/eurostat-mapping.json')
const { categories } = JSON.parse(readFileSync(MAPPING_PATH, 'utf8'))
const categorize = buildCategorize(categories)

const SAMPLE_PRICES = {
  'fr-oeufs-standard': {
    fr: [{ size: 6, unit: 'pcs', price: 1.80 }],
  },
  'fr-lait-entier': {
    fr: [{ size: 1, unit: 'L', price: 1.20 }],
    en: [{ size: 1, unit: 'L', price: 1.10 }],
  },
  'fr-poulet': {
    fr: [{ size: 1, unit: 'kg', price: 9.00 }],
    en: [{ size: 1, unit: 'kg', price: 8.50 }],
  },
  'fr-saumon': {
    fr: [{ size: 300, unit: 'g', price: 6.50 }],
  },
  'fr-pomme': {
    fr: [{ size: 1, unit: 'kg', price: 2.90 }],
  },
  'vg-carottes': {
    fr: [{ size: 1, unit: 'kg', price: 1.50 }],
  },
  'gp-spaghetti': {
    fr: [{ size: 500, unit: 'g', price: 1.20 }],
  },
  'sp-huile-olive-ex': {
    fr: [{ size: 750, unit: 'ml', price: 8.50 }],
  },
}

const RATIOS = {
  CP0114: 1.03,  // +3% lait/fromage/œufs
  CP0112: 1.05,  // +5% viandes
  CP0113: 1.02,  // +2% poissons
  CP0116: 0.98,  // -2% fruits
  CP0117: 1.04,  // +4% légumes
  CP0111: 1.025, // +2.5% pain/céréales
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('roundPrice', () => {
  it('arrondit EUR à 2 décimales', () => {
    expect(roundPrice(1.234, 'fr')).toBe(1.23)
    expect(roundPrice(1.235, 'fr')).toBe(1.24)
    expect(roundPrice(2.999, 'de')).toBe(3.00)
  })

  it('arrondit JPY au multiple de 5', () => {
    expect(roundPrice(372, 'ja')).toBe(370)
    expect(roundPrice(373, 'ja')).toBe(375)
    expect(roundPrice(375, 'ja')).toBe(375)
    expect(roundPrice(378, 'ja')).toBe(380)
  })

  it('0 reste 0', () => {
    expect(roundPrice(0, 'fr')).toBe(0)
    expect(roundPrice(0, 'ja')).toBe(0)
  })
})

describe('categorize — mapping eurostat-mapping.json', () => {
  it('classifie les œufs en CP0114', () => {
    expect(categorize('fr-oeufs-standard')).toBe('CP0114')
  })

  it('classifie le lait en CP0114', () => {
    expect(categorize('fr-lait-entier')).toBe('CP0114')
  })

  it('classifie le poulet en CP0112', () => {
    expect(categorize('fr-poulet')).toBe('CP0112')
  })

  it('classifie le saumon en CP0113', () => {
    expect(categorize('fr-saumon')).toBe('CP0113')
  })

  it('classifie les pommes en CP0116', () => {
    expect(categorize('fr-pomme')).toBe('CP0116')
  })

  it('classifie les carottes en CP0117', () => {
    expect(categorize('vg-carottes')).toBe('CP0117')
  })

  it('classifie les spaghettis en CP0111', () => {
    expect(categorize('gp-spaghetti')).toBe('CP0111')
  })

  it('classifie le riz en CP0111', () => {
    expect(categorize('gp-riz-basmati')).toBe('CP0111')
  })

  it("ne classifie pas les épices (sp-)", () => {
    expect(categorize('sp-huile-olive-ex')).toBeNull()
  })

  it('classifie les crevettes surgelées en CP0113', () => {
    expect(categorize('frz-crevettes')).toBe('CP0113')
  })

  it('classifie les légumes surgelés en CP0117', () => {
    expect(categorize('frz-brocoli')).toBe('CP0117')
  })

  it('classifie la dinde en CP0112', () => {
    expect(categorize('fr-dinde')).toBe('CP0112')
  })
})

describe('applyRatio', () => {
  it('ajuste les prix selon les ratios', () => {
    const { batch } = applyRatio(SAMPLE_PRICES, RATIOS, categorize)

    // Œufs : +3%
    expect(batch['fr-oeufs-standard'].fr[0].price).toBe(roundPrice(1.80 * 1.03, 'fr'))
    // Poulet : +5%
    expect(batch['fr-poulet'].fr[0].price).toBe(roundPrice(9.00 * 1.05, 'fr'))
    // Saumon : +2%
    expect(batch['fr-saumon'].fr[0].price).toBe(roundPrice(6.50 * 1.02, 'fr'))
    // Fruits : -2%
    expect(batch['fr-pomme'].fr[0].price).toBe(roundPrice(2.90 * 0.98, 'fr'))
    // Légumes : +4%
    expect(batch['vg-carottes'].fr[0].price).toBe(roundPrice(1.50 * 1.04, 'fr'))
    // Céréales : +2.5%
    expect(batch['gp-spaghetti'].fr[0].price).toBe(roundPrice(1.20 * 1.025, 'fr'))
  })

  it('ne touche pas les ingrédients non catégorisés', () => {
    const { batch, skipped } = applyRatio(SAMPLE_PRICES, RATIOS, categorize)
    expect(batch['sp-huile-olive-ex']).toBeUndefined()
    expect(skipped).toBeGreaterThan(0)
  })

  it('respecte le nombre d\'ajustements + skips = total', () => {
    const { adjusted, skipped } = applyRatio(SAMPLE_PRICES, RATIOS, categorize)
    expect(adjusted + skipped).toBe(Object.keys(SAMPLE_PRICES).length)
  })

  it('ne modifie pas les champs hors price (size, unit conservés)', () => {
    const { batch } = applyRatio(SAMPLE_PRICES, RATIOS, categorize)
    expect(batch['fr-poulet'].fr[0].size).toBe(1)
    expect(batch['fr-poulet'].fr[0].unit).toBe('kg')
  })

  it('gère les ratios neutres (×1) sans modifier les prix', () => {
    const neutralRatios = Object.fromEntries(Object.keys(RATIOS).map(k => [k, 1.0]))
    const { batch } = applyRatio(SAMPLE_PRICES, neutralRatios, categorize)
    expect(batch['fr-lait-entier'].fr[0].price).toBe(1.20)
  })

  it('retourne un batch vide si aucun ratio fourni', () => {
    const { batch, adjusted, skipped } = applyRatio(SAMPLE_PRICES, {}, categorize)
    expect(Object.keys(batch)).toHaveLength(0)
    expect(adjusted).toBe(0)
    expect(skipped).toBe(Object.keys(SAMPLE_PRICES).length)
  })
})

describe('mapping JSON — intégrité structurelle', () => {
  it('le fichier eurostat-mapping.json est valide JSON avec un tableau categories', () => {
    expect(Array.isArray(categories)).toBe(true)
    expect(categories.length).toBeGreaterThan(0)
  })

  it('chaque catégorie a coicop, label_fr, label_en, match_id_contains[]', () => {
    for (const cat of categories) {
      expect(typeof cat.coicop).toBe('string')
      expect(typeof cat.label_fr).toBe('string')
      expect(typeof cat.label_en).toBe('string')
      expect(Array.isArray(cat.match_id_contains)).toBe(true)
      expect(cat.match_id_contains.length).toBeGreaterThan(0)
    }
  })

  it('les 6 codes COICOP attendus sont présents', () => {
    const codes = categories.map(c => c.coicop)
    expect(codes).toContain('CP0111')
    expect(codes).toContain('CP0112')
    expect(codes).toContain('CP0113')
    expect(codes).toContain('CP0114')
    expect(codes).toContain('CP0116')
    expect(codes).toContain('CP0117')
  })
})
