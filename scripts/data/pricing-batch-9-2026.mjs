/**
 * Lot 9 — enrichissement pricing pour v3.40.0 (Phase E.10).
 *
 * Cible les variantes courantes restantes :
 *   - cheese (7 entrées : fromages français connus)
 *   - eggs (6 entrées : variantes œufs courantes)
 *   - meat (6 entrées : parents génériques bœuf/porc/veau/etc.)
 *   - sauces (5 entrées : condiments restants)
 *
 * Sources : référence grande surface FR 2025-2026.
 *
 * Note : les sous-catégories "parents" comme `vg-alliums`, `vg-racines` sont
 * volontairement laissées en fallback subcat — ce sont des regroupements
 * abstraits, pas des produits achetables individuellement.
 */

export const PRICING_BATCH_9 = {
  // ─── CHEESE (7 entrées — fromages français classiques) ────────────────
  'fr-fromage': {
    // Parent générique = pâte pressée type emmental, vendu pré-tranché
    fr: [{ size: 200, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 2.60 }],
    es: [{ size: 200, unit: 'g', price: 2.40 }],
    de: [{ size: 200, unit: 'g', price: 2.70 }],
    ja: [{ size: 200, unit: 'g', price: 480 }],
  },
  'fr-brie': {
    fr: [{ size: 200, unit: 'g', price: 3.80 }, { size: 1, unit: 'kg', price: 16.00 }],
    en: [{ size: 200, unit: 'g', price: 3.60 }],
    es: [{ size: 200, unit: 'g', price: 3.20 }],
    de: [{ size: 200, unit: 'g', price: 3.80 }],
    ja: [{ size: 200, unit: 'g', price: 880 }],
  },
  'fr-camembert': {
    // Boîte ronde 250g standard
    fr: [{ size: 250, unit: 'g', price: 2.80 }, { size: 1, unit: 'pcs', price: 2.80 }],
    en: [{ size: 250, unit: 'g', price: 2.80 }],
    es: [{ size: 250, unit: 'g', price: 2.50 }],
    de: [{ size: 250, unit: 'g', price: 2.80 }],
    ja: [{ size: 250, unit: 'g', price: 680 }],
  },
  'fr-fourme': {
    // Fourme d'Ambert — bleu doux
    fr: [{ size: 150, unit: 'g', price: 3.50 }, { size: 250, unit: 'g', price: 5.50 }],
    en: [{ size: 150, unit: 'g', price: 3.30 }],
    es: [{ size: 150, unit: 'g', price: 3.00 }],
    de: [{ size: 150, unit: 'g', price: 3.50 }],
    ja: [{ size: 150, unit: 'g', price: 880 }],
  },
  'fr-mimolette': {
    fr: [{ size: 200, unit: 'g', price: 4.20 }, { size: 400, unit: 'g', price: 7.80 }],
    en: [{ size: 200, unit: 'g', price: 4.00 }],
    es: [{ size: 200, unit: 'g', price: 3.50 }],
    de: [{ size: 200, unit: 'g', price: 4.20 }],
    ja: [{ size: 200, unit: 'g', price: 1080 }],
  },
  'fr-raclette': {
    // Pré-tranché barquette 400g standard
    fr: [{ size: 400, unit: 'g', price: 5.80 }, { size: 800, unit: 'g', price: 10.50 }],
    en: [{ size: 400, unit: 'g', price: 5.50 }],
    es: [{ size: 400, unit: 'g', price: 4.80 }],
    de: [{ size: 400, unit: 'g', price: 5.80 }],
    ja: [{ size: 400, unit: 'g', price: 1280 }],
  },
  'fr-reblochon': {
    // Roue 450g standard
    fr: [{ size: 450, unit: 'g', price: 5.50 }, { size: 1, unit: 'pcs', price: 5.50 }],
    en: [{ size: 450, unit: 'g', price: 5.50 }],
    es: [{ size: 450, unit: 'g', price: 4.80 }],
    de: [{ size: 450, unit: 'g', price: 5.50 }],
    ja: [{ size: 450, unit: 'g', price: 1380 }],
  },

  // ─── EGGS (6 entrées — variantes œufs) ────────────────────────────────
  'fr-oeuf': {
    // Parent générique = standard
    fr: [{ size: 6, unit: 'pcs', price: 1.80 }, { size: 10, unit: 'pcs', price: 2.80 }, { size: 12, unit: 'pcs', price: 3.20 }],
    en: [{ size: 6, unit: 'pcs', price: 1.50 }, { size: 12, unit: 'pcs', price: 2.70 }],
    es: [{ size: 6, unit: 'pcs', price: 1.40 }, { size: 12, unit: 'pcs', price: 2.50 }],
    de: [{ size: 10, unit: 'pcs', price: 2.40 }],
    ja: [{ size: 10, unit: 'pcs', price: 280 }],
  },
  'fr-oeufs-bio': {
    fr: [{ size: 6, unit: 'pcs', price: 3.20 }, { size: 10, unit: 'pcs', price: 4.80 }],
    en: [{ size: 6, unit: 'pcs', price: 3.00 }],
    es: [{ size: 6, unit: 'pcs', price: 2.80 }],
    de: [{ size: 10, unit: 'pcs', price: 3.80 }],
    ja: [{ size: 10, unit: 'pcs', price: 480 }],
  },
  'fr-oeufs-caille': {
    // Boîte 12 ou 18
    fr: [{ size: 12, unit: 'pcs', price: 3.20 }, { size: 18, unit: 'pcs', price: 4.50 }],
    en: [{ size: 12, unit: 'pcs', price: 3.00 }],
    es: [{ size: 12, unit: 'pcs', price: 2.50 }],
    de: [{ size: 12, unit: 'pcs', price: 3.20 }],
    ja: [{ size: 12, unit: 'pcs', price: 320 }],
  },
  'fr-oeufs-canard': {
    fr: [{ size: 6, unit: 'pcs', price: 4.50 }, { size: 12, unit: 'pcs', price: 8.50 }],
    en: [{ size: 6, unit: 'pcs', price: 4.20 }],
    es: [{ size: 6, unit: 'pcs', price: 3.80 }],
    de: [{ size: 6, unit: 'pcs', price: 4.50 }],
    ja: [{ size: 6, unit: 'pcs', price: 880 }],
  },
  'fr-oeufs-fermier': {
    fr: [{ size: 6, unit: 'pcs', price: 2.80 }, { size: 10, unit: 'pcs', price: 4.20 }],
    en: [{ size: 6, unit: 'pcs', price: 2.60 }],
    es: [{ size: 6, unit: 'pcs', price: 2.40 }],
    de: [{ size: 10, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 10, unit: 'pcs', price: 380 }],
  },
  'fr-oeufs-label-r': {
    fr: [{ size: 6, unit: 'pcs', price: 2.50 }, { size: 12, unit: 'pcs', price: 4.50 }],
    en: [{ size: 6, unit: 'pcs', price: 2.40 }],
    es: [{ size: 6, unit: 'pcs', price: 2.20 }],
    de: [{ size: 6, unit: 'pcs', price: 2.50 }],
    ja: [{ size: 6, unit: 'pcs', price: 380 }],
  },

  // ─── MEAT (6 entrées — parents génériques) ────────────────────────────
  'fr-porc': {
    // Parent générique = échine ou côte standard
    fr: [{ size: 500, unit: 'g', price: 5.50 }, { size: 1, unit: 'kg', price: 9.80 }],
    en: [{ size: 1, unit: 'kg', price: 9.00 }],
    es: [{ size: 1, unit: 'kg', price: 7.50 }],
    de: [{ size: 1, unit: 'kg', price: 8.80 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'fr-veau': {
    fr: [{ size: 500, unit: 'g', price: 13.50 }, { size: 1, unit: 'kg', price: 24.00 }],
    en: [{ size: 1, unit: 'kg', price: 22.00 }],
    es: [{ size: 1, unit: 'kg', price: 18.00 }],
    de: [{ size: 1, unit: 'kg', price: 23.00 }],
    ja: [{ size: 500, unit: 'g', price: 1980 }],
  },
  'fr-canard': {
    // Magret par défaut ~350g
    fr: [{ size: 350, unit: 'g', price: 9.80 }, { size: 1, unit: 'kg', price: 18.00 }],
    en: [{ size: 350, unit: 'g', price: 9.50 }],
    es: [{ size: 350, unit: 'g', price: 8.20 }],
    de: [{ size: 350, unit: 'g', price: 9.80 }],
    ja: [{ size: 350, unit: 'g', price: 1480 }],
  },
  'fr-agneau': {
    fr: [{ size: 500, unit: 'g', price: 11.50 }, { size: 1, unit: 'kg', price: 18.00 }],
    en: [{ size: 1, unit: 'kg', price: 16.00 }],
    es: [{ size: 1, unit: 'kg', price: 13.50 }],
    de: [{ size: 1, unit: 'kg', price: 17.00 }],
    ja: [{ size: 500, unit: 'g', price: 1380 }],
  },
  'fr-foie': {
    // Foie de volaille par défaut
    fr: [{ size: 250, unit: 'g', price: 2.20 }, { size: 500, unit: 'g', price: 4.00 }],
    en: [{ size: 500, unit: 'g', price: 3.50 }],
    es: [{ size: 500, unit: 'g', price: 3.00 }],
    de: [{ size: 500, unit: 'g', price: 3.50 }],
    ja: [{ size: 250, unit: 'g', price: 380 }],
  },
  'fr-foie-veau': {
    fr: [{ size: 250, unit: 'g', price: 6.50 }, { size: 500, unit: 'g', price: 12.00 }],
    en: [{ size: 500, unit: 'g', price: 11.00 }],
    es: [{ size: 500, unit: 'g', price: 9.50 }],
    de: [{ size: 500, unit: 'g', price: 11.00 }],
    ja: [{ size: 250, unit: 'g', price: 1080 }],
  },

  // ─── SAUCES (5 entrées — condiments fermentés et bases restantes) ─────
  'sp-sauce-cocktail': {
    fr: [{ size: 240, unit: 'ml', price: 2.20 }, { size: 400, unit: 'ml', price: 3.50 }],
    en: [{ size: 240, unit: 'ml', price: 2.00 }],
    es: [{ size: 240, unit: 'ml', price: 1.80 }],
    de: [{ size: 240, unit: 'ml', price: 2.20 }],
    ja: [{ size: 240, unit: 'ml', price: 480 }],
  },
  'sp-choucroute': {
    fr: [{ size: 500, unit: 'g', price: 2.80 }, { size: 1, unit: 'kg', price: 4.80 }],
    en: [{ size: 500, unit: 'g', price: 2.60 }],
    es: [{ size: 500, unit: 'g', price: 2.20 }],
    de: [{ size: 500, unit: 'g', price: 2.80 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'sp-miso': {
    // Différent de jp-miso (rayon mondial vs rayon japonais), pots plus petits
    fr: [{ size: 250, unit: 'g', price: 4.50 }, { size: 400, unit: 'g', price: 6.80 }],
    en: [{ size: 250, unit: 'g', price: 4.20 }],
    es: [{ size: 250, unit: 'g', price: 3.80 }],
    de: [{ size: 250, unit: 'g', price: 4.50 }],
    ja: [{ size: 400, unit: 'g', price: 480 }],
  },
}
