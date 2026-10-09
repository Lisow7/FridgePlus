/**
 * Lot 4 — enrichissement pricing pour v3.35.0 (Phase E.5).
 *
 * Cible les sous-catégories les plus exposées après le lot 3 v3.34.0 :
 *   - sweet (19 → 11 chocolats / sucreries / levures / liants courants)
 *   - meat (18 → 11 viandes restantes : bœuf, porc, veau, canard, agneau)
 *   - fish (18 → 11 poissons et fruits de mer courants)
 *   - frozen-meat (16 → 10 surgelés viande/poisson — sous-cat à 0 % couvert)
 *
 * Sources : référence grande surface FR 2025-2026.
 */

export const PRICING_BATCH_4 = {
  // ─── SWEET (11 entrées) ───────────────────────────────────────────────
  'gp-chocolat': {
    // Tablette générique 100g standard
    fr: [{ size: 100, unit: 'g', price: 1.50 }, { size: 200, unit: 'g', price: 2.80 }],
    en: [{ size: 100, unit: 'g', price: 1.40 }],
    es: [{ size: 100, unit: 'g', price: 1.20 }],
    de: [{ size: 100, unit: 'g', price: 1.50 }],
    ja: [{ size: 100, unit: 'g', price: 280 }],
  },
  'gp-choco-blanc': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 100, unit: 'g', price: 1.70 }],
    es: [{ size: 100, unit: 'g', price: 1.50 }],
    de: [{ size: 100, unit: 'g', price: 1.80 }],
    ja: [{ size: 100, unit: 'g', price: 320 }],
  },
  'gp-choco-lait': {
    fr: [{ size: 100, unit: 'g', price: 1.60 }, { size: 200, unit: 'g', price: 2.80 }],
    en: [{ size: 100, unit: 'g', price: 1.50 }],
    es: [{ size: 100, unit: 'g', price: 1.30 }],
    de: [{ size: 100, unit: 'g', price: 1.60 }],
    ja: [{ size: 100, unit: 'g', price: 300 }],
  },
  'gp-choco-patissier': {
    // Tablette dessert 200g standard
    fr: [{ size: 200, unit: 'g', price: 1.80 }, { size: 400, unit: 'g', price: 3.20 }],
    en: [{ size: 200, unit: 'g', price: 1.70 }],
    es: [{ size: 200, unit: 'g', price: 1.50 }],
    de: [{ size: 200, unit: 'g', price: 1.80 }],
    ja: [{ size: 200, unit: 'g', price: 380 }],
  },
  'gp-extrait-vanille': {
    fr: [{ size: 50, unit: 'ml', price: 3.80 }, { size: 100, unit: 'ml', price: 6.50 }],
    en: [{ size: 50, unit: 'ml', price: 3.50 }],
    es: [{ size: 50, unit: 'ml', price: 3.00 }],
    de: [{ size: 50, unit: 'ml', price: 3.80 }],
    ja: [{ size: 50, unit: 'ml', price: 880 }],
  },
  'gp-eau-fleur-oranger': {
    fr: [{ size: 250, unit: 'ml', price: 2.50 }, { size: 500, unit: 'ml', price: 4.20 }],
    en: [{ size: 250, unit: 'ml', price: 2.30 }],
    es: [{ size: 250, unit: 'ml', price: 2.00 }],
    de: [{ size: 250, unit: 'ml', price: 2.50 }],
    ja: [{ size: 250, unit: 'ml', price: 580 }],
  },
  'gp-levure-boul': {
    // Sachet 7g levure sèche (paquet de 3 ou 5)
    fr: [{ size: 21, unit: 'g', price: 0.95 }, { size: 35, unit: 'g', price: 1.50 }],
    en: [{ size: 21, unit: 'g', price: 0.90 }],
    es: [{ size: 21, unit: 'g', price: 0.80 }],
    de: [{ size: 21, unit: 'g', price: 0.95 }],
    ja: [{ size: 21, unit: 'g', price: 220 }],
  },
  'gp-levure-seche': {
    fr: [{ size: 21, unit: 'g', price: 0.95 }, { size: 35, unit: 'g', price: 1.50 }],
    en: [{ size: 21, unit: 'g', price: 0.90 }],
    es: [{ size: 21, unit: 'g', price: 0.80 }],
    de: [{ size: 21, unit: 'g', price: 0.95 }],
    ja: [{ size: 21, unit: 'g', price: 220 }],
  },
  'gp-gelatine': {
    // Sachet 6 feuilles ~12g
    fr: [{ size: 12, unit: 'g', price: 1.50 }, { size: 20, unit: 'g', price: 2.40 }],
    en: [{ size: 12, unit: 'g', price: 1.40 }],
    es: [{ size: 12, unit: 'g', price: 1.20 }],
    de: [{ size: 12, unit: 'g', price: 1.50 }],
    ja: [{ size: 12, unit: 'g', price: 380 }],
  },
  'gp-agar-agar': {
    fr: [{ size: 4, unit: 'g', price: 1.80 }, { size: 16, unit: 'g', price: 5.50 }],
    en: [{ size: 4, unit: 'g', price: 1.70 }],
    es: [{ size: 4, unit: 'g', price: 1.50 }],
    de: [{ size: 4, unit: 'g', price: 1.80 }],
    ja: [{ size: 4, unit: 'g', price: 380 }],
  },
  'gp-sirop-erable': {
    fr: [{ size: 250, unit: 'ml', price: 6.50 }, { size: 500, unit: 'ml', price: 11.00 }],
    en: [{ size: 250, unit: 'ml', price: 6.00 }],
    es: [{ size: 250, unit: 'ml', price: 5.50 }],
    de: [{ size: 250, unit: 'ml', price: 6.50 }],
    ja: [{ size: 250, unit: 'ml', price: 1280 }],
  },
  'gp-pate-tartiner-choco': {
    fr: [{ size: 400, unit: 'g', price: 3.50 }, { size: 750, unit: 'g', price: 5.80 }, { size: 1000, unit: 'g', price: 7.20 }],
    en: [{ size: 400, unit: 'g', price: 3.20 }],
    es: [{ size: 400, unit: 'g', price: 3.00 }],
    de: [{ size: 400, unit: 'g', price: 3.50 }],
    ja: [{ size: 400, unit: 'g', price: 780 }],
  },

  // ─── MEAT (11 entrées) ────────────────────────────────────────────────
  'fr-boeuf': {
    // Steak haché 5% MG, barquette standard 500g
    fr: [{ size: 500, unit: 'g', price: 6.50 }, { size: 1, unit: 'kg', price: 12.00 }],
    en: [{ size: 500, unit: 'g', price: 6.00 }],
    es: [{ size: 500, unit: 'g', price: 5.50 }],
    de: [{ size: 500, unit: 'g', price: 6.50 }],
    ja: [{ size: 500, unit: 'g', price: 980 }],
  },
  'fr-bavette': {
    fr: [{ size: 300, unit: 'g', price: 8.50 }, { size: 500, unit: 'g', price: 13.50 }],
    en: [{ size: 500, unit: 'g', price: 12.00 }],
    es: [{ size: 500, unit: 'g', price: 10.00 }],
    de: [{ size: 500, unit: 'g', price: 12.50 }],
    ja: [{ size: 300, unit: 'g', price: 1280 }],
  },
  'fr-entrecote': {
    // Pièce typique 250-300g
    fr: [{ size: 250, unit: 'g', price: 9.50 }, { size: 500, unit: 'g', price: 18.00 }],
    en: [{ size: 500, unit: 'g', price: 16.00 }],
    es: [{ size: 500, unit: 'g', price: 14.00 }],
    de: [{ size: 500, unit: 'g', price: 17.00 }],
    ja: [{ size: 250, unit: 'g', price: 1480 }],
  },
  'fr-filet-boeuf': {
    fr: [{ size: 250, unit: 'g', price: 12.50 }, { size: 500, unit: 'g', price: 24.00 }],
    en: [{ size: 500, unit: 'g', price: 22.00 }],
    es: [{ size: 500, unit: 'g', price: 18.00 }],
    de: [{ size: 500, unit: 'g', price: 23.00 }],
    ja: [{ size: 250, unit: 'g', price: 2280 }],
  },
  'fr-paleron': {
    fr: [{ size: 500, unit: 'g', price: 6.80 }, { size: 1, unit: 'kg', price: 12.50 }],
    en: [{ size: 1, unit: 'kg', price: 11.00 }],
    es: [{ size: 1, unit: 'kg', price: 9.50 }],
    de: [{ size: 1, unit: 'kg', price: 11.50 }],
    ja: [{ size: 500, unit: 'g', price: 980 }],
  },
  'fr-travers-porc': {
    fr: [{ size: 500, unit: 'g', price: 5.50 }, { size: 1, unit: 'kg', price: 9.80 }],
    en: [{ size: 1, unit: 'kg', price: 9.00 }],
    es: [{ size: 1, unit: 'kg', price: 7.50 }],
    de: [{ size: 1, unit: 'kg', price: 8.80 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'fr-echine': {
    fr: [{ size: 500, unit: 'g', price: 5.20 }, { size: 1, unit: 'kg', price: 9.50 }],
    en: [{ size: 1, unit: 'kg', price: 8.50 }],
    es: [{ size: 1, unit: 'kg', price: 7.00 }],
    de: [{ size: 1, unit: 'kg', price: 8.50 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'fr-jarret-veau': {
    fr: [{ size: 500, unit: 'g', price: 8.50 }, { size: 1, unit: 'kg', price: 16.00 }],
    en: [{ size: 1, unit: 'kg', price: 14.50 }],
    es: [{ size: 1, unit: 'kg', price: 12.00 }],
    de: [{ size: 1, unit: 'kg', price: 14.50 }],
    ja: [{ size: 500, unit: 'g', price: 1280 }],
  },
  'fr-cuisse-canard': {
    // Confit ou frais — 2 cuisses ~600g
    fr: [{ size: 2, unit: 'pcs', price: 7.50 }, { size: 4, unit: 'pcs', price: 13.50 }],
    en: [{ size: 2, unit: 'pcs', price: 8.00 }],
    es: [{ size: 2, unit: 'pcs', price: 6.50 }],
    de: [{ size: 2, unit: 'pcs', price: 7.50 }],
    ja: [{ size: 2, unit: 'pcs', price: 1180 }],
  },
  'fr-epaule-agneau': {
    fr: [{ size: 1, unit: 'kg', price: 16.00 }, { size: 1500, unit: 'g', price: 22.50 }],
    en: [{ size: 1, unit: 'kg', price: 14.50 }],
    es: [{ size: 1, unit: 'kg', price: 12.50 }],
    de: [{ size: 1, unit: 'kg', price: 15.00 }],
    ja: [{ size: 1, unit: 'kg', price: 2480 }],
  },
  'fr-lapin': {
    // Lapin entier ~1.5kg ou découpe
    fr: [{ size: 1, unit: 'pcs', price: 12.50 }, { size: 1, unit: 'kg', price: 11.50 }],
    en: [{ size: 1, unit: 'kg', price: 10.00 }],
    es: [{ size: 1, unit: 'kg', price: 8.50 }],
    de: [{ size: 1, unit: 'kg', price: 11.00 }],
    ja: [{ size: 1, unit: 'kg', price: 2280 }],
  },

  // ─── FISH (11 entrées) ────────────────────────────────────────────────
  'fr-bar': {
    // Pièce entière 400-600g
    fr: [{ size: 1, unit: 'pcs', price: 10.50 }, { size: 1, unit: 'kg', price: 18.00 }],
    en: [{ size: 1, unit: 'kg', price: 16.00 }],
    es: [{ size: 1, unit: 'kg', price: 14.00 }],
    de: [{ size: 1, unit: 'kg', price: 16.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 1480 }],
  },
  'fr-cabillaud': {
    // Filet barquette
    fr: [{ size: 300, unit: 'g', price: 6.50 }, { size: 500, unit: 'g', price: 10.50 }],
    en: [{ size: 500, unit: 'g', price: 9.50 }],
    es: [{ size: 500, unit: 'g', price: 8.00 }],
    de: [{ size: 500, unit: 'g', price: 9.50 }],
    ja: [{ size: 300, unit: 'g', price: 980 }],
  },
  'fr-daurade': {
    fr: [{ size: 1, unit: 'pcs', price: 9.80 }, { size: 1, unit: 'kg', price: 16.50 }],
    en: [{ size: 1, unit: 'kg', price: 15.00 }],
    es: [{ size: 1, unit: 'kg', price: 12.00 }],
    de: [{ size: 1, unit: 'kg', price: 14.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 1380 }],
  },
  'fr-lieu-jaune': {
    fr: [{ size: 300, unit: 'g', price: 5.50 }, { size: 500, unit: 'g', price: 8.80 }],
    en: [{ size: 500, unit: 'g', price: 8.00 }],
    es: [{ size: 500, unit: 'g', price: 6.50 }],
    de: [{ size: 500, unit: 'g', price: 7.80 }],
    ja: [{ size: 300, unit: 'g', price: 780 }],
  },
  'fr-maquereau': {
    fr: [{ size: 500, unit: 'g', price: 5.50 }, { size: 1, unit: 'kg', price: 9.80 }],
    en: [{ size: 1, unit: 'kg', price: 9.00 }],
    es: [{ size: 1, unit: 'kg', price: 7.00 }],
    de: [{ size: 1, unit: 'kg', price: 8.50 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'fr-sole': {
    fr: [{ size: 1, unit: 'pcs', price: 12.50 }, { size: 500, unit: 'g', price: 16.00 }],
    en: [{ size: 500, unit: 'g', price: 14.50 }],
    es: [{ size: 500, unit: 'g', price: 12.00 }],
    de: [{ size: 500, unit: 'g', price: 14.00 }],
    ja: [{ size: 500, unit: 'g', price: 2280 }],
  },
  'fr-truite': {
    fr: [{ size: 1, unit: 'pcs', price: 6.50 }, { size: 500, unit: 'g', price: 8.50 }],
    en: [{ size: 500, unit: 'g', price: 7.80 }],
    es: [{ size: 500, unit: 'g', price: 6.50 }],
    de: [{ size: 500, unit: 'g', price: 7.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 880 }],
  },
  'fr-huitres': {
    // Bourriche 12 huîtres standard
    fr: [{ size: 12, unit: 'pcs', price: 8.50 }, { size: 24, unit: 'pcs', price: 16.00 }],
    en: [{ size: 12, unit: 'pcs', price: 10.00 }],
    es: [{ size: 12, unit: 'pcs', price: 8.00 }],
    de: [{ size: 12, unit: 'pcs', price: 9.50 }],
    ja: [{ size: 12, unit: 'pcs', price: 1480 }],
  },
  'fr-calmar': {
    fr: [{ size: 500, unit: 'g', price: 9.50 }, { size: 1, unit: 'kg', price: 17.00 }],
    en: [{ size: 500, unit: 'g', price: 8.50 }],
    es: [{ size: 500, unit: 'g', price: 7.00 }],
    de: [{ size: 500, unit: 'g', price: 8.80 }],
    ja: [{ size: 500, unit: 'g', price: 880 }],
  },
  'fr-saumon-fume': {
    // Tranches barquette 100-200g
    fr: [{ size: 100, unit: 'g', price: 4.20 }, { size: 200, unit: 'g', price: 7.80 }],
    en: [{ size: 100, unit: 'g', price: 4.00 }],
    es: [{ size: 100, unit: 'g', price: 3.50 }],
    de: [{ size: 100, unit: 'g', price: 4.20 }],
    ja: [{ size: 100, unit: 'g', price: 980 }],
  },
  'fr-truite-fumee': {
    fr: [{ size: 100, unit: 'g', price: 4.50 }, { size: 200, unit: 'g', price: 8.20 }],
    en: [{ size: 100, unit: 'g', price: 4.20 }],
    es: [{ size: 100, unit: 'g', price: 3.80 }],
    de: [{ size: 100, unit: 'g', price: 4.50 }],
    ja: [{ size: 100, unit: 'g', price: 1080 }],
  },

  // ─── FROZEN-MEAT (10 entrées — sous-cat à 0 %) ────────────────────────
  'frz-poulet': {
    // Filet poulet surgelé
    fr: [{ size: 500, unit: 'g', price: 4.80 }, { size: 1, unit: 'kg', price: 8.50 }],
    en: [{ size: 1, unit: 'kg', price: 7.50 }],
    es: [{ size: 1, unit: 'kg', price: 6.50 }],
    de: [{ size: 1, unit: 'kg', price: 7.80 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'frz-cuisses': {
    fr: [{ size: 1, unit: 'kg', price: 5.80 }, { size: 2, unit: 'kg', price: 9.80 }],
    en: [{ size: 1, unit: 'kg', price: 5.20 }],
    es: [{ size: 1, unit: 'kg', price: 4.50 }],
    de: [{ size: 1, unit: 'kg', price: 5.50 }],
    ja: [{ size: 1, unit: 'kg', price: 880 }],
  },
  'frz-escalope': {
    fr: [{ size: 500, unit: 'g', price: 4.80 }, { size: 1, unit: 'kg', price: 8.20 }],
    en: [{ size: 1, unit: 'kg', price: 7.50 }],
    es: [{ size: 1, unit: 'kg', price: 6.20 }],
    de: [{ size: 1, unit: 'kg', price: 7.50 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'frz-nuggets': {
    fr: [{ size: 400, unit: 'g', price: 3.80 }, { size: 600, unit: 'g', price: 5.50 }],
    en: [{ size: 400, unit: 'g', price: 3.50 }],
    es: [{ size: 400, unit: 'g', price: 3.20 }],
    de: [{ size: 400, unit: 'g', price: 3.80 }],
    ja: [{ size: 400, unit: 'g', price: 580 }],
  },
  'frz-cordon-bleu': {
    fr: [{ size: 400, unit: 'g', price: 4.20 }, { size: 800, unit: 'g', price: 7.50 }],
    en: [{ size: 400, unit: 'g', price: 4.00 }],
    es: [{ size: 400, unit: 'g', price: 3.50 }],
    de: [{ size: 400, unit: 'g', price: 4.20 }],
    ja: [{ size: 400, unit: 'g', price: 680 }],
  },
  'frz-boeuf-hache': {
    // Steaks hachés surgelés, pack 10×100g standard
    fr: [{ size: 1, unit: 'kg', price: 7.50 }, { size: 2, unit: 'kg', price: 13.50 }],
    en: [{ size: 1, unit: 'kg', price: 7.00 }],
    es: [{ size: 1, unit: 'kg', price: 5.80 }],
    de: [{ size: 1, unit: 'kg', price: 7.20 }],
    ja: [{ size: 1, unit: 'kg', price: 1280 }],
  },
  'frz-steaks-haches': {
    // Pack 10×100g
    fr: [{ size: 10, unit: 'pcs', price: 7.50 }, { size: 20, unit: 'pcs', price: 13.50 }],
    en: [{ size: 10, unit: 'pcs', price: 7.00 }],
    es: [{ size: 10, unit: 'pcs', price: 6.00 }],
    de: [{ size: 10, unit: 'pcs', price: 7.20 }],
    ja: [{ size: 10, unit: 'pcs', price: 1280 }],
  },
  'frz-saucisses': {
    fr: [{ size: 500, unit: 'g', price: 4.20 }, { size: 1, unit: 'kg', price: 7.50 }],
    en: [{ size: 1, unit: 'kg', price: 6.80 }],
    es: [{ size: 1, unit: 'kg', price: 5.50 }],
    de: [{ size: 1, unit: 'kg', price: 6.50 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'frz-merguez': {
    fr: [{ size: 500, unit: 'g', price: 4.80 }, { size: 1, unit: 'kg', price: 8.50 }],
    en: [{ size: 1, unit: 'kg', price: 7.80 }],
    es: [{ size: 1, unit: 'kg', price: 6.20 }],
    de: [{ size: 1, unit: 'kg', price: 7.50 }],
    ja: [{ size: 500, unit: 'g', price: 780 }],
  },
  'frz-boulettes': {
    fr: [{ size: 500, unit: 'g', price: 4.50 }, { size: 1, unit: 'kg', price: 7.80 }],
    en: [{ size: 1, unit: 'kg', price: 7.20 }],
    es: [{ size: 1, unit: 'kg', price: 5.80 }],
    de: [{ size: 1, unit: 'kg', price: 7.00 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
}
