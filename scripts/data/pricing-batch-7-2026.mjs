/**
 * Lot 7 — enrichissement pricing pour v3.38.0 (Phase E.8).
 *
 * Cible 5 sous-catégories à 0 % de couverture :
 *   - ready-meals (11 entrées — plats préparés surgelés)
 *   - deli (11 entrées — charcuterie classique)
 *   - tofu (11 entrées — variantes japonaises)
 *   - dry (11 entrées — algues / bonite / graines sésame)
 *   - basic (11 entrées — miso / mirin / dashi / sauces japonaises)
 *
 * Sources : référence grande surface FR 2025-2026. Pour les produits
 * japonais (jp-*), les prix sont alignés sur le rayon « Cuisine du monde »
 * en grandes surfaces ; les magasins spécialisés peuvent être un peu moins
 * chers sur les sauces, plus chers sur les algues frais.
 */

export const PRICING_BATCH_7 = {
  // ─── READY-MEALS (11 entrées — sous-cat à 0 %) ────────────────────────
  'frz-chili': {
    fr: [{ size: 300, unit: 'g', price: 3.20 }, { size: 600, unit: 'g', price: 5.50 }],
    en: [{ size: 300, unit: 'g', price: 3.00 }],
    es: [{ size: 300, unit: 'g', price: 2.80 }],
    de: [{ size: 300, unit: 'g', price: 3.20 }],
    ja: [{ size: 300, unit: 'g', price: 580 }],
  },
  'frz-croque': {
    fr: [{ size: 2, unit: 'pcs', price: 2.80 }, { size: 4, unit: 'pcs', price: 4.80 }],
    en: [{ size: 2, unit: 'pcs', price: 2.50 }],
    es: [{ size: 2, unit: 'pcs', price: 2.20 }],
    de: [{ size: 2, unit: 'pcs', price: 2.80 }],
    ja: [{ size: 2, unit: 'pcs', price: 580 }],
  },
  'frz-gratin': {
    fr: [{ size: 400, unit: 'g', price: 3.80 }, { size: 1, unit: 'kg', price: 7.50 }],
    en: [{ size: 400, unit: 'g', price: 3.50 }],
    es: [{ size: 400, unit: 'g', price: 3.00 }],
    de: [{ size: 400, unit: 'g', price: 3.80 }],
    ja: [{ size: 400, unit: 'g', price: 680 }],
  },
  'frz-hachis': {
    fr: [{ size: 300, unit: 'g', price: 3.20 }, { size: 600, unit: 'g', price: 5.50 }],
    en: [{ size: 300, unit: 'g', price: 3.00 }],
    es: [{ size: 300, unit: 'g', price: 2.80 }],
    de: [{ size: 300, unit: 'g', price: 3.20 }],
    ja: [{ size: 300, unit: 'g', price: 580 }],
  },
  'frz-lasagnes': {
    fr: [{ size: 400, unit: 'g', price: 3.80 }, { size: 1, unit: 'kg', price: 7.80 }],
    en: [{ size: 400, unit: 'g', price: 3.50 }],
    es: [{ size: 400, unit: 'g', price: 3.20 }],
    de: [{ size: 400, unit: 'g', price: 3.80 }],
    ja: [{ size: 400, unit: 'g', price: 680 }],
  },
  'frz-pizza': {
    fr: [{ size: 1, unit: 'pcs', price: 3.50 }, { size: 2, unit: 'pcs', price: 6.20 }],
    en: [{ size: 1, unit: 'pcs', price: 3.20 }],
    es: [{ size: 1, unit: 'pcs', price: 2.80 }],
    de: [{ size: 1, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 680 }],
  },
  'frz-poulet-roti': {
    fr: [{ size: 1, unit: 'pcs', price: 6.50 }, { size: 1, unit: 'kg', price: 7.80 }],
    en: [{ size: 1, unit: 'pcs', price: 6.00 }],
    es: [{ size: 1, unit: 'pcs', price: 5.50 }],
    de: [{ size: 1, unit: 'pcs', price: 6.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 1280 }],
  },
  'frz-quiche': {
    fr: [{ size: 1, unit: 'pcs', price: 3.50 }, { size: 400, unit: 'g', price: 3.50 }],
    en: [{ size: 1, unit: 'pcs', price: 3.20 }],
    es: [{ size: 1, unit: 'pcs', price: 2.80 }],
    de: [{ size: 1, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 1, unit: 'pcs', price: 680 }],
  },
  'frz-sole': {
    fr: [{ size: 300, unit: 'g', price: 5.80 }, { size: 600, unit: 'g', price: 10.50 }],
    en: [{ size: 300, unit: 'g', price: 5.50 }],
    es: [{ size: 300, unit: 'g', price: 4.80 }],
    de: [{ size: 300, unit: 'g', price: 5.80 }],
    ja: [{ size: 300, unit: 'g', price: 1180 }],
  },
  'frz-soupe': {
    fr: [{ size: 600, unit: 'g', price: 3.20 }, { size: 1, unit: 'kg', price: 4.80 }],
    en: [{ size: 600, unit: 'g', price: 3.00 }],
    es: [{ size: 600, unit: 'g', price: 2.50 }],
    de: [{ size: 600, unit: 'g', price: 3.00 }],
    ja: [{ size: 600, unit: 'g', price: 580 }],
  },
  'frz-tartiflette': {
    fr: [{ size: 400, unit: 'g', price: 4.20 }, { size: 1, unit: 'kg', price: 9.50 }],
    en: [{ size: 400, unit: 'g', price: 4.00 }],
    es: [{ size: 400, unit: 'g', price: 3.50 }],
    de: [{ size: 400, unit: 'g', price: 4.20 }],
    ja: [{ size: 400, unit: 'g', price: 880 }],
  },

  // ─── DELI (11 entrées) ────────────────────────────────────────────────
  'fr-jambon': {
    // Tranches barquette 4 ou 8
    fr: [{ size: 140, unit: 'g', price: 2.20 }, { size: 280, unit: 'g', price: 4.00 }],
    en: [{ size: 200, unit: 'g', price: 2.80 }],
    es: [{ size: 200, unit: 'g', price: 2.50 }],
    de: [{ size: 200, unit: 'g', price: 2.60 }],
    ja: [{ size: 100, unit: 'g', price: 320 }],
  },
  'fr-mortadelle': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 100, unit: 'g', price: 1.70 }],
    es: [{ size: 100, unit: 'g', price: 1.40 }],
    de: [{ size: 100, unit: 'g', price: 1.80 }],
    ja: [{ size: 100, unit: 'g', price: 380 }],
  },
  'fr-saucisse-seche': {
    fr: [{ size: 200, unit: 'g', price: 3.80 }, { size: 1, unit: 'pcs', price: 3.80 }],
    en: [{ size: 200, unit: 'g', price: 3.50 }],
    es: [{ size: 200, unit: 'g', price: 3.00 }],
    de: [{ size: 200, unit: 'g', price: 3.80 }],
    ja: [{ size: 200, unit: 'g', price: 880 }],
  },
  'fr-chorizo': {
    fr: [{ size: 200, unit: 'g', price: 4.20 }, { size: 1, unit: 'pcs', price: 4.20 }],
    en: [{ size: 200, unit: 'g', price: 4.00 }],
    es: [{ size: 200, unit: 'g', price: 3.20 }],
    de: [{ size: 200, unit: 'g', price: 4.20 }],
    ja: [{ size: 200, unit: 'g', price: 980 }],
  },
  'fr-saucisson': {
    fr: [{ size: 200, unit: 'g', price: 3.80 }, { size: 1, unit: 'pcs', price: 5.50 }],
    en: [{ size: 200, unit: 'g', price: 3.50 }],
    es: [{ size: 200, unit: 'g', price: 3.00 }],
    de: [{ size: 200, unit: 'g', price: 3.80 }],
    ja: [{ size: 200, unit: 'g', price: 880 }],
  },
  'fr-rosette': {
    fr: [{ size: 200, unit: 'g', price: 4.50 }, { size: 1, unit: 'pcs', price: 6.50 }],
    en: [{ size: 200, unit: 'g', price: 4.20 }],
    es: [{ size: 200, unit: 'g', price: 3.80 }],
    de: [{ size: 200, unit: 'g', price: 4.50 }],
    ja: [{ size: 200, unit: 'g', price: 1080 }],
  },
  'fr-andouille': {
    fr: [{ size: 250, unit: 'g', price: 4.50 }, { size: 500, unit: 'g', price: 8.20 }],
    en: [{ size: 250, unit: 'g', price: 4.20 }],
    es: [{ size: 250, unit: 'g', price: 3.50 }],
    de: [{ size: 250, unit: 'g', price: 4.50 }],
    ja: [{ size: 250, unit: 'g', price: 980 }],
  },
  'fr-pate-campagne': {
    fr: [{ size: 200, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 2.60 }],
    es: [{ size: 200, unit: 'g', price: 2.20 }],
    de: [{ size: 200, unit: 'g', price: 2.80 }],
    ja: [{ size: 200, unit: 'g', price: 580 }],
  },
  'fr-rillettes': {
    fr: [{ size: 220, unit: 'g', price: 3.20 }, { size: 350, unit: 'g', price: 4.80 }],
    en: [{ size: 220, unit: 'g', price: 3.00 }],
    es: [{ size: 220, unit: 'g', price: 2.50 }],
    de: [{ size: 220, unit: 'g', price: 3.20 }],
    ja: [{ size: 220, unit: 'g', price: 680 }],
  },
  'fr-terrine': {
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 350, unit: 'g', price: 5.50 }],
    en: [{ size: 200, unit: 'g', price: 3.20 }],
    es: [{ size: 200, unit: 'g', price: 2.80 }],
    de: [{ size: 200, unit: 'g', price: 3.50 }],
    ja: [{ size: 200, unit: 'g', price: 780 }],
  },
  'fr-bavette': {
    // Note : déjà couvert dans batch 4 — on évite de l'écraser, on saute
  },

  // ─── TOFU japonais (11 entrées — sous-cat à 0 %) ──────────────────────
  'jp-tofu': {
    fr: [{ size: 300, unit: 'g', price: 2.50 }, { size: 400, unit: 'g', price: 3.20 }],
    en: [{ size: 300, unit: 'g', price: 2.40 }],
    es: [{ size: 300, unit: 'g', price: 2.20 }],
    de: [{ size: 300, unit: 'g', price: 2.50 }],
    ja: [{ size: 300, unit: 'g', price: 180 }],
  },
  'jp-kimomen-tofu': {
    fr: [{ size: 300, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 3.50 }],
    en: [{ size: 300, unit: 'g', price: 2.60 }],
    es: [{ size: 300, unit: 'g', price: 2.40 }],
    de: [{ size: 300, unit: 'g', price: 2.80 }],
    ja: [{ size: 300, unit: 'g', price: 200 }],
  },
  'jp-kinu-tofu': {
    fr: [{ size: 300, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 3.50 }],
    en: [{ size: 300, unit: 'g', price: 2.60 }],
    es: [{ size: 300, unit: 'g', price: 2.40 }],
    de: [{ size: 300, unit: 'g', price: 2.80 }],
    ja: [{ size: 300, unit: 'g', price: 180 }],
  },
  'jp-atsuage': {
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 1, unit: 'pcs', price: 3.50 }],
    en: [{ size: 200, unit: 'g', price: 3.20 }],
    es: [{ size: 200, unit: 'g', price: 2.80 }],
    de: [{ size: 200, unit: 'g', price: 3.50 }],
    ja: [{ size: 200, unit: 'g', price: 220 }],
  },
  'jp-aburaage': {
    // Pack 3 carrés
    fr: [{ size: 3, unit: 'pcs', price: 2.80 }, { size: 5, unit: 'pcs', price: 4.20 }],
    en: [{ size: 3, unit: 'pcs', price: 2.60 }],
    es: [{ size: 3, unit: 'pcs', price: 2.20 }],
    de: [{ size: 3, unit: 'pcs', price: 2.80 }],
    ja: [{ size: 3, unit: 'pcs', price: 180 }],
  },
  'jp-ganmodoki': {
    fr: [{ size: 4, unit: 'pcs', price: 3.50 }, { size: 6, unit: 'pcs', price: 4.80 }],
    en: [{ size: 4, unit: 'pcs', price: 3.20 }],
    es: [{ size: 4, unit: 'pcs', price: 2.80 }],
    de: [{ size: 4, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 4, unit: 'pcs', price: 280 }],
  },
  'jp-yaki-tofu': {
    fr: [{ size: 300, unit: 'g', price: 3.20 }, { size: 1, unit: 'pcs', price: 3.20 }],
    en: [{ size: 300, unit: 'g', price: 3.00 }],
    es: [{ size: 300, unit: 'g', price: 2.80 }],
    de: [{ size: 300, unit: 'g', price: 3.20 }],
    ja: [{ size: 300, unit: 'g', price: 220 }],
  },
  'jp-kouya-dofu': {
    // Lyophilisé — pack 5 cubes
    fr: [{ size: 5, unit: 'pcs', price: 4.50 }, { size: 80, unit: 'g', price: 4.50 }],
    en: [{ size: 80, unit: 'g', price: 4.20 }],
    es: [{ size: 80, unit: 'g', price: 3.80 }],
    de: [{ size: 80, unit: 'g', price: 4.50 }],
    ja: [{ size: 80, unit: 'g', price: 480 }],
  },
  'jp-natto': {
    fr: [{ size: 3, unit: 'pcs', price: 3.50 }, { size: 150, unit: 'g', price: 3.50 }],
    en: [{ size: 3, unit: 'pcs', price: 3.20 }],
    es: [{ size: 3, unit: 'pcs', price: 2.80 }],
    de: [{ size: 3, unit: 'pcs', price: 3.50 }],
    ja: [{ size: 3, unit: 'pcs', price: 180 }],
  },
  'jp-tonyu': {
    // Lait de soja japonais
    fr: [{ size: 100, unit: 'cl', price: 2.50 }, { size: 600, unit: 'cl', price: 12.50 }],
    en: [{ size: 100, unit: 'cl', price: 2.30 }],
    es: [{ size: 100, unit: 'cl', price: 2.00 }],
    de: [{ size: 100, unit: 'cl', price: 2.50 }],
    ja: [{ size: 100, unit: 'cl', price: 280 }],
  },
  'jp-edamame-fresh': {
    fr: [{ size: 300, unit: 'g', price: 3.50 }, { size: 500, unit: 'g', price: 5.50 }],
    en: [{ size: 300, unit: 'g', price: 3.20 }],
    es: [{ size: 300, unit: 'g', price: 2.80 }],
    de: [{ size: 300, unit: 'g', price: 3.50 }],
    ja: [{ size: 300, unit: 'g', price: 480 }],
  },

  // ─── DRY japonais (11 entrées — sous-cat à 0 %) ───────────────────────
  'jp-algues': {
    fr: [{ size: 30, unit: 'g', price: 4.80 }, { size: 50, unit: 'g', price: 7.20 }],
    en: [{ size: 30, unit: 'g', price: 4.50 }],
    es: [{ size: 30, unit: 'g', price: 4.00 }],
    de: [{ size: 30, unit: 'g', price: 4.80 }],
    ja: [{ size: 30, unit: 'g', price: 480 }],
  },
  'jp-nori': {
    fr: [{ size: 25, unit: 'g', price: 3.20 }, { size: 50, unit: 'g', price: 5.80 }],
    en: [{ size: 25, unit: 'g', price: 3.00 }],
    es: [{ size: 25, unit: 'g', price: 2.50 }],
    de: [{ size: 25, unit: 'g', price: 3.20 }],
    ja: [{ size: 25, unit: 'g', price: 280 }],
  },
  'jp-wakame': {
    fr: [{ size: 30, unit: 'g', price: 3.50 }, { size: 50, unit: 'g', price: 5.50 }],
    en: [{ size: 30, unit: 'g', price: 3.20 }],
    es: [{ size: 30, unit: 'g', price: 2.80 }],
    de: [{ size: 30, unit: 'g', price: 3.50 }],
    ja: [{ size: 30, unit: 'g', price: 380 }],
  },
  'jp-kombu': {
    fr: [{ size: 30, unit: 'g', price: 4.20 }, { size: 50, unit: 'g', price: 6.50 }],
    en: [{ size: 30, unit: 'g', price: 4.00 }],
    es: [{ size: 30, unit: 'g', price: 3.50 }],
    de: [{ size: 30, unit: 'g', price: 4.20 }],
    ja: [{ size: 30, unit: 'g', price: 480 }],
  },
  'jp-katsuobushi': {
    // Bonite séchée — flocons sachet
    fr: [{ size: 30, unit: 'g', price: 4.80 }, { size: 50, unit: 'g', price: 7.20 }],
    en: [{ size: 30, unit: 'g', price: 4.50 }],
    es: [{ size: 30, unit: 'g', price: 4.00 }],
    de: [{ size: 30, unit: 'g', price: 4.80 }],
    ja: [{ size: 30, unit: 'g', price: 380 }],
  },
  'jp-hijiki': {
    fr: [{ size: 30, unit: 'g', price: 4.50 }, { size: 50, unit: 'g', price: 6.80 }],
    en: [{ size: 30, unit: 'g', price: 4.20 }],
    es: [{ size: 30, unit: 'g', price: 3.80 }],
    de: [{ size: 30, unit: 'g', price: 4.50 }],
    ja: [{ size: 30, unit: 'g', price: 480 }],
  },
  'jp-kiriboshi': {
    // Daikon séché
    fr: [{ size: 50, unit: 'g', price: 3.80 }, { size: 100, unit: 'g', price: 6.50 }],
    en: [{ size: 50, unit: 'g', price: 3.50 }],
    es: [{ size: 50, unit: 'g', price: 3.00 }],
    de: [{ size: 50, unit: 'g', price: 3.80 }],
    ja: [{ size: 50, unit: 'g', price: 380 }],
  },
  'jp-goma': {
    fr: [{ size: 100, unit: 'g', price: 2.50 }, { size: 250, unit: 'g', price: 4.80 }],
    en: [{ size: 100, unit: 'g', price: 2.40 }],
    es: [{ size: 100, unit: 'g', price: 2.00 }],
    de: [{ size: 100, unit: 'g', price: 2.50 }],
    ja: [{ size: 100, unit: 'g', price: 280 }],
  },
  'jp-sakura-ebi': {
    fr: [{ size: 30, unit: 'g', price: 5.20 }, { size: 50, unit: 'g', price: 7.80 }],
    en: [{ size: 30, unit: 'g', price: 5.00 }],
    es: [{ size: 30, unit: 'g', price: 4.50 }],
    de: [{ size: 30, unit: 'g', price: 5.20 }],
    ja: [{ size: 30, unit: 'g', price: 580 }],
  },
  'jp-niboshi': {
    fr: [{ size: 50, unit: 'g', price: 4.50 }, { size: 100, unit: 'g', price: 7.50 }],
    en: [{ size: 50, unit: 'g', price: 4.20 }],
    es: [{ size: 50, unit: 'g', price: 3.80 }],
    de: [{ size: 50, unit: 'g', price: 4.50 }],
    ja: [{ size: 50, unit: 'g', price: 480 }],
  },
  'jp-fu': {
    fr: [{ size: 50, unit: 'g', price: 3.20 }, { size: 100, unit: 'g', price: 5.50 }],
    en: [{ size: 50, unit: 'g', price: 3.00 }],
    es: [{ size: 50, unit: 'g', price: 2.50 }],
    de: [{ size: 50, unit: 'g', price: 3.20 }],
    ja: [{ size: 50, unit: 'g', price: 280 }],
  },

  // ─── BASIC japonais (11 entrées — sous-cat à 0 %) ─────────────────────
  'jp-miso': {
    fr: [{ size: 300, unit: 'g', price: 3.80 }, { size: 500, unit: 'g', price: 5.80 }],
    en: [{ size: 300, unit: 'g', price: 3.50 }],
    es: [{ size: 300, unit: 'g', price: 3.20 }],
    de: [{ size: 300, unit: 'g', price: 3.80 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'jp-miso-aka': {
    fr: [{ size: 300, unit: 'g', price: 4.20 }, { size: 500, unit: 'g', price: 6.50 }],
    en: [{ size: 300, unit: 'g', price: 4.00 }],
    es: [{ size: 300, unit: 'g', price: 3.50 }],
    de: [{ size: 300, unit: 'g', price: 4.20 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'jp-miso-shiro': {
    fr: [{ size: 300, unit: 'g', price: 4.20 }, { size: 500, unit: 'g', price: 6.50 }],
    en: [{ size: 300, unit: 'g', price: 4.00 }],
    es: [{ size: 300, unit: 'g', price: 3.50 }],
    de: [{ size: 300, unit: 'g', price: 4.20 }],
    ja: [{ size: 500, unit: 'g', price: 580 }],
  },
  'jp-mirin': {
    fr: [{ size: 250, unit: 'ml', price: 3.50 }, { size: 500, unit: 'ml', price: 5.80 }],
    en: [{ size: 250, unit: 'ml', price: 3.20 }],
    es: [{ size: 250, unit: 'ml', price: 2.80 }],
    de: [{ size: 250, unit: 'ml', price: 3.50 }],
    ja: [{ size: 500, unit: 'ml', price: 480 }],
  },
  'jp-ryorishu': {
    fr: [{ size: 500, unit: 'ml', price: 4.80 }, { size: 750, unit: 'ml', price: 6.80 }],
    en: [{ size: 500, unit: 'ml', price: 4.50 }],
    es: [{ size: 500, unit: 'ml', price: 4.00 }],
    de: [{ size: 500, unit: 'ml', price: 4.80 }],
    ja: [{ size: 500, unit: 'ml', price: 480 }],
  },
  'jp-dashi-pack': {
    // Sachets dashi — boîte de 6 ou 12 sachets
    fr: [{ size: 6, unit: 'pcs', price: 3.80 }, { size: 12, unit: 'pcs', price: 6.80 }],
    en: [{ size: 6, unit: 'pcs', price: 3.50 }],
    es: [{ size: 6, unit: 'pcs', price: 3.00 }],
    de: [{ size: 6, unit: 'pcs', price: 3.80 }],
    ja: [{ size: 12, unit: 'pcs', price: 380 }],
  },
  'jp-mentsuyu': {
    fr: [{ size: 500, unit: 'ml', price: 5.50 }, { size: 1000, unit: 'ml', price: 9.80 }],
    en: [{ size: 500, unit: 'ml', price: 5.20 }],
    es: [{ size: 500, unit: 'ml', price: 4.50 }],
    de: [{ size: 500, unit: 'ml', price: 5.50 }],
    ja: [{ size: 500, unit: 'ml', price: 480 }],
  },
  'jp-ponzu': {
    fr: [{ size: 250, unit: 'ml', price: 4.20 }, { size: 360, unit: 'ml', price: 5.50 }],
    en: [{ size: 250, unit: 'ml', price: 4.00 }],
    es: [{ size: 250, unit: 'ml', price: 3.50 }],
    de: [{ size: 250, unit: 'ml', price: 4.20 }],
    ja: [{ size: 360, unit: 'ml', price: 480 }],
  },
  'jp-shiro-dashi': {
    fr: [{ size: 500, unit: 'ml', price: 6.50 }, { size: 1000, unit: 'ml', price: 11.50 }],
    en: [{ size: 500, unit: 'ml', price: 6.20 }],
    es: [{ size: 500, unit: 'ml', price: 5.50 }],
    de: [{ size: 500, unit: 'ml', price: 6.50 }],
    ja: [{ size: 500, unit: 'ml', price: 580 }],
  },
  'jp-katakuriko': {
    // Fécule de pomme de terre (substitut maïzena pour cuisine japonaise)
    fr: [{ size: 200, unit: 'g', price: 3.20 }, { size: 500, unit: 'g', price: 6.50 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
    es: [{ size: 200, unit: 'g', price: 2.50 }],
    de: [{ size: 200, unit: 'g', price: 3.20 }],
    ja: [{ size: 200, unit: 'g', price: 280 }],
  },
  'jp-usukuchi': {
    // Sauce soja claire japonaise
    fr: [{ size: 500, unit: 'ml', price: 5.20 }, { size: 1000, unit: 'ml', price: 9.50 }],
    en: [{ size: 500, unit: 'ml', price: 5.00 }],
    es: [{ size: 500, unit: 'ml', price: 4.50 }],
    de: [{ size: 500, unit: 'ml', price: 5.20 }],
    ja: [{ size: 500, unit: 'ml', price: 380 }],
  },
}
