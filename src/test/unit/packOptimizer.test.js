import { describe, it, expect } from 'vitest'
import { optimizePackPurchase, hasPackData } from '@features/cart/lib/pack-optimizer'

describe('optimizePackPurchase', () => {
  describe('cas nominaux', () => {
    it('pack unique exact : besoin = taille d\'un pack disponible', () => {
      // gp-spaghetti FR : [{500, 0.95}, {1000, 1.70}]
      const r = optimizePackPurchase('gp-spaghetti', 500, 'g', 'fr')
      expect(r).not.toBeNull()
      expect(r.totalSize).toBe(500)
      expect(r.totalPrice).toBe(0.95)
      expect(r.packs).toHaveLength(1)
      expect(r.packs[0]).toMatchObject({ size: 500, unit: 'g', count: 1 })
    })

    it('pack unique > besoin : on prend le plus petit qui suffit si pas de combo moins chère', () => {
      // gp-farine-ble FR : [{1000, 0.95}, {5000, 4.20}] — besoin 800g → 1×1kg
      const r = optimizePackPurchase('gp-farine-ble', 800, 'g', 'fr')
      expect(r.totalSize).toBe(1000)
      expect(r.totalPrice).toBe(0.95)
      expect(r.packs).toHaveLength(1)
      expect(r.packs[0].size).toBe(1000)
    })

    it('combinaison gagne sur pack unique plus gros (rabais volume modéré)', () => {
      // gp-tomates-pelees FR : [{400, 0.80}, {800, 1.40}] — besoin 800g
      // 1×800g = 1.40€  vs  2×400g = 1.60€ → 1×800g gagne
      const r1 = optimizePackPurchase('gp-tomates-pelees', 800, 'g', 'fr')
      expect(r1.totalSize).toBe(800)
      expect(r1.totalPrice).toBe(1.40)
      expect(r1.packs).toHaveLength(1)
      expect(r1.packs[0].size).toBe(800)
      // Mais besoin 600g : 1×800g = 1.40€  vs  2×400g = 1.60€ → 1×800g
      const r2 = optimizePackPurchase('gp-tomates-pelees', 600, 'g', 'fr')
      expect(r2.totalSize).toBe(800)
    })

    it('combo de 2 petits packs moins chère qu\'un gros + un petit', () => {
      // fr-creme-liquide FR : [{20, 1.20}, {50, 2.60}] — besoin 60cl
      // 1×50cl + 1×20cl = 70cl, 3.80€  vs  3×20cl = 60cl, 3.60€ → 3×20cl
      const r = optimizePackPurchase('fr-creme-liquide', 60, 'cl', 'fr')
      expect(r.totalSize).toBe(60)
      expect(r.totalPrice).toBe(3.60)
      expect(r.packs).toHaveLength(1)
      expect(r.packs[0]).toMatchObject({ size: 20, count: 3 })
    })

    it('mix tailles : 1 gros + 1 moyen optimal', () => {
      // fr-blanc-poulet FR : [{300, 5.40}, {500, 8.50}, {1000, 16.00}]
      // besoin 1300g
      // - 2×1000g = 2000g, 32€
      // - 1×1000g + 1×500g = 1500g, 24.50€
      // - 1×1000g + 1×300g = 1300g, 21.40€  ← optimum
      // - 1×500g × 3 = 1500g, 25.50€
      const r = optimizePackPurchase('fr-blanc-poulet', 1300, 'g', 'fr')
      expect(r.totalSize).toBe(1300)
      expect(r.totalPrice).toBe(21.40)
      expect(r.packs).toHaveLength(2)
      // Tri ascendant attendu : 300 puis 1000
      expect(r.packs[0].size).toBe(300)
      expect(r.packs[1].size).toBe(1000)
    })
  })

  describe('cas pcs (œufs)', () => {
    it('œufs : 7 requis avec packs [6, 10, 12] → 1×10 (le plus économique au-dessus)', () => {
      // fr-oeufs-standard FR : [{6, 1.80}, {10, 2.80}, {12, 3.20}]
      // - 2×6 = 12, 3.60€
      // - 1×10 = 10, 2.80€  ← optimum
      // - 1×12 = 12, 3.20€
      const r = optimizePackPurchase('fr-oeufs-standard', 7, 'pcs', 'fr')
      expect(r.totalSize).toBe(10)
      expect(r.totalPrice).toBe(2.80)
      expect(r.packs[0].size).toBe(10)
    })

    it('œufs : très gros besoin (25 œufs) → combo non-évidente moins chère', () => {
      // Packs : [{6, 1.80}, {10, 2.80}, {12, 3.20}]
      // - 3×10 = 30 pcs, 8.40€
      // - 1×12 + 2×10 = 32, 8.80€
      // - 2×10 + 1×6 = 26 pcs, 7.40€  ← optimum (l'algo trouve mieux que 3×10 !)
      const r = optimizePackPurchase('fr-oeufs-standard', 25, 'pcs', 'fr')
      expect(r.totalPrice).toBe(7.40)
      expect(r.totalSize).toBe(26)
    })
  })

  describe('conversion d\'unités', () => {
    it('huile d\'olive : besoin en grammes (consolidé) → pack en cl', () => {
      // Quand consolidateItems convertit cs/cl mélangés en grammes pour l'huile,
      // l'optimiseur doit accepter le besoin en g et convertir vers cl.
      // 166g d'huile (densité ≈1) → 16.6 cl → pack 50cl le moins cher.
      const r = optimizePackPurchase('sp-huile-olive-ex', 166, 'g', 'fr')
      expect(r).not.toBeNull()
      expect(r.totalSize).toBe(50)
      expect(r.totalUnit).toBe('cl')
    })

    it('huile : besoin en cuillères → conversion vers cl', () => {
      // 30 cs ≈ 45 cl → pack 50cl
      const r = optimizePackPurchase('sp-huile-olive-ex', 30, 'cs', 'fr')
      expect(r).not.toBeNull()
      expect(r.totalUnit).toBe('cl')
      expect(r.totalSize).toBeGreaterThanOrEqual(45)
    })

    it('lait : besoin en kg (cas exotique) → pack en cl via densité', () => {
      // 1.5 kg de lait ≈ 150 cl → 1×100cl + 1×100cl ou 1×600cl, mais pack en
      // brique de 100cl. 2×100cl = 200cl = 2.40€ vs pack 600cl = 6.30€.
      const r = optimizePackPurchase('fr-lait-entier', 1.5, 'kg', 'fr')
      expect(r).not.toBeNull()
      expect(r.totalUnit).toBe('cl')
      expect(r.totalSize).toBeGreaterThanOrEqual(150)
    })
  })

  describe('multi-langue', () => {
    it('même besoin → choix différent selon la langue (packs disponibles différents)', () => {
      // fr-oeufs-standard EN : [{6, 1.50}, {12, 2.70}]  — pas de 10 pcs
      // besoin 7 pcs : 1×12 (puisque pas de 10)
      const en = optimizePackPurchase('fr-oeufs-standard', 7, 'pcs', 'en')
      expect(en.totalSize).toBe(12)
      expect(en.packs[0].size).toBe(12)
    })

    it('fallback vers fr si la langue demandée est absente', () => {
      // pas d'entrée 'pt' → fallback fr
      const r = optimizePackPurchase('gp-spaghetti', 500, 'g', 'pt')
      expect(r).not.toBeNull()
      expect(r.totalPrice).toBe(0.95)
    })
  })

  describe('cas null / edge', () => {
    it('ingrédient absent du fichier packSizes → null (fallback caller)', () => {
      // ID synthétique (préfixe `__test__-`) garanti absent
      // de packSizes.js. Auparavant on utilisait des IDs réels (`vg-radis`,
      // `vg-courgette`) qui finissaient par être ajoutés au catalogue,
      // cassant ce test.
      expect(optimizePackPurchase('__test__-no-pack-data', 500, 'g', 'fr')).toBeNull()
    })

    it('unit === \'pm\' (sel/herbes) → null', () => {
      expect(optimizePackPurchase('fr-beurre', null, 'pm', 'fr')).toBeNull()
      expect(optimizePackPurchase('gp-spaghetti', 100, 'PM', 'fr')).toBeNull()
    })

    it('amount null/zero → null', () => {
      expect(optimizePackPurchase('gp-spaghetti', null, 'g', 'fr')).toBeNull()
      expect(optimizePackPurchase('gp-spaghetti',    0, 'g', 'fr')).toBeNull()
    })

    it('ingredientId vide/null → null', () => {
      expect(optimizePackPurchase(null, 500, 'g', 'fr')).toBeNull()
      expect(optimizePackPurchase('',   500, 'g', 'fr')).toBeNull()
    })

    it('besoin > somme tous packs ne crash pas (algo couvre arbitrairement haut)', () => {
      // gp-spaghetti FR pack max = 1000g. Besoin 5000g → 5×1000g = 5000g, 8.50€
      const r = optimizePackPurchase('gp-spaghetti', 5000, 'g', 'fr')
      expect(r.totalSize).toBeGreaterThanOrEqual(5000)
      expect(r.packs.every(p => p.count > 0)).toBe(true)
    })

    it('idempotence : même input → même output (important pour useMemo React)', () => {
      const r1 = optimizePackPurchase('fr-blanc-poulet', 700, 'g', 'fr')
      const r2 = optimizePackPurchase('fr-blanc-poulet', 700, 'g', 'fr')
      expect(r1).toEqual(r2)
    })
  })

  describe('cohérence métier', () => {
    it('le total acheté est toujours ≥ au besoin (pas de manque)', () => {
      const cases = [
        ['gp-spaghetti',   123, 'g'],
        ['fr-blanc-poulet', 777, 'g'],
        ['fr-oeufs-standard', 4, 'pcs'],
        ['fr-creme-liquide', 35, 'cl'],
      ]
      for (const [id, amount, unit] of cases) {
        const r = optimizePackPurchase(id, amount, unit, 'fr')
        expect(r).not.toBeNull()
        expect(r.totalSize).toBeGreaterThanOrEqual(amount)
      }
    })

    it('le coût total = somme des price × count pour chaque pack', () => {
      const r = optimizePackPurchase('fr-blanc-poulet', 1300, 'g', 'fr')
      const sum = r.packs.reduce((acc, p) => acc + p.price * p.count, 0)
      expect(Math.round(sum * 100) / 100).toBe(r.totalPrice)
    })
  })
})

describe('hasPackData', () => {
  it('renvoie true si l\'ingrédient a des packs définis', () => {
    expect(hasPackData('gp-spaghetti', 'fr')).toBe(true)
    expect(hasPackData('fr-oeufs-standard', 'en')).toBe(true)
  })

  it('renvoie false si l\'ingrédient n\'est pas dans packSizes (vrac)', () => {
    // ID synthétique cf. test précédent.
    expect(hasPackData('__test__-no-pack-data', 'fr')).toBe(false)
  })

  it('fallback fr si la langue demandée est absente', () => {
    expect(hasPackData('gp-spaghetti', 'pt')).toBe(true)
  })
})

// Mécanisme `reconstitutes` : ingrédients concentrés/en pièce
// qui produisent une quantité X de l'ingrédient réel utilisé en cuisine.
describe('reconstitutes (v3.27.7)', () => {
  it('bouillon cube : 1 L de bouillon → 1 cube nécessaire (boîte de 6)', () => {
    // gp-bouillon-cube FR : packs en pcs [6, 12, 24]
    // recons['pcs'] = { amount: 100, unit: 'cl' } → 1 cube = 100 cl
    // Besoin : 1 L = 100 cl → ceil(100/100) = 1 cube → boîte 6 minimum
    const r = optimizePackPurchase('gp-bouillon-cube', 1, 'L', 'fr')
    expect(r).not.toBeNull()
    expect(r.totalSize).toBe(6) // plus petite boîte qui couvre ≥1 cube
    expect(r.totalPrice).toBe(0.95)
  })

  it('bouillon cube : 50 cl → 1 cube → boîte 6', () => {
    const r = optimizePackPurchase('gp-bouillon-cube', 50, 'cl', 'fr')
    expect(r.totalSize).toBe(6)
    expect(r.totalPrice).toBe(0.95)
  })

  it('bouillon cube : 5 L (gros pot-au-feu) → 5 cubes → boîte 6', () => {
    const r = optimizePackPurchase('gp-bouillon-cube', 5, 'L', 'fr')
    expect(r.totalSize).toBe(6)
    expect(r.totalPrice).toBe(0.95)
  })

  it('bouillon cube : 8 L → 8 cubes → boîte 12 (la 6 ne suffit pas)', () => {
    const r = optimizePackPurchase('gp-bouillon-cube', 8, 'L', 'fr')
    expect(r.totalSize).toBe(12)
    expect(r.totalPrice).toBe(1.50)
  })

  it('concentré de tomates : besoin équivalent coulis → conversion via ratio', () => {
    // gp-concentre-tom FR : packs en g [140, 280]
    // recons['g'] = { amount: 2.85, unit: 'g' } → 1g concentré ≈ 2.85g coulis
    // Si recette demande 200g de coulis → 200/2.85 ≈ 70g concentré → boîte 140g
    const r = optimizePackPurchase('gp-concentre-tom', 200, 'g', 'fr')
    expect(r).not.toBeNull()
    // toGrams marche déjà pour besoin en g — donc recons sert quand on a un
    // besoin en cl/L/cs (volume). Vérifions qu'un besoin en cs mène au bon
    // pack : 1 cs concentré (18g) → bien dans la première boîte 140g.
    const r2 = optimizePackPurchase('gp-concentre-tom', 1, 'cs', 'fr')
    expect(r2).not.toBeNull()
    expect(r2.totalSize).toBe(140)
  })
})
