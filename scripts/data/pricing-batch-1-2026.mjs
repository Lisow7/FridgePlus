/**
 * Lot 1 — enrichissement pricing pour v3.32.0 (Phase E.2).
 *
 * Cible les ingrédients les plus utilisés des sous-catégories les plus
 * exposées identifiées par `npm run pricing:audit` :
 *   - vegetables (46 manquants → on couvre les 17 plus courants)
 *   - salt-spices (30 manquants → 10 épices basiques en pot)
 *   - meat (28 manquants → 10 viandes principales)
 *
 * Sources : référence grande surface FR 2025-2026 (estimations basées sur
 * les conventions grandes surfaces françaises). Reste de l'approximation —
 * affinable à terme via la future UI admin (Phase H).
 *
 * Conventions :
 *   - Légumes vendus à la pièce : `pcs` quand applicable, `kg` en option
 *   - Épices : pots typiques 25-50g (épicerie marque distributeur)
 *   - Viandes : barquettes 300g / 500g / 1kg selon la pièce
 *
 * Format identique à `pricing/2026.json` :
 *   { id: { lang: [{ size, unit, price }, ...] } }
 *
 * Les langues EN/ES/DE/JA sont fournies en approximation (à affiner).
 */

export const PRICING_BATCH_1 = {
  // ─── VEGETABLES (17 entrées) ──────────────────────────────────────────
  'vg-echalote': {
    fr: [{ size: 500, unit: 'g', price: 2.40 }, { size: 1, unit: 'kg', price: 4.20 }],
    en: [{ size: 500, unit: 'g', price: 2.50 }],
    es: [{ size: 500, unit: 'g', price: 2.20 }],
    de: [{ size: 500, unit: 'g', price: 2.40 }],
    ja: [{ size: 200, unit: 'g', price: 380 }],
  },
  'vg-celeri-rave': {
    fr: [{ size: 1, unit: 'pcs', price: 2.20 }, { size: 1, unit: 'kg', price: 1.80 }],
    en: [{ size: 1, unit: 'pcs', price: 2.00 }],
    es: [{ size: 1, unit: 'pcs', price: 1.80 }],
    de: [{ size: 1, unit: 'pcs', price: 2.20 }],
    ja: [{ size: 1, unit: 'pcs', price: 480 }],
  },
  'vg-navet': {
    fr: [{ size: 500, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 1, unit: 'kg', price: 2.80 }],
    es: [{ size: 1, unit: 'kg', price: 2.20 }],
    de: [{ size: 1, unit: 'kg', price: 2.80 }],
    ja: [{ size: 500, unit: 'g', price: 280 }],
  },
  'vg-celeri': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 500, unit: 'g', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.60 }],
    es: [{ size: 1, unit: 'pcs', price: 1.40 }],
    de: [{ size: 1, unit: 'pcs', price: 1.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 380 }],
  },
  'vg-chou-fleur': {
    fr: [{ size: 1, unit: 'pcs', price: 2.50 }, { size: 1, unit: 'kg', price: 2.80 }],
    en: [{ size: 1, unit: 'pcs', price: 2.20 }],
    es: [{ size: 1, unit: 'pcs', price: 1.80 }],
    de: [{ size: 1, unit: 'pcs', price: 2.20 }],
    ja: [{ size: 1, unit: 'pcs', price: 480 }],
  },
  'vg-chou-vert': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 1, unit: 'kg', price: 1.80 }],
    en: [{ size: 1, unit: 'pcs', price: 1.60 }],
    es: [{ size: 1, unit: 'pcs', price: 1.40 }],
    de: [{ size: 1, unit: 'pcs', price: 1.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 380 }],
  },
  'vg-chou-rouge': {
    fr: [{ size: 1, unit: 'pcs', price: 2.20 }, { size: 1, unit: 'kg', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 2.00 }],
    es: [{ size: 1, unit: 'pcs', price: 1.60 }],
    de: [{ size: 1, unit: 'pcs', price: 2.00 }],
    ja: [{ size: 1, unit: 'pcs', price: 420 }],
  },
  'vg-asperges': {
    // Botte ~500g (~25 asperges) en pleine saison.
    fr: [{ size: 1, unit: 'botte', price: 4.50 }, { size: 500, unit: 'g', price: 4.50 }, { size: 1, unit: 'kg', price: 8.00 }],
    en: [{ size: 500, unit: 'g', price: 5.00 }],
    es: [{ size: 500, unit: 'g', price: 4.20 }],
    de: [{ size: 500, unit: 'g', price: 5.50 }],
    ja: [{ size: 1, unit: 'botte', price: 580 }],
  },
  'vg-haricots-v': {
    fr: [{ size: 500, unit: 'g', price: 3.20 }, { size: 1, unit: 'kg', price: 5.80 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
    es: [{ size: 500, unit: 'g', price: 2.40 }],
    de: [{ size: 500, unit: 'g', price: 3.20 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'vg-epinards': {
    fr: [{ size: 250, unit: 'g', price: 2.40 }, { size: 500, unit: 'g', price: 4.20 }],
    en: [{ size: 250, unit: 'g', price: 2.20 }],
    es: [{ size: 500, unit: 'g', price: 3.20 }],
    de: [{ size: 250, unit: 'g', price: 2.40 }],
    ja: [{ size: 200, unit: 'g', price: 280 }],
  },
  'vg-patate-douce': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.50 }, { size: 1, unit: 'kg', price: 2.80 }],
    es: [{ size: 1, unit: 'kg', price: 2.40 }],
    de: [{ size: 1, unit: 'kg', price: 3.20 }],
    ja: [{ size: 1, unit: 'pcs', price: 280 }],
  },
  'vg-oignon-rouge': {
    fr: [{ size: 500, unit: 'g', price: 1.20 }, { size: 1, unit: 'kg', price: 2.20 }],
    en: [{ size: 1, unit: 'kg', price: 1.80 }],
    es: [{ size: 1, unit: 'kg', price: 1.40 }],
    de: [{ size: 1, unit: 'kg', price: 1.80 }],
    ja: [{ size: 500, unit: 'g', price: 280 }],
  },
  'vg-radis': {
    fr: [{ size: 1, unit: 'botte', price: 1.20 }, { size: 250, unit: 'g', price: 1.50 }],
    en: [{ size: 1, unit: 'botte', price: 1.30 }],
    es: [{ size: 1, unit: 'botte', price: 0.95 }],
    de: [{ size: 1, unit: 'botte', price: 1.20 }],
    ja: [{ size: 1, unit: 'botte', price: 220 }],
  },
  'vg-roquette': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 100, unit: 'g', price: 1.80 }],
    es: [{ size: 100, unit: 'g', price: 1.50 }],
    de: [{ size: 100, unit: 'g', price: 1.80 }],
    ja: [{ size: 100, unit: 'g', price: 320 }],
  },
  'vg-mache': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 150, unit: 'g', price: 2.40 }],
    en: [{ size: 100, unit: 'g', price: 1.80 }],
    es: [{ size: 100, unit: 'g', price: 1.50 }],
    de: [{ size: 100, unit: 'g', price: 1.80 }],
    ja: [{ size: 100, unit: 'g', price: 320 }],
  },
  'vg-artichaut': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 4, unit: 'pcs', price: 6.00 }],
    en: [{ size: 1, unit: 'pcs', price: 2.00 }],
    es: [{ size: 1, unit: 'pcs', price: 1.40 }],
    de: [{ size: 1, unit: 'pcs', price: 1.80 }],
    ja: [{ size: 1, unit: 'pcs', price: 380 }],
  },
  'vg-mais-epis': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }, { size: 4, unit: 'pcs', price: 4.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.10 }, { size: 4, unit: 'pcs', price: 3.80 }],
    es: [{ size: 1, unit: 'pcs', price: 0.90 }],
    de: [{ size: 4, unit: 'pcs', price: 4.00 }],
    ja: [{ size: 1, unit: 'pcs', price: 220 }],
  },

  // ─── SALT-SPICES (10 entrées — pots épicerie marque distributeur standards) ───
  'sp-cannelle': {
    fr: [{ size: 30, unit: 'g', price: 1.50 }, { size: 100, unit: 'g', price: 3.80 }],
    en: [{ size: 30, unit: 'g', price: 1.40 }],
    es: [{ size: 30, unit: 'g', price: 1.20 }],
    de: [{ size: 30, unit: 'g', price: 1.50 }],
    ja: [{ size: 30, unit: 'g', price: 380 }],
  },
  'sp-muscade': {
    fr: [{ size: 35, unit: 'g', price: 2.50 }],
    en: [{ size: 35, unit: 'g', price: 2.30 }],
    es: [{ size: 35, unit: 'g', price: 2.00 }],
    de: [{ size: 35, unit: 'g', price: 2.40 }],
    ja: [{ size: 35, unit: 'g', price: 580 }],
  },
  'sp-cumin': {
    fr: [{ size: 35, unit: 'g', price: 1.80 }, { size: 100, unit: 'g', price: 4.20 }],
    en: [{ size: 35, unit: 'g', price: 1.70 }],
    es: [{ size: 35, unit: 'g', price: 1.40 }],
    de: [{ size: 35, unit: 'g', price: 1.80 }],
    ja: [{ size: 35, unit: 'g', price: 380 }],
  },
  'sp-curcuma': {
    fr: [{ size: 35, unit: 'g', price: 1.80 }, { size: 100, unit: 'g', price: 4.20 }],
    en: [{ size: 35, unit: 'g', price: 1.70 }],
    es: [{ size: 35, unit: 'g', price: 1.40 }],
    de: [{ size: 35, unit: 'g', price: 1.80 }],
    ja: [{ size: 35, unit: 'g', price: 380 }],
  },
  'sp-curry': {
    fr: [{ size: 38, unit: 'g', price: 1.50 }, { size: 80, unit: 'g', price: 2.80 }],
    en: [{ size: 38, unit: 'g', price: 1.40 }],
    es: [{ size: 38, unit: 'g', price: 1.20 }],
    de: [{ size: 38, unit: 'g', price: 1.50 }],
    ja: [{ size: 38, unit: 'g', price: 320 }],
  },
  'sp-paprika': {
    fr: [{ size: 40, unit: 'g', price: 1.50 }, { size: 80, unit: 'g', price: 2.80 }],
    en: [{ size: 40, unit: 'g', price: 1.40 }],
    es: [{ size: 40, unit: 'g', price: 1.20 }],
    de: [{ size: 40, unit: 'g', price: 1.50 }],
    ja: [{ size: 40, unit: 'g', price: 320 }],
  },
  'sp-gingembre': {
    fr: [{ size: 30, unit: 'g', price: 2.20 }, { size: 70, unit: 'g', price: 3.80 }],
    en: [{ size: 30, unit: 'g', price: 2.00 }],
    es: [{ size: 30, unit: 'g', price: 1.80 }],
    de: [{ size: 30, unit: 'g', price: 2.20 }],
    ja: [{ size: 30, unit: 'g', price: 480 }],
  },
  'sp-piment-espelette': {
    fr: [{ size: 25, unit: 'g', price: 3.50 }, { size: 40, unit: 'g', price: 5.20 }],
    en: [{ size: 25, unit: 'g', price: 3.20 }],
    es: [{ size: 25, unit: 'g', price: 2.80 }],
    de: [{ size: 25, unit: 'g', price: 3.50 }],
    ja: [{ size: 25, unit: 'g', price: 720 }],
  },
  'sp-sesame-blanc': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 250, unit: 'g', price: 3.50 }],
    en: [{ size: 100, unit: 'g', price: 1.70 }],
    es: [{ size: 100, unit: 'g', price: 1.40 }],
    de: [{ size: 100, unit: 'g', price: 1.80 }],
    ja: [{ size: 100, unit: 'g', price: 280 }],
  },
  'sp-anis-etoile': {
    fr: [{ size: 25, unit: 'g', price: 3.20 }, { size: 50, unit: 'g', price: 5.40 }],
    en: [{ size: 25, unit: 'g', price: 3.00 }],
    es: [{ size: 25, unit: 'g', price: 2.50 }],
    de: [{ size: 25, unit: 'g', price: 3.20 }],
    ja: [{ size: 25, unit: 'g', price: 580 }], // 八角 — courant
  },

  // ─── MEAT (10 entrées — barquettes grande surface FR standards) ──────
  'fr-poulet': {
    // Parent générique : escalope par défaut
    fr: [{ size: 300, unit: 'g', price: 5.40 }, { size: 500, unit: 'g', price: 8.50 }, { size: 1000, unit: 'g', price: 16.00 }],
    en: [{ size: 500, unit: 'g', price: 7.50 }],
    es: [{ size: 500, unit: 'g', price: 6.50 }],
    de: [{ size: 500, unit: 'g', price: 7.80 }],
    ja: [{ size: 300, unit: 'g', price: 750 }],
  },
  'fr-cuisse-poulet': {
    fr: [{ size: 500, unit: 'g', price: 3.80 }, { size: 1, unit: 'kg', price: 6.80 }],
    en: [{ size: 1, unit: 'kg', price: 6.00 }],
    es: [{ size: 1, unit: 'kg', price: 5.50 }],
    de: [{ size: 1, unit: 'kg', price: 6.50 }],
    ja: [{ size: 500, unit: 'g', price: 480 }],
  },
  'fr-cote-porc': {
    fr: [{ size: 500, unit: 'g', price: 5.50 }, { size: 1, unit: 'kg', price: 9.80 }],
    en: [{ size: 1, unit: 'kg', price: 9.00 }],
    es: [{ size: 1, unit: 'kg', price: 7.50 }],
    de: [{ size: 1, unit: 'kg', price: 8.50 }],
    ja: [{ size: 500, unit: 'g', price: 680 }],
  },
  'fr-filet-porc': {
    fr: [{ size: 500, unit: 'g', price: 9.50 }, { size: 1, unit: 'kg', price: 17.00 }],
    en: [{ size: 1, unit: 'kg', price: 14.00 }],
    es: [{ size: 1, unit: 'kg', price: 12.00 }],
    de: [{ size: 1, unit: 'kg', price: 15.00 }],
    ja: [{ size: 500, unit: 'g', price: 980 }],
  },
  'fr-escalope-veau': {
    fr: [{ size: 300, unit: 'g', price: 9.80 }, { size: 500, unit: 'g', price: 15.50 }],
    en: [{ size: 500, unit: 'g', price: 14.00 }],
    es: [{ size: 500, unit: 'g', price: 11.00 }],
    de: [{ size: 500, unit: 'g', price: 14.50 }],
    ja: [{ size: 300, unit: 'g', price: 1280 }],
  },
  'fr-magret': {
    // Pièce typique 350-400g.
    fr: [{ size: 350, unit: 'g', price: 9.80 }, { size: 1, unit: 'pcs', price: 9.80 }],
    en: [{ size: 350, unit: 'g', price: 9.50 }],
    es: [{ size: 350, unit: 'g', price: 8.20 }],
    de: [{ size: 350, unit: 'g', price: 9.80 }],
    ja: [{ size: 350, unit: 'g', price: 1480 }],
  },
  'fr-cote-agneau': {
    fr: [{ size: 500, unit: 'g', price: 12.50 }, { size: 1, unit: 'kg', price: 22.00 }],
    en: [{ size: 1, unit: 'kg', price: 18.00 }],
    es: [{ size: 1, unit: 'kg', price: 16.00 }],
    de: [{ size: 1, unit: 'kg', price: 19.00 }],
    ja: [{ size: 500, unit: 'g', price: 1380 }],
  },
  'fr-gigot': {
    fr: [{ size: 1500, unit: 'g', price: 27.00 }, { size: 2, unit: 'kg', price: 36.00 }],
    en: [{ size: 1500, unit: 'g', price: 24.00 }],
    es: [{ size: 1500, unit: 'g', price: 22.00 }],
    de: [{ size: 1500, unit: 'g', price: 25.00 }],
    ja: [{ size: 1500, unit: 'g', price: 4200 }],
  },
  'fr-dinde': {
    // Escalope dinde
    fr: [{ size: 500, unit: 'g', price: 6.50 }, { size: 1, unit: 'kg', price: 11.00 }],
    en: [{ size: 500, unit: 'g', price: 6.00 }],
    es: [{ size: 500, unit: 'g', price: 5.50 }],
    de: [{ size: 500, unit: 'g', price: 6.20 }],
    ja: [{ size: 500, unit: 'g', price: 780 }],
  },
  'fr-foie-volaille': {
    fr: [{ size: 250, unit: 'g', price: 2.20 }, { size: 500, unit: 'g', price: 4.00 }],
    en: [{ size: 500, unit: 'g', price: 3.50 }],
    es: [{ size: 500, unit: 'g', price: 3.00 }],
    de: [{ size: 500, unit: 'g', price: 3.50 }],
    ja: [{ size: 250, unit: 'g', price: 380 }],
  },
}
