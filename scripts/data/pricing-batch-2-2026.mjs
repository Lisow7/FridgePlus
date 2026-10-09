/**
 * Lot 2 — enrichissement pricing pour v3.33.0 (Phase E.3).
 *
 * Cible les sous-catégories les plus exposées identifiées par
 * `npm run pricing:audit` après le lot 1 v3.32.0 :
 *   - sauces (27 manquants → 12 sauces et condiments fréquents)
 *   - canned (25 manquants → 12 conserves usuelles)
 *   - dairy (24 manquants → 13 produits laitiers + pâtes pâtissières)
 *
 * Sources : référence grande surface FR 2025-2026.
 * Format identique à `pricing/2026.json`.
 */

export const PRICING_BATCH_2 = {
  // ─── SAUCES (12 entrées) ──────────────────────────────────────────────
  'sp-pesto': {
    fr: [{ size: 130, unit: 'g', price: 2.50 }, { size: 190, unit: 'g', price: 3.50 }],
    en: [{ size: 190, unit: 'g', price: 2.80 }],
    es: [{ size: 130, unit: 'g', price: 2.20 }],
    de: [{ size: 190, unit: 'g', price: 2.80 }],
    ja: [{ size: 130, unit: 'g', price: 580 }],
  },
  'sp-sauce-bbq': {
    fr: [{ size: 250, unit: 'ml', price: 2.20 }, { size: 500, unit: 'ml', price: 3.50 }],
    en: [{ size: 500, unit: 'ml', price: 2.80 }],
    es: [{ size: 500, unit: 'ml', price: 2.50 }],
    de: [{ size: 500, unit: 'ml', price: 2.80 }],
    ja: [{ size: 250, unit: 'ml', price: 480 }],
  },
  'sp-cornichon': {
    fr: [{ size: 220, unit: 'g', price: 1.80 }, { size: 350, unit: 'g', price: 2.80 }],
    en: [{ size: 350, unit: 'g', price: 2.50 }],
    es: [{ size: 350, unit: 'g', price: 2.20 }],
    de: [{ size: 350, unit: 'g', price: 2.50 }],
    ja: [{ size: 220, unit: 'g', price: 480 }],
  },
  'sp-sauce-hoisin': {
    fr: [{ size: 200, unit: 'ml', price: 2.80 }, { size: 250, unit: 'ml', price: 3.50 }],
    en: [{ size: 250, unit: 'ml', price: 3.00 }],
    es: [{ size: 200, unit: 'ml', price: 2.50 }],
    de: [{ size: 250, unit: 'ml', price: 3.00 }],
    ja: [{ size: 250, unit: 'ml', price: 480 }],
  },
  'sp-sauce-teriyaki': {
    fr: [{ size: 250, unit: 'ml', price: 2.80 }, { size: 500, unit: 'ml', price: 4.50 }],
    en: [{ size: 250, unit: 'ml', price: 2.80 }],
    es: [{ size: 250, unit: 'ml', price: 2.40 }],
    de: [{ size: 250, unit: 'ml', price: 2.80 }],
    ja: [{ size: 250, unit: 'ml', price: 380 }],
  },
  'sp-sauce-huitre': {
    fr: [{ size: 200, unit: 'ml', price: 2.50 }, { size: 510, unit: 'ml', price: 4.50 }],
    en: [{ size: 510, unit: 'ml', price: 4.00 }],
    es: [{ size: 200, unit: 'ml', price: 2.20 }],
    de: [{ size: 510, unit: 'ml', price: 4.00 }],
    ja: [{ size: 510, unit: 'ml', price: 580 }],
  },
  'sp-nuoc-mam': {
    fr: [{ size: 200, unit: 'ml', price: 2.40 }, { size: 700, unit: 'ml', price: 5.20 }],
    en: [{ size: 700, unit: 'ml', price: 4.80 }],
    es: [{ size: 200, unit: 'ml', price: 2.20 }],
    de: [{ size: 700, unit: 'ml', price: 4.80 }],
    ja: [{ size: 200, unit: 'ml', price: 380 }],
  },
  'sp-sriracha': {
    fr: [{ size: 200, unit: 'ml', price: 2.80 }, { size: 482, unit: 'ml', price: 5.20 }],
    en: [{ size: 482, unit: 'ml', price: 4.50 }],
    es: [{ size: 200, unit: 'ml', price: 2.50 }],
    de: [{ size: 482, unit: 'ml', price: 5.00 }],
    ja: [{ size: 200, unit: 'ml', price: 480 }],
  },
  'sp-tabasco': {
    fr: [{ size: 60, unit: 'ml', price: 3.20 }, { size: 150, unit: 'ml', price: 5.50 }],
    en: [{ size: 60, unit: 'ml', price: 3.00 }],
    es: [{ size: 60, unit: 'ml', price: 2.80 }],
    de: [{ size: 60, unit: 'ml', price: 3.20 }],
    ja: [{ size: 60, unit: 'ml', price: 580 }],
  },
  'sp-harissa': {
    fr: [{ size: 70, unit: 'g', price: 1.50 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 200, unit: 'g', price: 2.80 }],
    es: [{ size: 70, unit: 'g', price: 1.40 }],
    de: [{ size: 200, unit: 'g', price: 2.80 }],
    ja: [{ size: 70, unit: 'g', price: 380 }],
  },
  'sp-tahini': {
    fr: [{ size: 270, unit: 'g', price: 4.50 }, { size: 500, unit: 'g', price: 7.20 }],
    en: [{ size: 270, unit: 'g', price: 4.20 }],
    es: [{ size: 270, unit: 'g', price: 3.80 }],
    de: [{ size: 270, unit: 'g', price: 4.50 }],
    ja: [{ size: 270, unit: 'g', price: 880 }],
  },
  'sp-beurre-cacahuete': {
    fr: [{ size: 350, unit: 'g', price: 3.50 }, { size: 500, unit: 'g', price: 4.80 }],
    en: [{ size: 350, unit: 'g', price: 3.20 }],
    es: [{ size: 350, unit: 'g', price: 2.80 }],
    de: [{ size: 350, unit: 'g', price: 3.50 }],
    ja: [{ size: 350, unit: 'g', price: 580 }],
  },

  // ─── CANNED (12 entrées) ──────────────────────────────────────────────
  'gp-sardines': {
    fr: [{ size: 115, unit: 'g', price: 1.50 }, { size: 135, unit: 'g', price: 2.20 }],
    en: [{ size: 120, unit: 'g', price: 1.80 }],
    es: [{ size: 120, unit: 'g', price: 1.40 }],
    de: [{ size: 120, unit: 'g', price: 1.50 }],
    ja: [{ size: 100, unit: 'g', price: 280 }],
  },
  'gp-maquereau': {
    fr: [{ size: 169, unit: 'g', price: 2.20 }, { size: 200, unit: 'g', price: 2.80 }],
    en: [{ size: 200, unit: 'g', price: 2.50 }],
    es: [{ size: 200, unit: 'g', price: 1.90 }],
    de: [{ size: 200, unit: 'g', price: 2.20 }],
    ja: [{ size: 200, unit: 'g', price: 380 }],
  },
  'gp-anchois': {
    fr: [{ size: 50, unit: 'g', price: 2.40 }, { size: 90, unit: 'g', price: 3.50 }],
    en: [{ size: 50, unit: 'g', price: 2.20 }],
    es: [{ size: 50, unit: 'g', price: 1.80 }],
    de: [{ size: 50, unit: 'g', price: 2.20 }],
    ja: [{ size: 50, unit: 'g', price: 480 }],
  },
  'gp-petits-pois': {
    fr: [{ size: 200, unit: 'g', price: 0.95 }, { size: 400, unit: 'g', price: 1.50 }],
    en: [{ size: 400, unit: 'g', price: 1.20 }],
    es: [{ size: 400, unit: 'g', price: 1.10 }],
    de: [{ size: 400, unit: 'g', price: 1.20 }],
    ja: [{ size: 200, unit: 'g', price: 220 }],
  },
  'gp-haricots-verts-cons': {
    fr: [{ size: 220, unit: 'g', price: 0.95 }, { size: 400, unit: 'g', price: 1.50 }],
    en: [{ size: 400, unit: 'g', price: 1.20 }],
    es: [{ size: 400, unit: 'g', price: 1.10 }],
    de: [{ size: 400, unit: 'g', price: 1.20 }],
    ja: [{ size: 220, unit: 'g', price: 220 }],
  },
  'gp-tomate': {
    // Boîte standard 400g
    fr: [{ size: 400, unit: 'g', price: 0.80 }, { size: 800, unit: 'g', price: 1.40 }],
    en: [{ size: 400, unit: 'g', price: 0.70 }],
    es: [{ size: 400, unit: 'g', price: 0.65 }],
    de: [{ size: 400, unit: 'g', price: 0.75 }],
    ja: [{ size: 400, unit: 'g', price: 200 }],
  },
  'gp-tomates-concas': {
    fr: [{ size: 400, unit: 'g', price: 0.85 }, { size: 800, unit: 'g', price: 1.50 }],
    en: [{ size: 400, unit: 'g', price: 0.75 }],
    es: [{ size: 400, unit: 'g', price: 0.70 }],
    de: [{ size: 400, unit: 'g', price: 0.80 }],
    ja: [{ size: 400, unit: 'g', price: 220 }],
  },
  'gp-olive': {
    fr: [{ size: 150, unit: 'g', price: 1.50 }, { size: 320, unit: 'g', price: 2.80 }],
    en: [{ size: 150, unit: 'g', price: 1.40 }],
    es: [{ size: 150, unit: 'g', price: 1.20 }],
    de: [{ size: 150, unit: 'g', price: 1.50 }],
    ja: [{ size: 150, unit: 'g', price: 320 }],
  },
  'gp-champignons': {
    fr: [{ size: 230, unit: 'g', price: 1.20 }, { size: 400, unit: 'g', price: 1.80 }],
    en: [{ size: 290, unit: 'g', price: 1.40 }],
    es: [{ size: 230, unit: 'g', price: 1.10 }],
    de: [{ size: 290, unit: 'g', price: 1.40 }],
    ja: [{ size: 230, unit: 'g', price: 280 }],
  },
  'gp-mais': {
    fr: [{ size: 285, unit: 'g', price: 0.95 }, { size: 425, unit: 'g', price: 1.40 }],
    en: [{ size: 340, unit: 'g', price: 1.20 }],
    es: [{ size: 285, unit: 'g', price: 0.90 }],
    de: [{ size: 285, unit: 'g', price: 0.95 }],
    ja: [{ size: 285, unit: 'g', price: 220 }],
  },
  'gp-pate-curry-rouge': {
    fr: [{ size: 110, unit: 'g', price: 2.50 }, { size: 220, unit: 'g', price: 4.20 }],
    en: [{ size: 110, unit: 'g', price: 2.20 }],
    es: [{ size: 110, unit: 'g', price: 2.00 }],
    de: [{ size: 110, unit: 'g', price: 2.40 }],
    ja: [{ size: 110, unit: 'g', price: 480 }],
  },
  'gp-pate-curry-vert': {
    fr: [{ size: 110, unit: 'g', price: 2.50 }, { size: 220, unit: 'g', price: 4.20 }],
    en: [{ size: 110, unit: 'g', price: 2.20 }],
    es: [{ size: 110, unit: 'g', price: 2.00 }],
    de: [{ size: 110, unit: 'g', price: 2.40 }],
    ja: [{ size: 110, unit: 'g', price: 480 }],
  },

  // ─── DAIRY (13 entrées) ───────────────────────────────────────────────
  // Note : `fr-lait`, `fr-creme`, `fr-yaourt` sont des parents génériques —
  // par défaut entier / liquide / nature. Les variantes spécifiques (entier,
  // demi-écrémé, fraîche, soja, etc.) ont leurs propres entrées.
  'fr-creme': {
    fr: [{ size: 20, unit: 'cl', price: 1.20 }, { size: 50, unit: 'cl', price: 2.60 }],
    en: [{ size: 30, unit: 'cl', price: 1.50 }],
    es: [{ size: 20, unit: 'cl', price: 1.10 }],
    de: [{ size: 20, unit: 'cl', price: 1.10 }],
    ja: [{ size: 20, unit: 'cl', price: 220 }],
  },
  'fr-lait': {
    fr: [{ size: 100, unit: 'cl', price: 1.20 }, { size: 600, unit: 'cl', price: 6.30 }],
    en: [{ size: 200, unit: 'cl', price: 1.40 }],
    es: [{ size: 100, unit: 'cl', price: 1.05 }],
    de: [{ size: 100, unit: 'cl', price: 1.10 }],
    ja: [{ size: 100, unit: 'cl', price: 250 }],
  },
  'fr-lait-demi': {
    fr: [{ size: 100, unit: 'cl', price: 1.10 }, { size: 600, unit: 'cl', price: 5.80 }],
    en: [{ size: 200, unit: 'cl', price: 1.30 }],
    es: [{ size: 100, unit: 'cl', price: 0.95 }],
    de: [{ size: 100, unit: 'cl', price: 1.00 }],
    ja: [{ size: 100, unit: 'cl', price: 230 }],
  },
  'fr-margarine': {
    fr: [{ size: 250, unit: 'g', price: 1.80 }, { size: 500, unit: 'g', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 2.80 }],
    es: [{ size: 500, unit: 'g', price: 2.40 }],
    de: [{ size: 500, unit: 'g', price: 2.80 }],
    ja: [{ size: 250, unit: 'g', price: 380 }],
  },
  'fr-yaourt': {
    // Pack 4×125g standard.
    fr: [{ size: 4, unit: 'pcs', price: 1.50 }, { size: 8, unit: 'pcs', price: 2.80 }, { size: 16, unit: 'pcs', price: 5.20 }],
    en: [{ size: 4, unit: 'pcs', price: 1.80 }],
    es: [{ size: 4, unit: 'pcs', price: 1.40 }],
    de: [{ size: 4, unit: 'pcs', price: 1.50 }],
    ja: [{ size: 4, unit: 'pcs', price: 320 }],
  },
  'fr-petits-suisses': {
    // Pack 12×60g classique.
    fr: [{ size: 12, unit: 'pcs', price: 2.50 }, { size: 24, unit: 'pcs', price: 4.50 }],
    en: [{ size: 12, unit: 'pcs', price: 2.40 }],
    es: [{ size: 12, unit: 'pcs', price: 2.20 }],
    de: [{ size: 12, unit: 'pcs', price: 2.50 }],
    ja: [{ size: 12, unit: 'pcs', price: 580 }],
  },
  'fr-skyr': {
    fr: [{ size: 450, unit: 'g', price: 2.80 }, { size: 1, unit: 'kg', price: 5.50 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
    es: [{ size: 450, unit: 'g', price: 2.50 }],
    de: [{ size: 450, unit: 'g', price: 2.80 }],
    ja: [{ size: 450, unit: 'g', price: 580 }],
  },
  'fr-fromage-rape': {
    fr: [{ size: 200, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 2.60 }],
    es: [{ size: 200, unit: 'g', price: 2.40 }],
    de: [{ size: 200, unit: 'g', price: 2.70 }],
    ja: [{ size: 200, unit: 'g', price: 420 }],
  },
  'fr-fromage-frais': {
    // Type Saint-Môret, ~150g standard.
    fr: [{ size: 150, unit: 'g', price: 2.20 }, { size: 300, unit: 'g', price: 3.80 }],
    en: [{ size: 200, unit: 'g', price: 2.40 }],
    es: [{ size: 150, unit: 'g', price: 1.90 }],
    de: [{ size: 200, unit: 'g', price: 2.40 }],
    ja: [{ size: 150, unit: 'g', price: 380 }],
  },
  'fr-lait-amande': {
    fr: [{ size: 100, unit: 'cl', price: 2.20 }, { size: 600, unit: 'cl', price: 11.50 }],
    en: [{ size: 100, unit: 'cl', price: 2.20 }],
    es: [{ size: 100, unit: 'cl', price: 1.80 }],
    de: [{ size: 100, unit: 'cl', price: 2.20 }],
    ja: [{ size: 100, unit: 'cl', price: 480 }],
  },
  'fr-lait-avoine': {
    fr: [{ size: 100, unit: 'cl', price: 2.40 }, { size: 600, unit: 'cl', price: 12.50 }],
    en: [{ size: 100, unit: 'cl', price: 2.20 }],
    es: [{ size: 100, unit: 'cl', price: 1.95 }],
    de: [{ size: 100, unit: 'cl', price: 2.20 }],
    ja: [{ size: 100, unit: 'cl', price: 520 }],
  },
  'fr-pate-feuilletee': {
    // Rouleau 230g standard
    fr: [{ size: 230, unit: 'g', price: 1.80 }, { size: 320, unit: 'g', price: 2.40 }],
    en: [{ size: 320, unit: 'g', price: 2.20 }],
    es: [{ size: 230, unit: 'g', price: 1.60 }],
    de: [{ size: 230, unit: 'g', price: 1.80 }],
    ja: [{ size: 230, unit: 'g', price: 380 }],
  },
  'fr-pate-brisee': {
    fr: [{ size: 230, unit: 'g', price: 1.60 }, { size: 320, unit: 'g', price: 2.20 }],
    en: [{ size: 320, unit: 'g', price: 2.00 }],
    es: [{ size: 230, unit: 'g', price: 1.50 }],
    de: [{ size: 230, unit: 'g', price: 1.70 }],
    ja: [{ size: 230, unit: 'g', price: 380 }],
  },
}
