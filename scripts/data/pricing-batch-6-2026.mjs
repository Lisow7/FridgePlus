/**
 * Lot 6 — enrichissement pricing pour v3.37.0 (Phase E.7).
 *
 * Cible :
 *   - herbs (13 entrées — sous-cat à 0 %, herbes fraîches en barquette)
 *   - frozen-fish (12 entrées — poissons et fruits de mer surgelés)
 *   - frozen-bread (12 entrées — sous-cat à 0 %)
 *   - canned (10 entrées — conserves spéciales restantes)
 *   - oils (12 entrées — huiles + vinaigres restants)
 *
 * Sources : référence grande surface FR 2025-2026.
 *
 * Note herbes fraîches : barquette ~25-30g (~ 1 botte) standard. Les
 * variétés sèches en pots seront ajoutées dans un lot ultérieur.
 */

export const PRICING_BATCH_6 = {
  // ─── HERBS — herbes fraîches en barquette (13 entrées, sous-cat à 0%) ─
  'sp-basilic': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }, { size: 1, unit: 'pcs', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 1.80 }],
    es: [{ size: 25, unit: 'g', price: 1.50 }],
    de: [{ size: 25, unit: 'g', price: 1.80 }],
    ja: [{ size: 25, unit: 'g', price: 380 }],
  },
  'sp-ciboulette': {
    fr: [{ size: 1, unit: 'botte', price: 1.50 }, { size: 25, unit: 'g', price: 1.50 }],
    en: [{ size: 25, unit: 'g', price: 1.50 }],
    es: [{ size: 25, unit: 'g', price: 1.20 }],
    de: [{ size: 25, unit: 'g', price: 1.50 }],
    ja: [{ size: 25, unit: 'g', price: 320 }],
  },
  'sp-coriandre': {
    fr: [{ size: 1, unit: 'botte', price: 1.20 }, { size: 25, unit: 'g', price: 1.50 }],
    en: [{ size: 25, unit: 'g', price: 1.50 }],
    es: [{ size: 25, unit: 'g', price: 1.20 }],
    de: [{ size: 25, unit: 'g', price: 1.50 }],
    ja: [{ size: 25, unit: 'g', price: 320 }],
  },
  'sp-estragon': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }, { size: 1, unit: 'botte', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 1.80 }],
    es: [{ size: 25, unit: 'g', price: 1.50 }],
    de: [{ size: 25, unit: 'g', price: 1.80 }],
    ja: [{ size: 25, unit: 'g', price: 380 }],
  },
  'sp-herbes-prov': {
    // Sec, pot 30g standard
    fr: [{ size: 30, unit: 'g', price: 1.80 }, { size: 70, unit: 'g', price: 3.50 }],
    en: [{ size: 30, unit: 'g', price: 1.70 }],
    es: [{ size: 30, unit: 'g', price: 1.50 }],
    de: [{ size: 30, unit: 'g', price: 1.80 }],
    ja: [{ size: 30, unit: 'g', price: 380 }],
  },
  'sp-laurier': {
    // Sec, pot
    fr: [{ size: 12, unit: 'g', price: 1.50 }, { size: 30, unit: 'g', price: 2.80 }],
    en: [{ size: 12, unit: 'g', price: 1.40 }],
    es: [{ size: 12, unit: 'g', price: 1.20 }],
    de: [{ size: 12, unit: 'g', price: 1.50 }],
    ja: [{ size: 12, unit: 'g', price: 320 }],
  },
  'sp-menthe': {
    fr: [{ size: 1, unit: 'botte', price: 1.20 }, { size: 25, unit: 'g', price: 1.50 }],
    en: [{ size: 25, unit: 'g', price: 1.50 }],
    es: [{ size: 25, unit: 'g', price: 1.20 }],
    de: [{ size: 25, unit: 'g', price: 1.50 }],
    ja: [{ size: 25, unit: 'g', price: 320 }],
  },
  'sp-origan': {
    fr: [{ size: 30, unit: 'g', price: 1.80 }, { size: 60, unit: 'g', price: 3.20 }],
    en: [{ size: 30, unit: 'g', price: 1.70 }],
    es: [{ size: 30, unit: 'g', price: 1.50 }],
    de: [{ size: 30, unit: 'g', price: 1.80 }],
    ja: [{ size: 30, unit: 'g', price: 380 }],
  },
  'sp-persil': {
    fr: [{ size: 1, unit: 'botte', price: 1.20 }, { size: 30, unit: 'g', price: 1.50 }],
    en: [{ size: 30, unit: 'g', price: 1.50 }],
    es: [{ size: 30, unit: 'g', price: 1.20 }],
    de: [{ size: 30, unit: 'g', price: 1.50 }],
    ja: [{ size: 30, unit: 'g', price: 320 }],
  },
  'sp-romarin': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }, { size: 1, unit: 'botte', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 1.80 }],
    es: [{ size: 25, unit: 'g', price: 1.50 }],
    de: [{ size: 25, unit: 'g', price: 1.80 }],
    ja: [{ size: 25, unit: 'g', price: 380 }],
  },
  'sp-sauge': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }, { size: 1, unit: 'botte', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 1.80 }],
    es: [{ size: 25, unit: 'g', price: 1.50 }],
    de: [{ size: 25, unit: 'g', price: 1.80 }],
    ja: [{ size: 25, unit: 'g', price: 380 }],
  },
  'sp-thym': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }, { size: 1, unit: 'botte', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 1.80 }],
    es: [{ size: 25, unit: 'g', price: 1.50 }],
    de: [{ size: 25, unit: 'g', price: 1.80 }],
    ja: [{ size: 25, unit: 'g', price: 380 }],
  },
  'sp-aneth': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }, { size: 1, unit: 'botte', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 1.80 }],
    es: [{ size: 25, unit: 'g', price: 1.50 }],
    de: [{ size: 25, unit: 'g', price: 1.80 }],
    ja: [{ size: 25, unit: 'g', price: 380 }],
  },

  // ─── FROZEN-FISH (12 entrées) ─────────────────────────────────────────
  'frz-cabillaud': {
    // Filet surgelé sachet
    fr: [{ size: 400, unit: 'g', price: 6.80 }, { size: 800, unit: 'g', price: 12.50 }],
    en: [{ size: 400, unit: 'g', price: 6.50 }],
    es: [{ size: 400, unit: 'g', price: 5.50 }],
    de: [{ size: 400, unit: 'g', price: 6.80 }],
    ja: [{ size: 400, unit: 'g', price: 980 }],
  },
  'frz-colin': {
    fr: [{ size: 400, unit: 'g', price: 5.20 }, { size: 800, unit: 'g', price: 9.50 }],
    en: [{ size: 400, unit: 'g', price: 5.00 }],
    es: [{ size: 400, unit: 'g', price: 4.20 }],
    de: [{ size: 400, unit: 'g', price: 5.20 }],
    ja: [{ size: 400, unit: 'g', price: 780 }],
  },
  'frz-daurade': {
    fr: [{ size: 400, unit: 'g', price: 7.50 }, { size: 800, unit: 'g', price: 13.50 }],
    en: [{ size: 400, unit: 'g', price: 7.20 }],
    es: [{ size: 400, unit: 'g', price: 6.20 }],
    de: [{ size: 400, unit: 'g', price: 7.50 }],
    ja: [{ size: 400, unit: 'g', price: 1180 }],
  },
  'frz-pangasius': {
    fr: [{ size: 500, unit: 'g', price: 4.20 }, { size: 1, unit: 'kg', price: 7.50 }],
    en: [{ size: 1, unit: 'kg', price: 6.80 }],
    es: [{ size: 1, unit: 'kg', price: 5.50 }],
    de: [{ size: 1, unit: 'kg', price: 6.80 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'frz-thon-steak': {
    fr: [{ size: 400, unit: 'g', price: 8.50 }, { size: 600, unit: 'g', price: 12.50 }],
    en: [{ size: 400, unit: 'g', price: 8.00 }],
    es: [{ size: 400, unit: 'g', price: 7.00 }],
    de: [{ size: 400, unit: 'g', price: 8.50 }],
    ja: [{ size: 400, unit: 'g', price: 1380 }],
  },
  'frz-fruits-mer': {
    fr: [{ size: 400, unit: 'g', price: 5.50 }, { size: 750, unit: 'g', price: 9.80 }],
    en: [{ size: 400, unit: 'g', price: 5.20 }],
    es: [{ size: 400, unit: 'g', price: 4.50 }],
    de: [{ size: 400, unit: 'g', price: 5.50 }],
    ja: [{ size: 400, unit: 'g', price: 880 }],
  },
  'frz-crevettes': {
    fr: [{ size: 250, unit: 'g', price: 4.80 }, { size: 500, unit: 'g', price: 8.80 }],
    en: [{ size: 500, unit: 'g', price: 8.00 }],
    es: [{ size: 500, unit: 'g', price: 6.50 }],
    de: [{ size: 500, unit: 'g', price: 7.80 }],
    ja: [{ size: 250, unit: 'g', price: 780 }],
  },
  'frz-coquilles': {
    fr: [{ size: 250, unit: 'g', price: 9.50 }, { size: 500, unit: 'g', price: 17.50 }],
    en: [{ size: 250, unit: 'g', price: 9.00 }],
    es: [{ size: 250, unit: 'g', price: 8.00 }],
    de: [{ size: 250, unit: 'g', price: 9.50 }],
    ja: [{ size: 250, unit: 'g', price: 1480 }],
  },
  'frz-moules': {
    fr: [{ size: 500, unit: 'g', price: 4.50 }, { size: 1, unit: 'kg', price: 7.80 }],
    en: [{ size: 1, unit: 'kg', price: 7.50 }],
    es: [{ size: 1, unit: 'kg', price: 6.20 }],
    de: [{ size: 1, unit: 'kg', price: 7.50 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'frz-calamars': {
    fr: [{ size: 400, unit: 'g', price: 6.50 }, { size: 750, unit: 'g', price: 11.50 }],
    en: [{ size: 400, unit: 'g', price: 6.00 }],
    es: [{ size: 400, unit: 'g', price: 5.00 }],
    de: [{ size: 400, unit: 'g', price: 6.20 }],
    ja: [{ size: 400, unit: 'g', price: 880 }],
  },
  'frz-surimi': {
    fr: [{ size: 200, unit: 'g', price: 2.20 }, { size: 400, unit: 'g', price: 3.80 }],
    en: [{ size: 200, unit: 'g', price: 2.00 }],
    es: [{ size: 200, unit: 'g', price: 1.80 }],
    de: [{ size: 200, unit: 'g', price: 2.20 }],
    ja: [{ size: 200, unit: 'g', price: 380 }],
  },

  // ─── FROZEN-BREAD (12 entrées — sous-cat à 0 %) ───────────────────────
  'frz-croissant': {
    fr: [{ size: 12, unit: 'pcs', price: 4.20 }, { size: 24, unit: 'pcs', price: 7.50 }],
    en: [{ size: 12, unit: 'pcs', price: 4.00 }],
    es: [{ size: 12, unit: 'pcs', price: 3.50 }],
    de: [{ size: 12, unit: 'pcs', price: 4.20 }],
    ja: [{ size: 12, unit: 'pcs', price: 880 }],
  },
  'frz-chocolatine': {
    fr: [{ size: 12, unit: 'pcs', price: 4.50 }, { size: 24, unit: 'pcs', price: 8.20 }],
    en: [{ size: 12, unit: 'pcs', price: 4.20 }],
    es: [{ size: 12, unit: 'pcs', price: 3.80 }],
    de: [{ size: 12, unit: 'pcs', price: 4.50 }],
    ja: [{ size: 12, unit: 'pcs', price: 980 }],
  },
  'frz-chausson': {
    fr: [{ size: 6, unit: 'pcs', price: 3.80 }, { size: 12, unit: 'pcs', price: 6.50 }],
    en: [{ size: 6, unit: 'pcs', price: 3.50 }],
    es: [{ size: 6, unit: 'pcs', price: 3.00 }],
    de: [{ size: 6, unit: 'pcs', price: 3.80 }],
    ja: [{ size: 6, unit: 'pcs', price: 780 }],
  },
  'frz-brioche': {
    fr: [{ size: 1, unit: 'pcs', price: 3.50 }, { size: 500, unit: 'g', price: 4.20 }],
    en: [{ size: 1, unit: 'pcs', price: 3.20 }],
    es: [{ size: 1, unit: 'pcs', price: 2.80 }],
    de: [{ size: 1, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 680 }],
  },
  'frz-baguette': {
    fr: [{ size: 4, unit: 'pcs', price: 3.50 }, { size: 8, unit: 'pcs', price: 6.50 }],
    en: [{ size: 4, unit: 'pcs', price: 3.20 }],
    es: [{ size: 4, unit: 'pcs', price: 2.80 }],
    de: [{ size: 4, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 4, unit: 'pcs', price: 680 }],
  },
  'frz-pain-campagne': {
    fr: [{ size: 1, unit: 'pcs', price: 2.50 }, { size: 500, unit: 'g', price: 2.80 }],
    en: [{ size: 1, unit: 'pcs', price: 2.30 }],
    es: [{ size: 1, unit: 'pcs', price: 2.00 }],
    de: [{ size: 1, unit: 'pcs', price: 2.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 480 }],
  },
  'frz-pain-cereales': {
    fr: [{ size: 1, unit: 'pcs', price: 2.80 }, { size: 500, unit: 'g', price: 3.20 }],
    en: [{ size: 1, unit: 'pcs', price: 2.60 }],
    es: [{ size: 1, unit: 'pcs', price: 2.20 }],
    de: [{ size: 1, unit: 'pcs', price: 2.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 580 }],
  },
  'frz-pain-hamburger': {
    fr: [{ size: 8, unit: 'pcs', price: 3.20 }, { size: 12, unit: 'pcs', price: 4.50 }],
    en: [{ size: 8, unit: 'pcs', price: 3.00 }],
    es: [{ size: 8, unit: 'pcs', price: 2.50 }],
    de: [{ size: 8, unit: 'pcs', price: 3.20 }],
    ja: [{ size: 8, unit: 'pcs', price: 680 }],
  },
  'frz-pain-mie': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }, { size: 750, unit: 'g', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 2.20 }],
    es: [{ size: 500, unit: 'g', price: 1.80 }],
    de: [{ size: 500, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'frz-pain-epi': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 4, unit: 'pcs', price: 6.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.70 }],
    es: [{ size: 1, unit: 'pcs', price: 1.50 }],
    de: [{ size: 1, unit: 'pcs', price: 1.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 380 }],
  },

  // ─── CANNED (10 entrées — algues + autres conserves) ──────────────────
  'gp-algues': {
    // Sachet algues mixtes 30g
    fr: [{ size: 30, unit: 'g', price: 4.50 }, { size: 50, unit: 'g', price: 6.80 }],
    en: [{ size: 30, unit: 'g', price: 4.20 }],
    es: [{ size: 30, unit: 'g', price: 3.80 }],
    de: [{ size: 30, unit: 'g', price: 4.50 }],
    ja: [{ size: 30, unit: 'g', price: 480 }],
  },
  'gp-nori': {
    // Feuilles 25g (~10 feuilles)
    fr: [{ size: 25, unit: 'g', price: 3.20 }, { size: 50, unit: 'g', price: 5.80 }],
    en: [{ size: 25, unit: 'g', price: 3.00 }],
    es: [{ size: 25, unit: 'g', price: 2.50 }],
    de: [{ size: 25, unit: 'g', price: 3.20 }],
    ja: [{ size: 25, unit: 'g', price: 280 }],
  },
  'gp-wakame': {
    fr: [{ size: 30, unit: 'g', price: 3.50 }, { size: 50, unit: 'g', price: 5.50 }],
    en: [{ size: 30, unit: 'g', price: 3.20 }],
    es: [{ size: 30, unit: 'g', price: 2.80 }],
    de: [{ size: 30, unit: 'g', price: 3.50 }],
    ja: [{ size: 30, unit: 'g', price: 380 }],
  },
  'gp-kombu': {
    fr: [{ size: 30, unit: 'g', price: 4.20 }, { size: 50, unit: 'g', price: 6.50 }],
    en: [{ size: 30, unit: 'g', price: 4.00 }],
    es: [{ size: 30, unit: 'g', price: 3.50 }],
    de: [{ size: 30, unit: 'g', price: 4.20 }],
    ja: [{ size: 30, unit: 'g', price: 480 }],
  },
  'gp-shiitake-sec': {
    fr: [{ size: 30, unit: 'g', price: 3.80 }, { size: 50, unit: 'g', price: 5.80 }],
    en: [{ size: 30, unit: 'g', price: 3.50 }],
    es: [{ size: 30, unit: 'g', price: 3.00 }],
    de: [{ size: 30, unit: 'g', price: 3.80 }],
    ja: [{ size: 30, unit: 'g', price: 580 }],
  },
  'gp-citrons-confits': {
    fr: [{ size: 200, unit: 'g', price: 4.20 }, { size: 350, unit: 'g', price: 6.80 }],
    en: [{ size: 200, unit: 'g', price: 4.00 }],
    es: [{ size: 200, unit: 'g', price: 3.50 }],
    de: [{ size: 200, unit: 'g', price: 4.20 }],
    ja: [{ size: 200, unit: 'g', price: 880 }],
  },
  'gp-cassoulet': {
    // Boîte 840g ou 1500g (familial)
    fr: [{ size: 840, unit: 'g', price: 4.20 }, { size: 1500, unit: 'g', price: 6.80 }],
    en: [{ size: 840, unit: 'g', price: 4.00 }],
    es: [{ size: 840, unit: 'g', price: 3.50 }],
    de: [{ size: 840, unit: 'g', price: 4.20 }],
    ja: [{ size: 840, unit: 'g', price: 880 }],
  },
  'gp-jackfruit': {
    fr: [{ size: 400, unit: 'g', price: 3.80 }, { size: 565, unit: 'g', price: 5.20 }],
    en: [{ size: 400, unit: 'g', price: 3.50 }],
    es: [{ size: 400, unit: 'g', price: 3.20 }],
    de: [{ size: 400, unit: 'g', price: 3.80 }],
    ja: [{ size: 400, unit: 'g', price: 780 }],
  },
  'gp-pates-curry': {
    fr: [{ size: 110, unit: 'g', price: 2.50 }, { size: 220, unit: 'g', price: 4.20 }],
    en: [{ size: 110, unit: 'g', price: 2.20 }],
    es: [{ size: 110, unit: 'g', price: 2.00 }],
    de: [{ size: 110, unit: 'g', price: 2.40 }],
    ja: [{ size: 110, unit: 'g', price: 480 }],
  },
  'gp-pate-tamarin': {
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 400, unit: 'g', price: 6.20 }],
    en: [{ size: 200, unit: 'g', price: 3.20 }],
    es: [{ size: 200, unit: 'g', price: 2.80 }],
    de: [{ size: 200, unit: 'g', price: 3.50 }],
    ja: [{ size: 200, unit: 'g', price: 580 }],
  },

  // ─── OILS (12 entrées — huiles + vinaigres restants) ──────────────────
  'sp-huile-olive': {
    // Parent générique = vierge standard (différent de l'extra vierge déjà couvert)
    fr: [{ size: 50, unit: 'cl', price: 5.80 }, { size: 75, unit: 'cl', price: 8.20 }, { size: 100, unit: 'cl', price: 10.50 }],
    en: [{ size: 50, unit: 'cl', price: 5.50 }],
    es: [{ size: 100, unit: 'cl', price: 7.80 }],
    de: [{ size: 50, unit: 'cl', price: 5.80 }],
    ja: [{ size: 50, unit: 'cl', price: 1280 }],
  },
  'sp-huile-arachide': {
    fr: [{ size: 100, unit: 'cl', price: 4.20 }, { size: 200, unit: 'cl', price: 7.80 }],
    en: [{ size: 100, unit: 'cl', price: 4.00 }],
    es: [{ size: 100, unit: 'cl', price: 3.50 }],
    de: [{ size: 100, unit: 'cl', price: 4.20 }],
    ja: [{ size: 100, unit: 'cl', price: 880 }],
  },
  'sp-huile-coco': {
    // Pot 250-500ml
    fr: [{ size: 250, unit: 'ml', price: 5.20 }, { size: 500, unit: 'ml', price: 9.50 }],
    en: [{ size: 250, unit: 'ml', price: 5.00 }],
    es: [{ size: 250, unit: 'ml', price: 4.50 }],
    de: [{ size: 250, unit: 'ml', price: 5.20 }],
    ja: [{ size: 250, unit: 'ml', price: 980 }],
  },
  'sp-huile-colza': {
    fr: [{ size: 100, unit: 'cl', price: 3.80 }, { size: 200, unit: 'cl', price: 6.80 }],
    en: [{ size: 100, unit: 'cl', price: 3.50 }],
    es: [{ size: 100, unit: 'cl', price: 3.00 }],
    de: [{ size: 100, unit: 'cl', price: 3.80 }],
    ja: [{ size: 100, unit: 'cl', price: 680 }],
  },
  'sp-huile-noisette': {
    fr: [{ size: 25, unit: 'cl', price: 6.50 }, { size: 50, unit: 'cl', price: 11.50 }],
    en: [{ size: 25, unit: 'cl', price: 6.20 }],
    es: [{ size: 25, unit: 'cl', price: 5.50 }],
    de: [{ size: 25, unit: 'cl', price: 6.50 }],
    ja: [{ size: 25, unit: 'cl', price: 1380 }],
  },
  'sp-huile-noix': {
    fr: [{ size: 25, unit: 'cl', price: 6.20 }, { size: 50, unit: 'cl', price: 11.00 }],
    en: [{ size: 25, unit: 'cl', price: 6.00 }],
    es: [{ size: 25, unit: 'cl', price: 5.20 }],
    de: [{ size: 25, unit: 'cl', price: 6.20 }],
    ja: [{ size: 25, unit: 'cl', price: 1280 }],
  },
  'sp-huile-sesame': {
    fr: [{ size: 25, unit: 'cl', price: 4.80 }, { size: 50, unit: 'cl', price: 8.50 }],
    en: [{ size: 25, unit: 'cl', price: 4.50 }],
    es: [{ size: 25, unit: 'cl', price: 4.00 }],
    de: [{ size: 25, unit: 'cl', price: 4.80 }],
    ja: [{ size: 50, unit: 'cl', price: 580 }],
  },
  'sp-vinaigre': {
    // Vinaigre alcool de table générique
    fr: [{ size: 100, unit: 'cl', price: 1.50 }, { size: 200, unit: 'cl', price: 2.80 }],
    en: [{ size: 100, unit: 'cl', price: 1.40 }],
    es: [{ size: 100, unit: 'cl', price: 1.20 }],
    de: [{ size: 100, unit: 'cl', price: 1.50 }],
    ja: [{ size: 100, unit: 'cl', price: 380 }],
  },
  'sp-vinaigre-blanc': {
    fr: [{ size: 100, unit: 'cl', price: 1.20 }, { size: 200, unit: 'cl', price: 2.20 }],
    en: [{ size: 100, unit: 'cl', price: 1.10 }],
    es: [{ size: 100, unit: 'cl', price: 0.95 }],
    de: [{ size: 100, unit: 'cl', price: 1.20 }],
    ja: [{ size: 100, unit: 'cl', price: 280 }],
  },
  'sp-vinaigre-riz': {
    fr: [{ size: 25, unit: 'cl', price: 2.80 }, { size: 50, unit: 'cl', price: 4.80 }],
    en: [{ size: 25, unit: 'cl', price: 2.50 }],
    es: [{ size: 25, unit: 'cl', price: 2.20 }],
    de: [{ size: 25, unit: 'cl', price: 2.80 }],
    ja: [{ size: 25, unit: 'cl', price: 480 }],
  },
  'sp-vinaigre-xeres': {
    fr: [{ size: 25, unit: 'cl', price: 4.20 }, { size: 50, unit: 'cl', price: 7.20 }],
    en: [{ size: 25, unit: 'cl', price: 4.00 }],
    es: [{ size: 25, unit: 'cl', price: 3.50 }],
    de: [{ size: 25, unit: 'cl', price: 4.20 }],
    ja: [{ size: 25, unit: 'cl', price: 880 }],
  },
}
