/**
 * Lot 10 — enrichissement pricing pour v3.41.0 (Phase E.11 — vraiment final).
 *
 * Mini-batch ciblé sur les **derniers ingrédients réels achetables** parmi
 * les manquants. Volontairement court (12 entrées) pour éviter d'inventer
 * des prix sur des sous-cat parents abstraites (`vg-alliums`, `fr-baies`,
 * `gp-poissons-cons`, etc.) qui ne sont pas des produits achetables mais
 * des regroupements taxonomiques.
 *
 * Sources : référence grande surface FR 2025-2026.
 *
 * Après ce lot, le reste (~80 entrées) est constitué de :
 *   - Sous-catégories parents abstraites (ex: `vg-alliums`, `vg-racines`)
 *     → non achetables individuellement, fallback subcat suffit
 *   - Variantes très spécialisées (ex: marques précises)
 *     → à traiter au cas par cas via la future UI admin (Phase H)
 */

export const PRICING_BATCH_10 = {
  // ─── SWEET (4 entrées — confiseries courantes) ────────────────────────
  'gp-bonbons': {
    fr: [{ size: 150, unit: 'g', price: 1.80 }, { size: 300, unit: 'g', price: 3.20 }],
    en: [{ size: 150, unit: 'g', price: 1.70 }],
    es: [{ size: 150, unit: 'g', price: 1.50 }],
    de: [{ size: 150, unit: 'g', price: 1.80 }],
    ja: [{ size: 150, unit: 'g', price: 380 }],
  },
  'gp-boudoirs': {
    fr: [{ size: 175, unit: 'g', price: 1.50 }, { size: 350, unit: 'g', price: 2.80 }],
    en: [{ size: 175, unit: 'g', price: 1.40 }],
    es: [{ size: 175, unit: 'g', price: 1.20 }],
    de: [{ size: 175, unit: 'g', price: 1.50 }],
    ja: [{ size: 175, unit: 'g', price: 380 }],
  },
  'gp-caramel': {
    // Caramels mous sachet
    fr: [{ size: 150, unit: 'g', price: 2.20 }, { size: 250, unit: 'g', price: 3.50 }],
    en: [{ size: 150, unit: 'g', price: 2.00 }],
    es: [{ size: 150, unit: 'g', price: 1.80 }],
    de: [{ size: 150, unit: 'g', price: 2.20 }],
    ja: [{ size: 150, unit: 'g', price: 480 }],
  },
  'gp-guimauves': {
    fr: [{ size: 200, unit: 'g', price: 2.20 }, { size: 400, unit: 'g', price: 3.80 }],
    en: [{ size: 200, unit: 'g', price: 2.00 }],
    es: [{ size: 200, unit: 'g', price: 1.80 }],
    de: [{ size: 200, unit: 'g', price: 2.20 }],
    ja: [{ size: 200, unit: 'g', price: 480 }],
  },

  // ─── FRUITS (2 entrées — saison/exotique) ─────────────────────────────
  'fr-groseille': {
    fr: [{ size: 125, unit: 'g', price: 3.20 }, { size: 250, unit: 'g', price: 5.50 }],
    en: [{ size: 125, unit: 'g', price: 3.00 }],
    es: [{ size: 125, unit: 'g', price: 2.50 }],
    de: [{ size: 125, unit: 'g', price: 3.00 }],
    ja: [{ size: 125, unit: 'g', price: 680 }],
  },
  'fr-jackfruit': {
    // Frais (rare en magasin standard, conserve plus courante)
    fr: [{ size: 1, unit: 'kg', price: 8.50 }],
    en: [{ size: 1, unit: 'kg', price: 8.00 }],
    es: [{ size: 1, unit: 'kg', price: 6.50 }],
    de: [{ size: 1, unit: 'kg', price: 8.50 }],
    ja: [{ size: 1, unit: 'kg', price: 1480 }],
  },

  // ─── BREAD (4 entrées — biscuits salés et viennoiseries fraîches) ─────
  'gp-biscuits-sale': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 100, unit: 'g', price: 1.70 }],
    es: [{ size: 100, unit: 'g', price: 1.50 }],
    de: [{ size: 100, unit: 'g', price: 1.80 }],
    ja: [{ size: 100, unit: 'g', price: 380 }],
  },
  'gp-panko': {
    fr: [{ size: 200, unit: 'g', price: 2.50 }, { size: 500, unit: 'g', price: 4.80 }],
    en: [{ size: 200, unit: 'g', price: 2.40 }],
    es: [{ size: 200, unit: 'g', price: 2.00 }],
    de: [{ size: 200, unit: 'g', price: 2.50 }],
    ja: [{ size: 200, unit: 'g', price: 280 }],
  },
  'gp-croûtons': {
    fr: [{ size: 100, unit: 'g', price: 1.50 }, { size: 200, unit: 'g', price: 2.50 }],
    en: [{ size: 100, unit: 'g', price: 1.40 }],
    es: [{ size: 100, unit: 'g', price: 1.20 }],
    de: [{ size: 100, unit: 'g', price: 1.50 }],
    ja: [{ size: 100, unit: 'g', price: 320 }],
  },
  'gp-brioche-fraiche': {
    fr: [{ size: 500, unit: 'g', price: 3.20 }, { size: 1, unit: 'pcs', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
    es: [{ size: 500, unit: 'g', price: 2.50 }],
    de: [{ size: 500, unit: 'g', price: 3.20 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },

  // ─── CANNED (1 entrée — pâte de curry restante) ───────────────────────
  'gp-pate-curry-jaune': {
    fr: [{ size: 110, unit: 'g', price: 2.50 }, { size: 220, unit: 'g', price: 4.20 }],
    en: [{ size: 110, unit: 'g', price: 2.20 }],
    es: [{ size: 110, unit: 'g', price: 2.00 }],
    de: [{ size: 110, unit: 'g', price: 2.40 }],
    ja: [{ size: 110, unit: 'g', price: 480 }],
  },
}
