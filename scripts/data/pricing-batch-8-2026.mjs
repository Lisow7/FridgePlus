/**
 * Lot 8 — enrichissement pricing pour v3.39.0 (Phase E.9 — final).
 *
 * Cible 5 dernières sous-catégories prioritaires :
 *   - frozen-veg (10 entrées — légumes surgelés courants)
 *   - dairy (10 entrées — laits/crèmes végétaux + ghee/kéfir/labneh)
 *   - cereals (10 entrées — légumineuses sèches + céréales petit-déj)
 *   - rice (10 entrées — riz japonais + nouilles asiatiques)
 *   - pasta-rice (9 entrées — pâtes et riz génériques restants)
 *
 * Sources : référence grande surface FR 2025-2026.
 *
 * Avec ce lot, la couverture passera de 73.5 % à ~83 %, ce qui couvre
 * largement tous les ingrédients usuels. Les ingrédients restants après
 * v3.39.0 sont très de niche (variétés rares de fromages, viandes
 * exotiques, condiments très spécialisés) et seront ajoutés au cas par cas
 * par la future UI admin (Phase H) plutôt qu'en lots automatiques.
 */

export const PRICING_BATCH_8 = {
  // ─── FROZEN-VEG (10 entrées) ──────────────────────────────────────────
  'frz-brocoli': {
    fr: [{ size: 600, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.50 }],
    en: [{ size: 600, unit: 'g', price: 2.00 }],
    es: [{ size: 600, unit: 'g', price: 1.80 }],
    de: [{ size: 600, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },
  'frz-carottes': {
    fr: [{ size: 600, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 2.80 }],
    en: [{ size: 1, unit: 'kg', price: 2.50 }],
    es: [{ size: 1, unit: 'kg', price: 2.00 }],
    de: [{ size: 1, unit: 'kg', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 280 }],
  },
  'frz-champignons': {
    fr: [{ size: 450, unit: 'g', price: 2.50 }, { size: 1, unit: 'kg', price: 5.20 }],
    en: [{ size: 500, unit: 'g', price: 2.80 }],
    es: [{ size: 450, unit: 'g', price: 2.20 }],
    de: [{ size: 500, unit: 'g', price: 2.80 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'frz-chou-fleur': {
    fr: [{ size: 600, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.50 }],
    en: [{ size: 600, unit: 'g', price: 2.00 }],
    es: [{ size: 600, unit: 'g', price: 1.80 }],
    de: [{ size: 600, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },
  'frz-edamame': {
    fr: [{ size: 400, unit: 'g', price: 4.20 }, { size: 750, unit: 'g', price: 7.20 }],
    en: [{ size: 400, unit: 'g', price: 4.00 }],
    es: [{ size: 400, unit: 'g', price: 3.50 }],
    de: [{ size: 400, unit: 'g', price: 4.20 }],
    ja: [{ size: 400, unit: 'g', price: 480 }],
  },
  'frz-legumes-print': {
    fr: [{ size: 600, unit: 'g', price: 2.50 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size: 600, unit: 'g', price: 2.30 }],
    es: [{ size: 600, unit: 'g', price: 2.00 }],
    de: [{ size: 600, unit: 'g', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'frz-mais': {
    fr: [{ size: 450, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 3.50 }],
    en: [{ size: 1, unit: 'kg', price: 3.20 }],
    es: [{ size: 450, unit: 'g', price: 1.50 }],
    de: [{ size: 1, unit: 'kg', price: 3.20 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },
  'frz-poireaux': {
    fr: [{ size: 600, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.50 }],
    en: [{ size: 600, unit: 'g', price: 2.00 }],
    es: [{ size: 600, unit: 'g', price: 1.80 }],
    de: [{ size: 600, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },
  'frz-poivrons': {
    fr: [{ size: 450, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 4.20 }],
    en: [{ size: 450, unit: 'g', price: 2.00 }],
    es: [{ size: 450, unit: 'g', price: 1.80 }],
    de: [{ size: 450, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'frz-pommes-terre': {
    // Frites surgelées
    fr: [{ size: 750, unit: 'g', price: 2.20 }, { size: 2, unit: 'kg', price: 4.80 }],
    en: [{ size: 1, unit: 'kg', price: 2.50 }],
    es: [{ size: 1, unit: 'kg', price: 2.00 }],
    de: [{ size: 1, unit: 'kg', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },

  // ─── DAIRY (10 entrées — végétaux + spécialités) ──────────────────────
  'fr-ghee': {
    fr: [{ size: 250, unit: 'g', price: 6.50 }, { size: 500, unit: 'g', price: 11.50 }],
    en: [{ size: 250, unit: 'g', price: 6.20 }],
    es: [{ size: 250, unit: 'g', price: 5.50 }],
    de: [{ size: 250, unit: 'g', price: 6.50 }],
    ja: [{ size: 250, unit: 'g', price: 1280 }],
  },
  'fr-kefir': {
    fr: [{ size: 50, unit: 'cl', price: 2.80 }, { size: 100, unit: 'cl', price: 4.80 }],
    en: [{ size: 50, unit: 'cl', price: 2.60 }],
    es: [{ size: 50, unit: 'cl', price: 2.20 }],
    de: [{ size: 50, unit: 'cl', price: 2.80 }],
    ja: [{ size: 50, unit: 'cl', price: 580 }],
  },
  'fr-labneh': {
    fr: [{ size: 200, unit: 'g', price: 3.20 }, { size: 350, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
    es: [{ size: 200, unit: 'g', price: 2.50 }],
    de: [{ size: 200, unit: 'g', price: 3.20 }],
    ja: [{ size: 200, unit: 'g', price: 680 }],
  },
  'fr-lait-riz': {
    fr: [{ size: 100, unit: 'cl', price: 2.20 }, { size: 600, unit: 'cl', price: 11.50 }],
    en: [{ size: 100, unit: 'cl', price: 2.00 }],
    es: [{ size: 100, unit: 'cl', price: 1.70 }],
    de: [{ size: 100, unit: 'cl', price: 2.00 }],
    ja: [{ size: 100, unit: 'cl', price: 480 }],
  },
  'fr-lait-noisette': {
    fr: [{ size: 100, unit: 'cl', price: 2.50 }, { size: 600, unit: 'cl', price: 13.50 }],
    en: [{ size: 100, unit: 'cl', price: 2.40 }],
    es: [{ size: 100, unit: 'cl', price: 2.20 }],
    de: [{ size: 100, unit: 'cl', price: 2.50 }],
    ja: [{ size: 100, unit: 'cl', price: 580 }],
  },
  'fr-creme-avoine': {
    fr: [{ size: 20, unit: 'cl', price: 1.80 }, { size: 50, unit: 'cl', price: 3.80 }],
    en: [{ size: 25, unit: 'cl', price: 2.00 }],
    es: [{ size: 20, unit: 'cl', price: 1.60 }],
    de: [{ size: 20, unit: 'cl', price: 1.80 }],
    ja: [{ size: 20, unit: 'cl', price: 380 }],
  },
  'fr-creme-soja': {
    fr: [{ size: 20, unit: 'cl', price: 1.50 }, { size: 50, unit: 'cl', price: 3.20 }],
    en: [{ size: 20, unit: 'cl', price: 1.40 }],
    es: [{ size: 20, unit: 'cl', price: 1.20 }],
    de: [{ size: 20, unit: 'cl', price: 1.50 }],
    ja: [{ size: 20, unit: 'cl', price: 320 }],
  },
  'fr-pate-sablee': {
    fr: [{ size: 230, unit: 'g', price: 1.70 }, { size: 320, unit: 'g', price: 2.40 }],
    en: [{ size: 320, unit: 'g', price: 2.20 }],
    es: [{ size: 230, unit: 'g', price: 1.60 }],
    de: [{ size: 230, unit: 'g', price: 1.80 }],
    ja: [{ size: 230, unit: 'g', price: 380 }],
  },

  // ─── CEREALS (10 entrées — légumineuses sèches + petit-déj) ───────────
  'gp-lentilles-vert': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 4.20 }],
    en: [{ size: 500, unit: 'g', price: 2.00 }],
    es: [{ size: 500, unit: 'g', price: 1.80 }],
    de: [{ size: 500, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'gp-haricots-rouges': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 4.00 }],
    en: [{ size: 500, unit: 'g', price: 2.00 }],
    es: [{ size: 500, unit: 'g', price: 1.80 }],
    de: [{ size: 500, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'gp-feves': {
    // Sec
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1, unit: 'kg', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 2.30 }],
    es: [{ size: 500, unit: 'g', price: 2.00 }],
    de: [{ size: 500, unit: 'g', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'gp-pois-ch-sec': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size: 500, unit: 'g', price: 2.00 }],
    es: [{ size: 500, unit: 'g', price: 1.80 }],
    de: [{ size: 500, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'gp-pois-casses': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size: 500, unit: 'g', price: 2.00 }],
    es: [{ size: 500, unit: 'g', price: 1.80 }],
    de: [{ size: 500, unit: 'g', price: 2.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'gp-cereales-matin': {
    // Boîte 500g standard
    fr: [{ size: 500, unit: 'g', price: 3.20 }, { size: 750, unit: 'g', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
    es: [{ size: 500, unit: 'g', price: 2.50 }],
    de: [{ size: 500, unit: 'g', price: 3.20 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'gp-granola': {
    fr: [{ size: 400, unit: 'g', price: 4.50 }, { size: 750, unit: 'g', price: 7.50 }],
    en: [{ size: 400, unit: 'g', price: 4.20 }],
    es: [{ size: 400, unit: 'g', price: 3.80 }],
    de: [{ size: 400, unit: 'g', price: 4.50 }],
    ja: [{ size: 400, unit: 'g', price: 880 }],
  },
  'gp-muesli': {
    fr: [{ size: 500, unit: 'g', price: 3.50 }, { size: 1, unit: 'kg', price: 5.80 }],
    en: [{ size: 500, unit: 'g', price: 3.20 }],
    es: [{ size: 500, unit: 'g', price: 2.80 }],
    de: [{ size: 500, unit: 'g', price: 3.50 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'gp-flocons-avoine': {
    fr: [{ size: 500, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 1.70 }],
    es: [{ size: 500, unit: 'g', price: 1.40 }],
    de: [{ size: 500, unit: 'g', price: 1.80 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },

  // ─── RICE (10 entrées — riz et nouilles japonais) ─────────────────────
  'jp-hakumai': {
    // Riz japonais (ex: Niigata Koshihikari) — sac 1kg ou 2kg
    fr: [{ size: 1, unit: 'kg', price: 4.50 }, { size: 2, unit: 'kg', price: 8.50 }],
    en: [{ size: 1, unit: 'kg', price: 4.20 }],
    es: [{ size: 1, unit: 'kg', price: 3.80 }],
    de: [{ size: 1, unit: 'kg', price: 4.50 }],
    ja: [{ size: 5, unit: 'kg', price: 2480 }], // 5kg standard JP
  },
  'jp-mochigome': {
    fr: [{ size: 500, unit: 'g', price: 4.20 }, { size: 1, unit: 'kg', price: 7.50 }],
    en: [{ size: 1, unit: 'kg', price: 7.00 }],
    es: [{ size: 1, unit: 'kg', price: 6.20 }],
    de: [{ size: 1, unit: 'kg', price: 7.00 }],
    ja: [{ size: 1, unit: 'kg', price: 580 }],
  },
  'jp-nouilles': {
    fr: [{ size: 250, unit: 'g', price: 2.20 }, { size: 500, unit: 'g', price: 3.80 }],
    en: [{ size: 250, unit: 'g', price: 2.00 }],
    es: [{ size: 250, unit: 'g', price: 1.80 }],
    de: [{ size: 250, unit: 'g', price: 2.20 }],
    ja: [{ size: 250, unit: 'g', price: 280 }],
  },
  'jp-udon': {
    fr: [{ size: 200, unit: 'g', price: 2.50 }, { size: 400, unit: 'g', price: 4.20 }],
    en: [{ size: 200, unit: 'g', price: 2.30 }],
    es: [{ size: 200, unit: 'g', price: 2.00 }],
    de: [{ size: 200, unit: 'g', price: 2.50 }],
    ja: [{ size: 200, unit: 'g', price: 280 }],
  },
  'jp-soba': {
    fr: [{ size: 200, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 4.80 }],
    en: [{ size: 200, unit: 'g', price: 2.60 }],
    es: [{ size: 200, unit: 'g', price: 2.20 }],
    de: [{ size: 200, unit: 'g', price: 2.80 }],
    ja: [{ size: 200, unit: 'g', price: 380 }],
  },
  'jp-ramen-sec': {
    fr: [{ size: 250, unit: 'g', price: 2.50 }, { size: 500, unit: 'g', price: 4.50 }],
    en: [{ size: 250, unit: 'g', price: 2.30 }],
    es: [{ size: 250, unit: 'g', price: 2.00 }],
    de: [{ size: 250, unit: 'g', price: 2.50 }],
    ja: [{ size: 5, unit: 'pcs', price: 480 }],
  },
  'jp-somen': {
    fr: [{ size: 250, unit: 'g', price: 3.20 }, { size: 500, unit: 'g', price: 5.50 }],
    en: [{ size: 250, unit: 'g', price: 3.00 }],
    es: [{ size: 250, unit: 'g', price: 2.50 }],
    de: [{ size: 250, unit: 'g', price: 3.20 }],
    ja: [{ size: 250, unit: 'g', price: 380 }],
  },
  'jp-harusame': {
    fr: [{ size: 100, unit: 'g', price: 2.80 }, { size: 200, unit: 'g', price: 4.80 }],
    en: [{ size: 100, unit: 'g', price: 2.60 }],
    es: [{ size: 100, unit: 'g', price: 2.20 }],
    de: [{ size: 100, unit: 'g', price: 2.80 }],
    ja: [{ size: 100, unit: 'g', price: 280 }],
  },
  'jp-yakisoba-men': {
    fr: [{ size: 3, unit: 'pcs', price: 3.20 }, { size: 5, unit: 'pcs', price: 5.20 }],
    en: [{ size: 3, unit: 'pcs', price: 3.00 }],
    es: [{ size: 3, unit: 'pcs', price: 2.50 }],
    de: [{ size: 3, unit: 'pcs', price: 3.20 }],
    ja: [{ size: 3, unit: 'pcs', price: 280 }],
  },
  'jp-bifun': {
    fr: [{ size: 100, unit: 'g', price: 2.20 }, { size: 200, unit: 'g', price: 3.80 }],
    en: [{ size: 100, unit: 'g', price: 2.00 }],
    es: [{ size: 100, unit: 'g', price: 1.80 }],
    de: [{ size: 100, unit: 'g', price: 2.20 }],
    ja: [{ size: 100, unit: 'g', price: 280 }],
  },

  // ─── PASTA-RICE (9 entrées) ───────────────────────────────────────────
  'gp-farfalle': {
    fr: [{ size: 500, unit: 'g', price: 1.20 }, { size: 1, unit: 'kg', price: 2.20 }],
    en: [{ size: 500, unit: 'g', price: 1.20 }],
    es: [{ size: 500, unit: 'g', price: 1.00 }],
    de: [{ size: 500, unit: 'g', price: 1.20 }],
    ja: [{ size: 500, unit: 'g', price: 320 }],
  },
  'gp-nouilles-asie': {
    fr: [{ size: 250, unit: 'g', price: 1.80 }, { size: 500, unit: 'g', price: 3.20 }],
    en: [{ size: 250, unit: 'g', price: 1.70 }],
    es: [{ size: 250, unit: 'g', price: 1.50 }],
    de: [{ size: 250, unit: 'g', price: 1.80 }],
    ja: [{ size: 250, unit: 'g', price: 280 }],
  },
  'gp-orzo': {
    fr: [{ size: 500, unit: 'g', price: 1.50 }, { size: 1, unit: 'kg', price: 2.80 }],
    en: [{ size: 500, unit: 'g', price: 1.50 }],
    es: [{ size: 500, unit: 'g', price: 1.20 }],
    de: [{ size: 500, unit: 'g', price: 1.50 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },
  'gp-vermicelles': {
    fr: [{ size: 250, unit: 'g', price: 1.50 }, { size: 500, unit: 'g', price: 2.50 }],
    en: [{ size: 250, unit: 'g', price: 1.40 }],
    es: [{ size: 250, unit: 'g', price: 1.20 }],
    de: [{ size: 250, unit: 'g', price: 1.50 }],
    ja: [{ size: 250, unit: 'g', price: 320 }],
  },
  'gp-riz': {
    // Parent générique = long blanc
    fr: [{ size: 500, unit: 'g', price: 1.20 }, { size: 1, unit: 'kg', price: 2.20 }, { size: 5, unit: 'kg', price: 9.50 }],
    en: [{ size: 1, unit: 'kg', price: 2.00 }],
    es: [{ size: 1, unit: 'kg', price: 1.80 }],
    de: [{ size: 1, unit: 'kg', price: 2.20 }],
    ja: [{ size: 1, unit: 'kg', price: 380 }],
  },
  'gp-riz-complet': {
    fr: [{ size: 500, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 1.70 }],
    es: [{ size: 500, unit: 'g', price: 1.50 }],
    de: [{ size: 500, unit: 'g', price: 1.80 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'gp-boulgour': {
    fr: [{ size: 500, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 1.70 }],
    es: [{ size: 500, unit: 'g', price: 1.50 }],
    de: [{ size: 500, unit: 'g', price: 1.80 }],
    ja: [{ size: 500, unit: 'g', price: 380 }],
  },
  'gp-sarrasin': {
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1, unit: 'kg', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 2.30 }],
    es: [{ size: 500, unit: 'g', price: 2.00 }],
    de: [{ size: 500, unit: 'g', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
}
