/**
 * Lot 3 — enrichissement pricing pour v3.34.0 (Phase E.4).
 *
 * Cible les sous-catégories les plus exposées après le lot 2 v3.33.0 :
 *   - vegetables (29 manquants → 13 légumes restants courants)
 *   - fruits (22 manquants → 14 fruits saisonniers + agrumes + tropicaux)
 *   - salt-spices (20 manquants → 14 épices et graines courantes)
 *
 * Sources : référence grande surface FR 2025-2026.
 */

export const PRICING_BATCH_3 = {
  // ─── VEGETABLES (13 entrées) ──────────────────────────────────────────
  'vg-chou-kale': {
    fr: [{ size: 200, unit: 'g', price: 2.40 }, { size: 1, unit: 'pcs', price: 2.80 }],
    en: [{ size: 200, unit: 'g', price: 2.20 }],
    es: [{ size: 200, unit: 'g', price: 1.80 }],
    de: [{ size: 200, unit: 'g', price: 2.20 }],
    ja: [{ size: 200, unit: 'g', price: 480 }],
  },
  'vg-blettes': {
    fr: [{ size: 1, unit: 'botte', price: 2.20 }, { size: 500, unit: 'g', price: 2.80 }],
    en: [{ size: 500, unit: 'g', price: 2.50 }],
    es: [{ size: 500, unit: 'g', price: 2.20 }],
    de: [{ size: 500, unit: 'g', price: 2.80 }],
    ja: [{ size: 1, unit: 'botte', price: 380 }],
  },
  'vg-chou-bruxelles': {
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1, unit: 'kg', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 2.20 }],
    es: [{ size: 500, unit: 'g', price: 2.00 }],
    de: [{ size: 500, unit: 'g', price: 2.50 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'vg-pak-choi': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 500, unit: 'g', price: 2.80 }],
    en: [{ size: 1, unit: 'pcs', price: 1.60 }],
    es: [{ size: 1, unit: 'pcs', price: 1.40 }],
    de: [{ size: 1, unit: 'pcs', price: 1.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 280 }],
  },
  'vg-petits-pois': {
    // Frais (cosse) — saisonnier mai-juillet
    fr: [{ size: 500, unit: 'g', price: 2.80 }, { size: 1, unit: 'kg', price: 4.80 }],
    en: [{ size: 500, unit: 'g', price: 2.50 }],
    es: [{ size: 500, unit: 'g', price: 2.20 }],
    de: [{ size: 500, unit: 'g', price: 2.80 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'vg-pois-m-tout': {
    fr: [{ size: 250, unit: 'g', price: 2.50 }, { size: 500, unit: 'g', price: 4.20 }],
    en: [{ size: 250, unit: 'g', price: 2.40 }],
    es: [{ size: 250, unit: 'g', price: 2.00 }],
    de: [{ size: 250, unit: 'g', price: 2.50 }],
    ja: [{ size: 250, unit: 'g', price: 480 }],
  },
  'vg-feves': {
    // Cosses fraîches
    fr: [{ size: 500, unit: 'g', price: 3.20 }, { size: 1, unit: 'kg', price: 5.50 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
    es: [{ size: 500, unit: 'g', price: 2.50 }],
    de: [{ size: 500, unit: 'g', price: 3.20 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'vg-oignon-vert': {
    // Botte ~6 oignons nouveaux
    fr: [{ size: 1, unit: 'botte', price: 1.80 }, { size: 200, unit: 'g', price: 2.20 }],
    en: [{ size: 1, unit: 'botte', price: 1.60 }],
    es: [{ size: 1, unit: 'botte', price: 1.40 }],
    de: [{ size: 1, unit: 'botte', price: 1.80 }],
    ja: [{ size: 1, unit: 'botte', price: 220 }],
  },
  'vg-germes-soja': {
    fr: [{ size: 200, unit: 'g', price: 1.80 }, { size: 400, unit: 'g', price: 3.00 }],
    en: [{ size: 200, unit: 'g', price: 1.50 }],
    es: [{ size: 200, unit: 'g', price: 1.40 }],
    de: [{ size: 200, unit: 'g', price: 1.50 }],
    ja: [{ size: 200, unit: 'g', price: 180 }],
  },
  'vg-gombo': {
    fr: [{ size: 200, unit: 'g', price: 2.80 }, { size: 500, unit: 'g', price: 6.20 }],
    en: [{ size: 200, unit: 'g', price: 2.50 }],
    es: [{ size: 200, unit: 'g', price: 2.20 }],
    de: [{ size: 200, unit: 'g', price: 2.80 }],
    ja: [{ size: 200, unit: 'g', price: 480 }],
  },
  'vg-tempeh': {
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 400, unit: 'g', price: 6.20 }],
    en: [{ size: 200, unit: 'g', price: 3.20 }],
    es: [{ size: 200, unit: 'g', price: 2.80 }],
    de: [{ size: 200, unit: 'g', price: 3.50 }],
    ja: [{ size: 200, unit: 'g', price: 580 }],
  },
  'vg-seitan': {
    fr: [{ size: 200, unit: 'g', price: 3.20 }, { size: 400, unit: 'g', price: 5.80 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
    es: [{ size: 200, unit: 'g', price: 2.50 }],
    de: [{ size: 200, unit: 'g', price: 3.20 }],
    ja: [{ size: 200, unit: 'g', price: 580 }],
  },
  'vg-pvt': {
    // Protéines végétales texturées (sec)
    fr: [{ size: 150, unit: 'g', price: 2.20 }, { size: 500, unit: 'g', price: 5.80 }],
    en: [{ size: 150, unit: 'g', price: 2.00 }],
    es: [{ size: 150, unit: 'g', price: 1.80 }],
    de: [{ size: 150, unit: 'g', price: 2.20 }],
    ja: [{ size: 150, unit: 'g', price: 480 }],
  },

  // ─── FRUITS (14 entrées) ──────────────────────────────────────────────
  'fr-mandarine': {
    fr: [{ size: 1, unit: 'pcs', price: 0.40 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 1, unit: 'kg', price: 3.00 }],
    es: [{ size: 1, unit: 'kg', price: 2.20 }],
    de: [{ size: 1, unit: 'kg', price: 3.00 }],
    ja: [{ size: 1, unit: 'pcs', price: 80 }],
  },
  'fr-clem': {
    // Clémentine
    fr: [{ size: 1, unit: 'pcs', price: 0.35 }, { size: 1, unit: 'kg', price: 2.80 }, { size: 2, unit: 'kg', price: 5.20 }],
    en: [{ size: 1, unit: 'kg', price: 2.80 }],
    es: [{ size: 1, unit: 'kg', price: 2.00 }],
    de: [{ size: 1, unit: 'kg', price: 2.80 }],
    ja: [{ size: 1, unit: 'kg', price: 580 }],
  },
  'fr-framboise': {
    fr: [{ size: 125, unit: 'g', price: 3.20 }, { size: 250, unit: 'g', price: 5.50 }],
    en: [{ size: 125, unit: 'g', price: 3.00 }],
    es: [{ size: 125, unit: 'g', price: 2.50 }],
    de: [{ size: 125, unit: 'g', price: 3.00 }],
    ja: [{ size: 125, unit: 'g', price: 680 }],
  },
  'fr-myrtille': {
    fr: [{ size: 125, unit: 'g', price: 3.50 }, { size: 250, unit: 'g', price: 6.00 }],
    en: [{ size: 125, unit: 'g', price: 3.20 }],
    es: [{ size: 125, unit: 'g', price: 2.80 }],
    de: [{ size: 125, unit: 'g', price: 3.20 }],
    ja: [{ size: 125, unit: 'g', price: 780 }],
  },
  'fr-cerise': {
    fr: [{ size: 500, unit: 'g', price: 4.50 }, { size: 1, unit: 'kg', price: 8.50 }],
    en: [{ size: 500, unit: 'g', price: 4.00 }],
    es: [{ size: 500, unit: 'g', price: 3.50 }],
    de: [{ size: 500, unit: 'g', price: 4.50 }],
    ja: [{ size: 500, unit: 'g', price: 1280 }],
  },
  'fr-peche': {
    fr: [{ size: 1, unit: 'pcs', price: 0.80 }, { size: 1, unit: 'kg', price: 3.50 }],
    en: [{ size: 1, unit: 'kg', price: 3.20 }],
    es: [{ size: 1, unit: 'kg', price: 2.40 }],
    de: [{ size: 1, unit: 'kg', price: 3.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 280 }],
  },
  'fr-abricot': {
    fr: [{ size: 500, unit: 'g', price: 2.80 }, { size: 1, unit: 'kg', price: 4.80 }],
    en: [{ size: 500, unit: 'g', price: 2.50 }],
    es: [{ size: 1, unit: 'kg', price: 3.20 }],
    de: [{ size: 1, unit: 'kg', price: 4.80 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'fr-nectarine': {
    fr: [{ size: 1, unit: 'pcs', price: 0.85 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size: 1, unit: 'kg', price: 3.50 }],
    es: [{ size: 1, unit: 'kg', price: 2.50 }],
    de: [{ size: 1, unit: 'kg', price: 3.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 280 }],
  },
  'fr-prune': {
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1, unit: 'kg', price: 4.20 }],
    en: [{ size: 500, unit: 'g', price: 2.20 }],
    es: [{ size: 1, unit: 'kg', price: 3.00 }],
    de: [{ size: 1, unit: 'kg', price: 4.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'fr-raisin': {
    fr: [{ size: 500, unit: 'g', price: 3.20 }, { size: 1, unit: 'kg', price: 5.50 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
    es: [{ size: 1, unit: 'kg', price: 3.80 }],
    de: [{ size: 500, unit: 'g', price: 3.20 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'fr-citron-vert': {
    fr: [{ size: 1, unit: 'pcs', price: 0.35 }, { size: 4, unit: 'pcs', price: 1.30 }, { size: 1, unit: 'kg', price: 4.80 }],
    en: [{ size: 4, unit: 'pcs', price: 1.20 }],
    es: [{ size: 1, unit: 'kg', price: 3.50 }],
    de: [{ size: 4, unit: 'pcs', price: 1.30 }],
    ja: [{ size: 1, unit: 'pcs', price: 80 }],
  },
  'fr-papaye': {
    fr: [{ size: 1, unit: 'pcs', price: 3.50 }],
    en: [{ size: 1, unit: 'pcs', price: 3.20 }],
    es: [{ size: 1, unit: 'pcs', price: 2.80 }],
    de: [{ size: 1, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 680 }],
  },
  'fr-noix-coco': {
    // Noix de coco entière
    fr: [{ size: 1, unit: 'pcs', price: 2.50 }],
    en: [{ size: 1, unit: 'pcs', price: 2.20 }],
    es: [{ size: 1, unit: 'pcs', price: 2.00 }],
    de: [{ size: 1, unit: 'pcs', price: 2.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 580 }],
  },
  'fr-litchi': {
    fr: [{ size: 500, unit: 'g', price: 5.20 }, { size: 1, unit: 'kg', price: 9.80 }],
    en: [{ size: 500, unit: 'g', price: 5.00 }],
    es: [{ size: 500, unit: 'g', price: 4.50 }],
    de: [{ size: 500, unit: 'g', price: 5.20 }],
    ja: [{ size: 500, unit: 'g', price: 880 }],
  },

  // ─── SALT-SPICES (14 entrées — pots/sachets standards) ────────────────
  'sp-cardamome': {
    fr: [{ size: 30, unit: 'g', price: 4.50 }, { size: 50, unit: 'g', price: 7.20 }],
    en: [{ size: 30, unit: 'g', price: 4.20 }],
    es: [{ size: 30, unit: 'g', price: 3.50 }],
    de: [{ size: 30, unit: 'g', price: 4.50 }],
    ja: [{ size: 30, unit: 'g', price: 980 }],
  },
  'sp-clous-girofle': {
    fr: [{ size: 25, unit: 'g', price: 2.20 }, { size: 50, unit: 'g', price: 3.80 }],
    en: [{ size: 25, unit: 'g', price: 2.00 }],
    es: [{ size: 25, unit: 'g', price: 1.80 }],
    de: [{ size: 25, unit: 'g', price: 2.20 }],
    ja: [{ size: 25, unit: 'g', price: 480 }],
  },
  'sp-safran': {
    // Très cher — pistil
    fr: [{ size: 0.5, unit: 'g', price: 3.50 }, { size: 1, unit: 'g', price: 6.50 }],
    en: [{ size: 0.5, unit: 'g', price: 3.50 }],
    es: [{ size: 0.5, unit: 'g', price: 3.00 }],
    de: [{ size: 0.5, unit: 'g', price: 3.50 }],
    ja: [{ size: 0.5, unit: 'g', price: 780 }],
  },
  'sp-piment-cayenne': {
    fr: [{ size: 30, unit: 'g', price: 1.80 }, { size: 50, unit: 'g', price: 2.80 }],
    en: [{ size: 30, unit: 'g', price: 1.70 }],
    es: [{ size: 30, unit: 'g', price: 1.40 }],
    de: [{ size: 30, unit: 'g', price: 1.80 }],
    ja: [{ size: 30, unit: 'g', price: 380 }],
  },
  'sp-ras-el-hanout': {
    fr: [{ size: 35, unit: 'g', price: 2.20 }, { size: 70, unit: 'g', price: 3.80 }],
    en: [{ size: 35, unit: 'g', price: 2.00 }],
    es: [{ size: 35, unit: 'g', price: 1.80 }],
    de: [{ size: 35, unit: 'g', price: 2.20 }],
    ja: [{ size: 35, unit: 'g', price: 480 }],
  },
  'sp-coriandre-pdre': {
    fr: [{ size: 35, unit: 'g', price: 1.80 }, { size: 70, unit: 'g', price: 3.20 }],
    en: [{ size: 35, unit: 'g', price: 1.70 }],
    es: [{ size: 35, unit: 'g', price: 1.40 }],
    de: [{ size: 35, unit: 'g', price: 1.80 }],
    ja: [{ size: 35, unit: 'g', price: 380 }],
  },
  'sp-sesame-noir': {
    fr: [{ size: 100, unit: 'g', price: 2.50 }, { size: 250, unit: 'g', price: 4.80 }],
    en: [{ size: 100, unit: 'g', price: 2.40 }],
    es: [{ size: 100, unit: 'g', price: 2.00 }],
    de: [{ size: 100, unit: 'g', price: 2.50 }],
    ja: [{ size: 100, unit: 'g', price: 380 }],
  },
  'sp-graines-moutarde': {
    fr: [{ size: 50, unit: 'g', price: 1.80 }, { size: 100, unit: 'g', price: 3.20 }],
    en: [{ size: 50, unit: 'g', price: 1.70 }],
    es: [{ size: 50, unit: 'g', price: 1.40 }],
    de: [{ size: 50, unit: 'g', price: 1.80 }],
    ja: [{ size: 50, unit: 'g', price: 380 }],
  },
  'sp-graines-fenouil': {
    fr: [{ size: 35, unit: 'g', price: 1.80 }, { size: 60, unit: 'g', price: 2.80 }],
    en: [{ size: 35, unit: 'g', price: 1.70 }],
    es: [{ size: 35, unit: 'g', price: 1.40 }],
    de: [{ size: 35, unit: 'g', price: 1.80 }],
    ja: [{ size: 35, unit: 'g', price: 380 }],
  },
  'sp-graines-coriandre': {
    fr: [{ size: 35, unit: 'g', price: 1.80 }, { size: 70, unit: 'g', price: 3.20 }],
    en: [{ size: 35, unit: 'g', price: 1.70 }],
    es: [{ size: 35, unit: 'g', price: 1.40 }],
    de: [{ size: 35, unit: 'g', price: 1.80 }],
    ja: [{ size: 35, unit: 'g', price: 380 }],
  },
  'sp-pavot': {
    fr: [{ size: 50, unit: 'g', price: 2.20 }, { size: 100, unit: 'g', price: 3.80 }],
    en: [{ size: 50, unit: 'g', price: 2.00 }],
    es: [{ size: 50, unit: 'g', price: 1.80 }],
    de: [{ size: 50, unit: 'g', price: 2.20 }],
    ja: [{ size: 50, unit: 'g', price: 480 }],
  },
  'sp-za-atar': {
    fr: [{ size: 40, unit: 'g', price: 2.80 }, { size: 80, unit: 'g', price: 4.80 }],
    en: [{ size: 40, unit: 'g', price: 2.50 }],
    es: [{ size: 40, unit: 'g', price: 2.20 }],
    de: [{ size: 40, unit: 'g', price: 2.80 }],
    ja: [{ size: 40, unit: 'g', price: 580 }],
  },
  'sp-sumac': {
    fr: [{ size: 40, unit: 'g', price: 2.80 }, { size: 80, unit: 'g', price: 4.80 }],
    en: [{ size: 40, unit: 'g', price: 2.50 }],
    es: [{ size: 40, unit: 'g', price: 2.20 }],
    de: [{ size: 40, unit: 'g', price: 2.80 }],
    ja: [{ size: 40, unit: 'g', price: 580 }],
  },
  'sp-cinq-epices': {
    fr: [{ size: 35, unit: 'g', price: 2.20 }, { size: 70, unit: 'g', price: 3.80 }],
    en: [{ size: 35, unit: 'g', price: 2.00 }],
    es: [{ size: 35, unit: 'g', price: 1.80 }],
    de: [{ size: 35, unit: 'g', price: 2.20 }],
    ja: [{ size: 35, unit: 'g', price: 380 }],
  },
}
