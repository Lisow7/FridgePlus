/**
 * Lot 5 — enrichissement pricing pour v3.36.0 (Phase E.6).
 *
 * Cible :
 *   - nuts-dried (12 entrées : noix/graines/fruits secs courants)
 *   - ice-cream (10 entrées — sous-cat à 0 %)
 *   - bread (8 entrées : crackers, biscottes, viennoiseries fraîches)
 *   - sauces (5 entrées : condiments restants courants)
 *   - vegetables (8 entrées : panais, choux restants, daikon, courges)
 *
 * Sources : référence grande surface FR 2025-2026.
 */

export const PRICING_BATCH_5 = {
  // ─── NUTS-DRIED (12 entrées) ──────────────────────────────────────────
  'gp-noisettes': {
    fr: [{ size: 125, unit: 'g', price: 2.80 }, { size: 250, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 4.00 }],
    es: [{ size: 200, unit: 'g', price: 3.50 }],
    de: [{ size: 200, unit: 'g', price: 4.20 }],
    ja: [{ size: 125, unit: 'g', price: 580 }],
  },
  'gp-pistaches': {
    fr: [{ size: 100, unit: 'g', price: 3.50 }, { size: 200, unit: 'g', price: 6.50 }],
    en: [{ size: 200, unit: 'g', price: 6.00 }],
    es: [{ size: 200, unit: 'g', price: 5.20 }],
    de: [{ size: 200, unit: 'g', price: 6.20 }],
    ja: [{ size: 100, unit: 'g', price: 780 }],
  },
  'gp-noix-cajou': {
    fr: [{ size: 150, unit: 'g', price: 2.80 }, { size: 300, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 3.50 }],
    es: [{ size: 200, unit: 'g', price: 3.00 }],
    de: [{ size: 200, unit: 'g', price: 3.50 }],
    ja: [{ size: 150, unit: 'g', price: 580 }],
  },
  'gp-pignons': {
    fr: [{ size: 50, unit: 'g', price: 3.50 }, { size: 100, unit: 'g', price: 6.50 }],
    en: [{ size: 100, unit: 'g', price: 6.00 }],
    es: [{ size: 100, unit: 'g', price: 5.50 }],
    de: [{ size: 100, unit: 'g', price: 6.50 }],
    ja: [{ size: 50, unit: 'g', price: 780 }],
  },
  'gp-cacahuetes': {
    fr: [{ size: 200, unit: 'g', price: 1.80 }, { size: 500, unit: 'g', price: 4.20 }],
    en: [{ size: 200, unit: 'g', price: 1.70 }],
    es: [{ size: 200, unit: 'g', price: 1.50 }],
    de: [{ size: 200, unit: 'g', price: 1.80 }],
    ja: [{ size: 200, unit: 'g', price: 380 }],
  },
  'gp-raisins-secs': {
    fr: [{ size: 250, unit: 'g', price: 1.80 }, { size: 500, unit: 'g', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
    es: [{ size: 250, unit: 'g', price: 1.50 }],
    de: [{ size: 250, unit: 'g', price: 1.80 }],
    ja: [{ size: 250, unit: 'g', price: 380 }],
  },
  'gp-dattes': {
    fr: [{ size: 250, unit: 'g', price: 2.80 }, { size: 500, unit: 'g', price: 5.20 }],
    en: [{ size: 250, unit: 'g', price: 2.60 }],
    es: [{ size: 250, unit: 'g', price: 2.20 }],
    de: [{ size: 250, unit: 'g', price: 2.80 }],
    ja: [{ size: 250, unit: 'g', price: 580 }],
  },
  'gp-figues-seches': {
    fr: [{ size: 250, unit: 'g', price: 3.20 }, { size: 500, unit: 'g', price: 5.80 }],
    en: [{ size: 250, unit: 'g', price: 3.00 }],
    es: [{ size: 250, unit: 'g', price: 2.50 }],
    de: [{ size: 250, unit: 'g', price: 3.20 }],
    ja: [{ size: 250, unit: 'g', price: 680 }],
  },
  'gp-poudre-amande': {
    // Sachet pâtisserie 125g standard
    fr: [{ size: 125, unit: 'g', price: 2.80 }, { size: 250, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 4.50 }],
    es: [{ size: 125, unit: 'g', price: 2.50 }],
    de: [{ size: 125, unit: 'g', price: 2.80 }],
    ja: [{ size: 100, unit: 'g', price: 480 }],
  },
  'gp-chia': {
    fr: [{ size: 200, unit: 'g', price: 3.20 }, { size: 500, unit: 'g', price: 6.80 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
    es: [{ size: 200, unit: 'g', price: 2.50 }],
    de: [{ size: 200, unit: 'g', price: 3.20 }],
    ja: [{ size: 200, unit: 'g', price: 580 }],
  },
  'gp-lin': {
    fr: [{ size: 250, unit: 'g', price: 1.80 }, { size: 500, unit: 'g', price: 3.20 }],
    en: [{ size: 250, unit: 'g', price: 1.70 }],
    es: [{ size: 250, unit: 'g', price: 1.40 }],
    de: [{ size: 250, unit: 'g', price: 1.80 }],
    ja: [{ size: 250, unit: 'g', price: 380 }],
  },
  'gp-graines-tournesol': {
    fr: [{ size: 250, unit: 'g', price: 1.50 }, { size: 500, unit: 'g', price: 2.80 }],
    en: [{ size: 250, unit: 'g', price: 1.40 }],
    es: [{ size: 250, unit: 'g', price: 1.20 }],
    de: [{ size: 250, unit: 'g', price: 1.50 }],
    ja: [{ size: 250, unit: 'g', price: 320 }],
  },

  // ─── ICE-CREAM (10 entrées — sous-cat à 0 %) ──────────────────────────
  'frz-sorbet-fraise': {
    fr: [{ size: 50, unit: 'cl', price: 3.80 }, { size: 100, unit: 'cl', price: 6.20 }],
    en: [{ size: 50, unit: 'cl', price: 3.50 }],
    es: [{ size: 50, unit: 'cl', price: 3.00 }],
    de: [{ size: 50, unit: 'cl', price: 3.50 }],
    ja: [{ size: 50, unit: 'cl', price: 680 }],
  },
  'frz-sorbet-framb': {
    fr: [{ size: 50, unit: 'cl', price: 3.80 }, { size: 100, unit: 'cl', price: 6.20 }],
    en: [{ size: 50, unit: 'cl', price: 3.50 }],
    es: [{ size: 50, unit: 'cl', price: 3.00 }],
    de: [{ size: 50, unit: 'cl', price: 3.50 }],
    ja: [{ size: 50, unit: 'cl', price: 680 }],
  },
  'frz-sorbet-mangue': {
    fr: [{ size: 50, unit: 'cl', price: 3.80 }, { size: 100, unit: 'cl', price: 6.20 }],
    en: [{ size: 50, unit: 'cl', price: 3.50 }],
    es: [{ size: 50, unit: 'cl', price: 3.00 }],
    de: [{ size: 50, unit: 'cl', price: 3.50 }],
    ja: [{ size: 50, unit: 'cl', price: 680 }],
  },
  'frz-magnum': {
    // Multipack 6 ou 4 bâtons
    fr: [{ size: 4, unit: 'pcs', price: 4.50 }, { size: 6, unit: 'pcs', price: 6.50 }],
    en: [{ size: 4, unit: 'pcs', price: 4.20 }],
    es: [{ size: 4, unit: 'pcs', price: 3.80 }],
    de: [{ size: 4, unit: 'pcs', price: 4.50 }],
    ja: [{ size: 4, unit: 'pcs', price: 880 }],
  },
  'frz-cornet': {
    fr: [{ size: 6, unit: 'pcs', price: 4.20 }, { size: 8, unit: 'pcs', price: 5.50 }],
    en: [{ size: 6, unit: 'pcs', price: 4.00 }],
    es: [{ size: 6, unit: 'pcs', price: 3.50 }],
    de: [{ size: 6, unit: 'pcs', price: 4.20 }],
    ja: [{ size: 6, unit: 'pcs', price: 780 }],
  },
  'frz-bac-vanille': {
    fr: [{ size: 50, unit: 'cl', price: 3.50 }, { size: 100, unit: 'cl', price: 5.80 }],
    en: [{ size: 50, unit: 'cl', price: 3.30 }],
    es: [{ size: 50, unit: 'cl', price: 2.80 }],
    de: [{ size: 50, unit: 'cl', price: 3.50 }],
    ja: [{ size: 50, unit: 'cl', price: 580 }],
  },
  'frz-choco-glace': {
    fr: [{ size: 50, unit: 'cl', price: 3.80 }, { size: 100, unit: 'cl', price: 6.20 }],
    en: [{ size: 50, unit: 'cl', price: 3.50 }],
    es: [{ size: 50, unit: 'cl', price: 3.00 }],
    de: [{ size: 50, unit: 'cl', price: 3.50 }],
    ja: [{ size: 50, unit: 'cl', price: 680 }],
  },
  'frz-pistache': {
    fr: [{ size: 50, unit: 'cl', price: 4.50 }, { size: 100, unit: 'cl', price: 7.80 }],
    en: [{ size: 50, unit: 'cl', price: 4.20 }],
    es: [{ size: 50, unit: 'cl', price: 3.80 }],
    de: [{ size: 50, unit: 'cl', price: 4.50 }],
    ja: [{ size: 50, unit: 'cl', price: 880 }],
  },
  'frz-glace-fraise': {
    fr: [{ size: 50, unit: 'cl', price: 3.80 }, { size: 100, unit: 'cl', price: 6.20 }],
    en: [{ size: 50, unit: 'cl', price: 3.50 }],
    es: [{ size: 50, unit: 'cl', price: 3.00 }],
    de: [{ size: 50, unit: 'cl', price: 3.50 }],
    ja: [{ size: 50, unit: 'cl', price: 680 }],
  },
  'frz-buche-glacee': {
    fr: [{ size: 1, unit: 'pcs', price: 9.80 }, { size: 1500, unit: 'g', price: 12.50 }],
    en: [{ size: 1, unit: 'pcs', price: 9.50 }],
    es: [{ size: 1, unit: 'pcs', price: 8.50 }],
    de: [{ size: 1, unit: 'pcs', price: 9.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 1880 }],
  },

  // ─── BREAD (8 entrées — crackers + viennoiseries fraîches) ────────────
  'gp-crackers': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
    es: [{ size: 200, unit: 'g', price: 2.50 }],
    de: [{ size: 200, unit: 'g', price: 3.00 }],
    ja: [{ size: 100, unit: 'g', price: 380 }],
  },
  'gp-biscottes': {
    // Paquet 36 biscottes ~300g
    fr: [{ size: 300, unit: 'g', price: 1.50 }, { size: 600, unit: 'g', price: 2.80 }],
    en: [{ size: 300, unit: 'g', price: 1.50 }],
    es: [{ size: 300, unit: 'g', price: 1.20 }],
    de: [{ size: 300, unit: 'g', price: 1.50 }],
    ja: [{ size: 300, unit: 'g', price: 380 }],
  },
  'gp-grissini': {
    fr: [{ size: 125, unit: 'g', price: 1.80 }, { size: 250, unit: 'g', price: 3.20 }],
    en: [{ size: 125, unit: 'g', price: 1.70 }],
    es: [{ size: 125, unit: 'g', price: 1.50 }],
    de: [{ size: 125, unit: 'g', price: 1.80 }],
    ja: [{ size: 125, unit: 'g', price: 380 }],
  },
  'gp-galettes-riz': {
    fr: [{ size: 130, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 2.50 }],
    en: [{ size: 130, unit: 'g', price: 1.70 }],
    es: [{ size: 130, unit: 'g', price: 1.50 }],
    de: [{ size: 130, unit: 'g', price: 1.80 }],
    ja: [{ size: 130, unit: 'g', price: 380 }],
  },
  'gp-chapelure': {
    fr: [{ size: 250, unit: 'g', price: 1.20 }, { size: 500, unit: 'g', price: 2.20 }],
    en: [{ size: 250, unit: 'g', price: 1.20 }],
    es: [{ size: 250, unit: 'g', price: 1.00 }],
    de: [{ size: 250, unit: 'g', price: 1.20 }],
    ja: [{ size: 250, unit: 'g', price: 280 }],
  },
  'gp-tortillas': {
    // Pack 8 tortillas standard
    fr: [{ size: 8, unit: 'pcs', price: 2.80 }, { size: 12, unit: 'pcs', price: 3.80 }],
    en: [{ size: 8, unit: 'pcs', price: 2.50 }],
    es: [{ size: 8, unit: 'pcs', price: 2.00 }],
    de: [{ size: 8, unit: 'pcs', price: 2.80 }],
    ja: [{ size: 8, unit: 'pcs', price: 580 }],
  },
  'gp-croissant-frais': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }, { size: 4, unit: 'pcs', price: 4.20 }, { size: 6, unit: 'pcs', price: 5.80 }],
    en: [{ size: 1, unit: 'pcs', price: 1.30 }],
    es: [{ size: 1, unit: 'pcs', price: 1.00 }],
    de: [{ size: 1, unit: 'pcs', price: 1.20 }],
    ja: [{ size: 1, unit: 'pcs', price: 220 }],
  },
  'gp-pain-choc-frais': {
    fr: [{ size: 1, unit: 'pcs', price: 1.30 }, { size: 4, unit: 'pcs', price: 4.50 }, { size: 6, unit: 'pcs', price: 6.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.40 }],
    es: [{ size: 1, unit: 'pcs', price: 1.10 }],
    de: [{ size: 1, unit: 'pcs', price: 1.30 }],
    ja: [{ size: 1, unit: 'pcs', price: 250 }],
  },

  // ─── SAUCES (5 entrées) ───────────────────────────────────────────────
  'sp-aioli': {
    fr: [{ size: 200, unit: 'g', price: 2.50 }, { size: 350, unit: 'g', price: 3.80 }],
    en: [{ size: 200, unit: 'g', price: 2.40 }],
    es: [{ size: 200, unit: 'g', price: 2.00 }],
    de: [{ size: 200, unit: 'g', price: 2.50 }],
    ja: [{ size: 200, unit: 'g', price: 480 }],
  },
  'sp-worcestershire': {
    fr: [{ size: 150, unit: 'ml', price: 3.20 }, { size: 290, unit: 'ml', price: 5.50 }],
    en: [{ size: 150, unit: 'ml', price: 3.00 }],
    es: [{ size: 150, unit: 'ml', price: 2.80 }],
    de: [{ size: 150, unit: 'ml', price: 3.20 }],
    ja: [{ size: 150, unit: 'ml', price: 680 }],
  },
  'sp-kimchi': {
    fr: [{ size: 250, unit: 'g', price: 4.20 }, { size: 500, unit: 'g', price: 7.50 }],
    en: [{ size: 250, unit: 'g', price: 4.00 }],
    es: [{ size: 250, unit: 'g', price: 3.50 }],
    de: [{ size: 250, unit: 'g', price: 4.20 }],
    ja: [{ size: 250, unit: 'g', price: 580 }],
  },
  'sp-bechamel': {
    fr: [{ size: 50, unit: 'cl', price: 1.80 }, { size: 100, unit: 'cl', price: 3.20 }],
    en: [{ size: 50, unit: 'cl', price: 1.70 }],
    es: [{ size: 50, unit: 'cl', price: 1.50 }],
    de: [{ size: 50, unit: 'cl', price: 1.80 }],
    ja: [{ size: 50, unit: 'cl', price: 380 }],
  },
  'sp-sambal-oelek': {
    fr: [{ size: 100, unit: 'g', price: 2.50 }, { size: 200, unit: 'g', price: 4.20 }],
    en: [{ size: 100, unit: 'g', price: 2.40 }],
    es: [{ size: 100, unit: 'g', price: 2.20 }],
    de: [{ size: 100, unit: 'g', price: 2.50 }],
    ja: [{ size: 100, unit: 'g', price: 480 }],
  },

  // ─── VEGETABLES (8 entrées) ───────────────────────────────────────────
  'vg-panais': {
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1, unit: 'kg', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 2.20 }],
    es: [{ size: 500, unit: 'g', price: 2.00 }],
    de: [{ size: 500, unit: 'g', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'vg-rutabaga': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 1, unit: 'kg', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.60 }],
    es: [{ size: 1, unit: 'pcs', price: 1.40 }],
    de: [{ size: 1, unit: 'pcs', price: 1.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 380 }],
  },
  'vg-topinambour': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size: 500, unit: 'g', price: 2.00 }],
    es: [{ size: 500, unit: 'g', price: 1.80 }],
    de: [{ size: 500, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'vg-chou-romanesco': {
    fr: [{ size: 1, unit: 'pcs', price: 2.80 }, { size: 1, unit: 'kg', price: 3.50 }],
    en: [{ size: 1, unit: 'pcs', price: 2.50 }],
    es: [{ size: 1, unit: 'pcs', price: 2.20 }],
    de: [{ size: 1, unit: 'pcs', price: 2.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 580 }],
  },
  'vg-chou-rave': {
    fr: [{ size: 1, unit: 'pcs', price: 1.50 }, { size: 500, unit: 'g', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.40 }],
    es: [{ size: 1, unit: 'pcs', price: 1.20 }],
    de: [{ size: 1, unit: 'pcs', price: 1.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 320 }],
  },
  'vg-daikon': {
    fr: [{ size: 1, unit: 'pcs', price: 2.80 }, { size: 500, unit: 'g', price: 2.50 }],
    en: [{ size: 1, unit: 'pcs', price: 2.50 }],
    es: [{ size: 1, unit: 'pcs', price: 2.20 }],
    de: [{ size: 1, unit: 'pcs', price: 2.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 280 }],
  },
  'vg-salade': {
    // Parent générique = laitue
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.10 }],
    es: [{ size: 1, unit: 'pcs', price: 1.00 }],
    de: [{ size: 1, unit: 'pcs', price: 1.20 }],
    ja: [{ size: 1, unit: 'pcs', price: 200 }],
  },
  'vg-tofu': {
    // Tofu nature, brick 200g standard
    fr: [{ size: 200, unit: 'g', price: 2.20 }, { size: 400, unit: 'g', price: 4.00 }],
    en: [{ size: 200, unit: 'g', price: 2.00 }],
    es: [{ size: 200, unit: 'g', price: 1.80 }],
    de: [{ size: 200, unit: 'g', price: 2.20 }],
    ja: [{ size: 300, unit: 'g', price: 180 }],
  },
}
