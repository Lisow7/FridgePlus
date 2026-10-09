// Conditionnements vendus en grande surface — pour l'onglet "À acheter" du panier.
//
// Différence avec `prices.js` :
//   • prices.js  → prix au gramme (€/100g). Sert au coût *théorique* d'une recette
//                  (onglet "Détails par recette").
//   • packSizes.js (ce fichier) → liste des packs réellement vendus, avec leur prix
//                  unitaire au pack. Sert au coût *réel* à payer une fois en caisse.
//                  L'optimiseur (`src/lib/packOptimizer.js`) combine les packs pour
//                  couvrir le besoin au prix le plus bas.
//
// Format : { ingredient_id: { lang: [{ size, unit, price }, ...] } }
//   • size : entier, dans `unit` (g pour viande/farine/sec, pcs pour œufs, cl pour
//            liquides éventuellement)
//   • price : prix unitaire pour 1 pack, en euros pour FR et approximation
//             marché EN.
//
// Sources : conventions grandes surfaces FR (référence grande surface FR 2025-2026).
// Adaptations EN = approximations pour démarrer ; à raffiner par lots.
// Ingrédients absents de ce fichier → fallback "achat exact" via prices.js (vrac).
// Ingrédients en pm (sel, herbes) → ne pas mettre, l'UI les skipe.
//
// Sprint 7 PR S7.b — Retrait ES/DE/JA. Fichier réduit de
// 2207 à 1367 lignes (-38 %). Les anciens prix ES/DE/JA étaient des
// approximations non maintenues ; basculer le user sur EN au boot
// donne une expérience plus fiable.

// @deprecated v3.3.13 — Fallback offline uniquement.
// Source de vérité : `ingredients.pack_size` jsonb (cf. supabase/SCHEMA.md).
export const PACK_SIZES = {
  // ── Œufs ────────────────────────────────────────────────────────
  'fr-oeufs-standard': {
    fr: [
      { size:  6, unit: 'pcs', price: 1.80 },
      { size: 10, unit: 'pcs', price: 2.80 },
      { size: 12, unit: 'pcs', price: 3.20 },
    ],
    en: [
      { size:  6, unit: 'pcs', price: 1.50 },
      { size: 12, unit: 'pcs', price: 2.70 },
    ],
  },

  // ── Lait UHT ────────────────────────────────────────────────────
  // Stocké en `L` (cohérent avec ce qu'on lit en rayon).
  // Recalibré RNM FranceAgriMer avril 2026 (+8%).
  'fr-lait-entier': {
    fr: [
      { size: 1, unit: 'L', price: 1.30 }, // brique standard
      { size: 6, unit: 'L', price: 7.20 }, // pack 6×1 L
    ],
    en: [
      { size: 2, unit: 'L', price: 1.40 },
      { size: 4, unit: 'L', price: 2.40 },
    ],
  },

  // ── Beurre doux ────────────────────────────────────────────────
  // Recalibré RNM FranceAgriMer avril 2026 (+23%).
  'fr-beurre': {
    fr: [
      { size: 125, unit: 'g', price: 2.20 },
      { size: 250, unit: 'g', price: 3.40 },
      { size: 500, unit: 'g', price: 6.50 },
    ],
    en: [
      { size: 250, unit: 'g', price: 2.40 },
      { size: 500, unit: 'g', price: 4.50 },
    ],
  },

  // ── Crème liquide ──────────────────────────────────────────────
  'fr-creme-liquide': {
    fr: [
      { size: 20,  unit: 'cl', price: 1.20 },
      { size: 50,  unit: 'cl', price: 2.60 },
    ],
    en: [
      { size: 30,  unit: 'cl', price: 1.50 },
      { size: 60,  unit: 'cl', price: 2.80 },
    ],
  },

  // ── Crème fraîche épaisse ──────────────────────────────────────
  'fr-creme-fraiche': {
    fr: [
      { size: 20,  unit: 'cl', price: 1.40 },
      { size: 40,  unit: 'cl', price: 2.50 },
    ],
    en: [
      { size: 30,  unit: 'cl', price: 1.60 },
    ],
  },

  // ── Gruyère râpé ───────────────────────────────────────────────
  'fr-gruyere': {
    fr: [
      { size: 200, unit: 'g', price: 2.80 },
      { size: 400, unit: 'g', price: 5.20 },
    ],
    en: [
      { size: 200, unit: 'g', price: 2.60 },
    ],
  },

  // ── Mozzarella boule ───────────────────────────────────────────
  'fr-mozzarella': {
    fr: [
      { size: 125, unit: 'g', price: 1.50 },
      { size: 250, unit: 'g', price: 2.80 }, // double pack
    ],
    en: [
      { size: 125, unit: 'g', price: 1.40 },
    ],
  },

  // ── Parmesan ───────────────────────────────────────────────────
  'fr-parmesan': {
    fr: [
      { size:  60, unit: 'g', price: 1.80 }, // pot râpé
      { size: 100, unit: 'g', price: 2.50 },
      { size: 200, unit: 'g', price: 4.40 },
    ],
    en: [
      { size: 100, unit: 'g', price: 2.20 },
      { size: 200, unit: 'g', price: 4.00 },
    ],
  },
  'fr-pecorino': {
    fr: [{ size: 100, unit: 'g', price: 2.50 }, { size: 200, unit: 'g', price: 4.40 }],
    en: [{ size: 100, unit: 'g', price: 2.20 }, { size: 200, unit: 'g', price: 4.00 }],
  },
  'fr-kefalotyri': {
    fr: [{ size: 100, unit: 'g', price: 2.50 }, { size: 200, unit: 'g', price: 4.40 }],
    en: [{ size: 100, unit: 'g', price: 2.20 }, { size: 200, unit: 'g', price: 4.00 }],
  },
  'fr-gorgonzola': {
    fr: [{ size: 150, unit: 'g', price: 3.50 }, { size: 250, unit: 'g', price: 5.50 }],
    en: [{ size: 150, unit: 'g', price: 3.30 }],
  },

  // ── Jambon blanc en tranches ───────────────────────────────────
  'fr-jambon-blanc': {
    fr: [
      { size: 140, unit: 'g', price: 2.20 }, // 4 tranches
      { size: 280, unit: 'g', price: 4.10 }, // 8 tranches
    ],
    en: [
      { size: 200, unit: 'g', price: 2.80 },
    ],
  },

  // ── Lardons ────────────────────────────────────────────────────
  'fr-lardons': {
    fr: [
      { size: 200, unit: 'g', price: 2.20 },
      { size: 400, unit: 'g', price: 4.00 }, // pack double
    ],
    en: [
      { size: 200, unit: 'g', price: 2.00 },
    ],
  },

  // ── Blanc de poulet ────────────────────────────────────────────
  // Recalibré RNM FranceAgriMer avril 2026 (+24%).
  'fr-blanc-poulet': {
    fr: [
      { size:  300, unit: 'g', price: 6.50 },
      { size:  500, unit: 'g', price: 10.50 },
      { size: 1, unit: 'kg', price: 20.00 },
    ],
    en: [
      { size:  500, unit: 'g', price: 7.50 },
      { size: 1, unit: 'kg', price: 14.00 },
    ],
  },

  // ── Poulet entier ──────────────────────────────────────────────
  // Recalibré RNM FranceAgriMer avril 2026 (7,85 €/kg).
  'fr-poulet-entier': {
    fr: [
      { size: 1100, unit: 'g', price: 8.60 },
      { size: 1500, unit: 'g', price: 11.80 },
      { size: 2, unit: 'kg', price: 15.70 },
    ],
    en: [
      { size: 1500, unit: 'g', price: 8.50 },
      { size: 2, unit: 'kg', price: 11.00 },
    ],
  },

  // ── Bœuf haché ─────────────────────────────────────────────────
  'fr-hache-boeuf': {
    fr: [
      { size:  250, unit: 'g', price: 3.00 },
      { size:  500, unit: 'g', price: 5.50 },
      { size: 1, unit: 'kg', price: 10.50 }, // pack 2×500g
    ],
    en: [
      { size:  500, unit: 'g', price: 5.00 },
    ],
  },

  // ── Pâtes : spaghetti ─────────────────────────────────────────
  'gp-spaghetti': {
    fr: [
      { size:  500, unit: 'g', price: 0.95 },
      { size: 1, unit: 'kg', price: 1.70 },
    ],
    en: [
      { size:  500, unit: 'g', price: 0.85 },
    ],
  },

  // ── Pâtes : penne ─────────────────────────────────────────────
  'gp-penne': {
    fr: [
      { size:  500, unit: 'g', price: 0.95 },
      { size: 1, unit: 'kg', price: 1.70 },
    ],
    en: [
      { size:  500, unit: 'g', price: 0.85 },
    ],
  },

  // ── Farine de blé T55 ─────────────────────────────────────────
  'gp-farine-ble': {
    fr: [
      { size: 1, unit: 'kg', price: 0.95 },
      { size: 5, unit: 'kg', price: 4.20 },
    ],
    en: [
      { size: 1500, unit: 'g', price: 1.20 },
    ],
  },

  // ── Sucre en poudre ───────────────────────────────────────────
  'gp-sucre-poudre': {
    fr: [
      { size: 1, unit: 'kg', price: 1.10 },
      { size: 5, unit: 'kg', price: 5.00 },
    ],
    en: [
      { size: 1, unit: 'kg', price: 1.00 },
    ],
  },

  // ── Riz basmati ───────────────────────────────────────────────
  'gp-riz-basmati': {
    fr: [
      { size:  500, unit: 'g', price: 1.40 },
      { size: 1, unit: 'kg', price: 2.50 },
    ],
    en: [
      { size:  500, unit: 'g', price: 1.30 },
      { size: 1, unit: 'kg', price: 2.30 },
    ],
  },

  // ── Tomates pelées en boîte ───────────────────────────────────
  'gp-tomates-pelees': {
    fr: [
      { size:  400, unit: 'g', price: 0.80 },
      { size:  800, unit: 'g', price: 1.40 }, // pack 2×400g
    ],
    en: [
      { size:  400, unit: 'g', price: 0.70 },
    ],
  },

  // ── Huile d'olive extra vierge ────────────────────────────────
  // Format 1L stocké en `L` (cohérent rayon).
  'sp-huile-olive-ex': {
    fr: [
      { size: 50, unit: 'cl', price: 6.50 },
      { size: 75, unit: 'cl', price: 9.00 },
      { size: 1,  unit: 'L',  price: 11.00 },
    ],
    en: [
      { size: 50, unit: 'cl', price: 6.00 },
      { size: 1,  unit: 'L',  price: 10.00 },
    ],
  },

  // ─── Extension v1.2.75 — ~40 ingrédients courants ──────────────────

  // ── Légumes au poids / pièce ───────────────────────────────────────

  'vg-pomme-terre': {
    fr: [{ size: 1, unit: 'kg', price: 1.20 }, { size: 2500, unit: 'g', price: 2.80 }],
    en: [{ size: 2, unit: 'kg', price: 2.20 }],
  },
  'vg-carottes': {
    fr: [{ size:  500, unit: 'g', price: 1.10 }, { size: 1, unit: 'kg', price: 1.80 }],
    en: [{ size: 1, unit: 'kg', price: 1.30 }],
  },
  'vg-oignon': {
    fr: [{ size:  500, unit: 'g', price: 0.90 }, { size: 1, unit: 'kg', price: 1.50 }],
    en: [{ size: 1, unit: 'kg', price: 1.20 }],
  },
  'vg-tomate': {
    fr: [{ size:  500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size: 1, unit: 'kg', price: 3.50 }],
  },
  'vg-tomatillo': {
    fr: [{ size: 250, unit: 'g', price: 2.80 }],
    en: [{ size: 250, unit: 'g', price: 2.50 }],
  },
  'vg-tomate-cerise': {
    fr: [{ size:  250, unit: 'g', price: 2.20 }, { size:  500, unit: 'g', price: 3.80 }],
    en: [{ size:  250, unit: 'g', price: 2.00 }],
  },
  'vg-champignons': {
    fr: [{ size:  250, unit: 'g', price: 1.50 }, { size:  500, unit: 'g', price: 2.60 }],
    en: [{ size:  250, unit: 'g', price: 1.30 }],
  },
  'vg-salade-verte': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }, { size: 2, unit: 'pcs', price: 2.20 }], // pièce ou sachet
    en: [{ size: 1, unit: 'pcs', price: 1.10 }],
  },
  'vg-laitue': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.10 }],
  },
  // Ail vendu à la pièce (1 tête = 1 pcs en rayon). Unité 'tete'
  // n'est pas dans la charte panier (cf. project_basket_supermarket_units_only).
  'vg-ail': {
    fr: [{ size: 1, unit: 'pcs', price: 0.50 }, { size: 3, unit: 'pcs', price: 1.20 }],
    en: [{ size: 1, unit: 'pcs', price: 0.50 }],
  },
  'vg-poireau': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }, { size: 3, unit: 'pcs', price: 3.20 }], // pièce ou botte
    en: [{ size: 2, unit: 'pcs', price: 2.20 }],
  },
  'vg-brocoli': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }],
    en: [{ size: 1, unit: 'pcs', price: 1.60 }],
  },
  'vg-fenouil': {
    fr: [{ size: 1, unit: 'pcs', price: 1.50 }],
    en: [{ size: 1, unit: 'pcs', price: 1.40 }],
  },
  'vg-endives': {
    fr: [{ size:  500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size:  500, unit: 'g', price: 2.00 }],
  },
  'vg-betterave': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }, { size: 4, unit: 'pcs', price: 3.20 }],
    en: [{ size: 4, unit: 'pcs', price: 2.80 }],
  },

  // ── Fruits ────────────────────────────────────────────────────────

  'fr-citron': {
    fr: [{ size: 4, unit: 'pcs', price: 1.60 }, { size: 8, unit: 'pcs', price: 2.80 }],
    en: [{ size: 6, unit: 'pcs', price: 2.40 }],
  },
  'fr-pomme': {
    fr: [{ size: 1, unit: 'kg', price: 2.40 }, { size: 2, unit: 'kg', price: 4.50 }],
    en: [{ size: 1500, unit: 'g', price: 3.20 }],
  },
  'fr-poire': {
    fr: [{ size: 1, unit: 'kg', price: 2.80 }],
    en: [{ size: 1, unit: 'kg', price: 2.60 }],
  },
  'fr-banane': {
    fr: [{ size: 1, unit: 'kg', price: 1.80 }],
    en: [{ size: 1, unit: 'kg', price: 1.60 }],
  },
  'fr-fraise': {
    fr: [{ size:  250, unit: 'g', price: 2.50 }, { size:  500, unit: 'g', price: 4.50 }],
    en: [{ size:  400, unit: 'g', price: 3.50 }],
  },

  // ── Fromages ──────────────────────────────────────────────────────

  'fr-emmental': {
    fr: [{ size: 200, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 2.50 }],
  },
  'fr-comte': {
    fr: [{ size: 200, unit: 'g', price: 4.20 }, { size: 400, unit: 'g', price: 7.80 }],
    en: [{ size: 200, unit: 'g', price: 4.00 }],
  },
  'fr-cheddar': {
    fr: [{ size: 200, unit: 'g', price: 2.80 }],
    en: [{ size: 250, unit: 'g', price: 2.80 }],
  },
  'fr-chevre': {
    fr: [{ size: 100, unit: 'g', price: 2.20 }, { size: 180, unit: 'g', price: 3.50 }], // bûche
    en: [{ size: 150, unit: 'g', price: 2.80 }],
  },
  'fr-feta': {
    fr: [{ size: 150, unit: 'g', price: 2.40 }, { size: 200, unit: 'g', price: 3.10 }],
    en: [{ size: 200, unit: 'g', price: 2.70 }],
  },
  'fr-mascarpone': {
    fr: [{ size: 250, unit: 'g', price: 2.50 }, { size: 500, unit: 'g', price: 4.50 }],
    en: [{ size: 250, unit: 'g', price: 2.30 }],
  },
  'fr-ricotta': {
    fr: [{ size: 250, unit: 'g', price: 1.80 }],
    en: [{ size: 250, unit: 'g', price: 1.70 }],
  },
  'fr-roquefort': {
    fr: [{ size: 100, unit: 'g', price: 2.80 }, { size: 200, unit: 'g', price: 5.20 }],
    en: [{ size: 100, unit: 'g', price: 2.60 }],
  },
  'fr-grana-padano': {
    fr: [{ size: 100, unit: 'g', price: 2.20 }, { size: 200, unit: 'g', price: 4.00 }],
    en: [{ size: 200, unit: 'g', price: 3.80 }],
  },

  // ── Yaourts / laitages ────────────────────────────────────────────

  'fr-yaourt-nature': {
    fr: [
      { size:  4, unit: 'pcs', price: 1.40 },  // pack 4×125g
      { size:  8, unit: 'pcs', price: 2.40 },  // pack 8×125g
      { size: 16, unit: 'pcs', price: 4.20 },  // pack 16×125g
    ],
    en: [{ size: 6, unit: 'pcs', price: 2.20 }],
  },
  'fr-fromage-blanc': {
    fr: [{ size: 500, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 1.70 }],
  },
  'fr-creme-epaisse': {
    fr: [{ size: 20, unit: 'cl', price: 1.50 }, { size: 40, unit: 'cl', price: 2.70 }],
    en: [{ size: 30, unit: 'cl', price: 1.80 }],
  },

  // ── Charcuterie / Poisson ─────────────────────────────────────────

  'fr-bacon': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 250, unit: 'g', price: 3.20 }],
  },
  'fr-jambon-sec': {
    fr: [{ size:  80, unit: 'g', price: 2.50 }, { size: 200, unit: 'g', price: 5.80 }],
    en: [{ size: 100, unit: 'g', price: 3.20 }],
  },
  'fr-jambon': {
    fr: [{ size: 140, unit: 'g', price: 2.20 }, { size: 250, unit: 'g', price: 3.50 }],
    en: [{ size: 125, unit: 'g', price: 2.00 }],
  },
  'fr-chorizo': {
    fr: [{ size: 200, unit: 'g', price: 3.20 }, { size: 300, unit: 'g', price: 4.50 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
  },
  'fr-morcilla': {
    fr: [{ size: 200, unit: 'g', price: 3.20 }, { size: 300, unit: 'g', price: 4.50 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
  },
  'fr-saucisse-fumee': {
    fr: [{ size: 200, unit: 'g', price: 3.20 }, { size: 300, unit: 'g', price: 4.50 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
  },
  'fr-porc-hache': {
    fr: [{ size: 500, unit: 'g', price: 4.50 }, { size: 1, unit: 'kg', price: 8.50 }],
    en: [{ size: 1, unit: 'kg', price: 8.00 }],
  },
  'fr-chair-saucisse': {
    fr: [{ size: 500, unit: 'g', price: 4.50 }, { size: 1, unit: 'kg', price: 8.50 }],
    en: [{ size: 1, unit: 'kg', price: 8.00 }],
  },
  'fr-mortadelle': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 150, unit: 'g', price: 2.00 }],
  },
  'fr-saucisson': {
    fr: [{ size: 100, unit: 'g', price: 2.50 }, { size: 200, unit: 'g', price: 4.50 }],
    en: [{ size: 150, unit: 'g', price: 2.80 }],
  },
  'fr-saumon': {
    fr: [{ size: 250, unit: 'g', price: 7.50 }, { size: 400, unit: 'g', price: 11.50 }], // pavé / filet
    en: [{ size: 400, unit: 'g', price: 10.00 }],
  },
  'fr-thon': {
    fr: [{ size: 140, unit: 'g', price: 2.20 }, { size: 420, unit: 'g', price: 5.80 }], // boîte / lot 3
    en: [{ size: 200, unit: 'g', price: 2.80 }],
  },
  'gp-thon': {
    fr: [{ size: 140, unit: 'g', price: 2.20 }, { size: 420, unit: 'g', price: 5.80 }],
    en: [{ size: 200, unit: 'g', price: 2.80 }],
  },
  'fr-crevettes': {
    fr: [{ size: 200, unit: 'g', price: 5.50 }, { size: 400, unit: 'g', price: 9.80 }],
    en: [{ size: 250, unit: 'g', price: 6.50 }],
  },
  'fr-moules': {
    fr: [{ size: 1, unit: 'kg', price: 4.50 }, { size: 2, unit: 'kg', price: 8.50 }],
    en: [{ size: 1, unit: 'kg', price: 5.00 }],
  },

  // ── Surgelés ──────────────────────────────────────────────────────

  'frz-petits-pois': {
    fr: [{ size: 450, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 3.50 }],
    en: [{ size: 1, unit: 'kg', price: 2.80 }],
  },
  'frz-haricots-v': {
    fr: [{ size: 450, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 4.20 }],
    en: [{ size: 1, unit: 'kg', price: 3.20 }],
  },
  'frz-epinards': {
    fr: [{ size: 450, unit: 'g', price: 2.00 }, { size: 1, unit: 'kg', price: 3.80 }],
    en: [{ size: 1, unit: 'kg', price: 3.00 }],
  },
  'frz-saumon-pave': {
    fr: [{ size: 300, unit: 'g', price: 5.80 }, { size: 500, unit: 'g', price: 9.20 }], // 2×150g / 4×125g
    en: [{ size: 500, unit: 'g', price: 8.50 }],
  },

  // ── Épicerie sec ──────────────────────────────────────────────────

  'gp-couscous': {
    fr: [{ size: 500, unit: 'g', price: 1.20 }, { size: 1, unit: 'kg', price: 2.20 }],
    en: [{ size: 500, unit: 'g', price: 1.10 }],
  },
  'gp-riz-rond': {
    fr: [{ size: 500, unit: 'g', price: 1.20 }, { size: 1, unit: 'kg', price: 2.20 }],
    en: [{ size: 500, unit: 'g', price: 1.10 }],
  },
  'gp-cassonade': {
    fr: [{ size: 500, unit: 'g', price: 1.40 }, { size: 750, unit: 'g', price: 1.90 }, { size: 1, unit: 'kg', price: 2.50 }],
    en: [{ size: 500, unit: 'g', price: 1.30 }],
  },
  'gp-quinoa': {
    fr: [{ size: 500, unit: 'g', price: 3.20 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
  },
  'gp-lentilles': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }, { size: 1, unit: 'kg', price: 4.00 }],
    en: [{ size: 500, unit: 'g', price: 2.00 }],
  },
  'gp-lentilles-coral': {
    fr: [{ size: 500, unit: 'g', price: 2.40 }],
    en: [{ size: 500, unit: 'g', price: 2.20 }],
  },
  'gp-pois-chiches': {
    fr: [{ size: 400, unit: 'g', price: 1.30 }, { size: 800, unit: 'g', price: 2.40 }], // boîte
    en: [{ size: 400, unit: 'g', price: 1.20 }],
  },
  'gp-haricots-bl': {
    fr: [{ size: 400, unit: 'g', price: 1.20 }],
    en: [{ size: 400, unit: 'g', price: 1.10 }],
  },
  'gp-fusilli': {
    fr: [{ size: 500, unit: 'g', price: 0.95 }, { size: 1, unit: 'kg', price: 1.70 }],
    en: [{ size: 500, unit: 'g', price: 0.85 }],
  },
  'gp-coquillettes': {
    fr: [{ size: 500, unit: 'g', price: 0.95 }, { size: 1, unit: 'kg', price: 1.70 }],
    en: [{ size: 500, unit: 'g', price: 0.85 }],
  },
  'gp-tagliatelles': {
    fr: [{ size: 500, unit: 'g', price: 1.20 }],
    en: [{ size: 500, unit: 'g', price: 1.10 }],
  },
  'gp-lasagnes-sec': {
    fr: [{ size: 250, unit: 'g', price: 1.50 }, { size: 500, unit: 'g', price: 2.80 }],
    en: [{ size: 500, unit: 'g', price: 2.50 }],
  },
  'gp-avoine': {
    fr: [{ size: 500, unit: 'g', price: 1.40 }, { size: 1, unit: 'kg', price: 2.50 }],
    en: [{ size: 1, unit: 'kg', price: 2.20 }],
  },

  // ── Pains ─────────────────────────────────────────────────────────

  // Pain vendu à la pièce uniquement (1 pcs = 1 paquet/sachet
  // standard, ~500g pour le pain de mie, ~200-300g pour le pain grillé).
  // Format au poids retiré : en rayon, on prend UN paquet, pas X grammes.
  'gp-pain-mie': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }],
    en: [{ size: 1, unit: 'pcs', price: 1.90 }],
  },
  'gp-pain-grille': {
    fr: [{ size: 1, unit: 'pcs', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 2.00 }],
  },
  // Pain à burger en 1 pcs (= 1 paquet de buns).
  'gp-pain-burger': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }],
    en: [{ size: 1, unit: 'pcs', price: 2.20 }],
  },
  'gp-baguette': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.50 }],
  },

  // ── Sauces / vinaigres / huiles / condiments ──────────────────────

  'sp-vinaigre-bals': {
    fr: [{ size: 25, unit: 'cl', price: 3.50 }, { size: 50, unit: 'cl', price: 5.80 }],
    en: [{ size: 25, unit: 'cl', price: 3.20 }],
  },
  'sp-vinaigre-vin': {
    fr: [{ size: 75, unit: 'cl', price: 1.80 }],
    en: [{ size: 75, unit: 'cl', price: 1.70 }],
  },
  'sp-vinaigre-cidre': {
    fr: [{ size: 75, unit: 'cl', price: 2.20 }],
    en: [{ size: 50, unit: 'cl', price: 1.80 }],
  },
  'sp-sauce-tomate': {
    fr: [{ size: 200, unit: 'g', price: 0.80 }, { size: 400, unit: 'g', price: 1.40 }, { size: 660, unit: 'g', price: 2.20 }],
    en: [{ size: 400, unit: 'g', price: 1.30 }],
  },
  'sp-sauce-soja': {
    fr: [{ size: 15, unit: 'cl', price: 2.20 }, { size: 25, unit: 'cl', price: 3.20 }],
    en: [{ size: 15, unit: 'cl', price: 2.00 }],
  },
  'sp-mayonnaise': {
    fr: [{ size: 235, unit: 'g', price: 1.60 }, { size: 470, unit: 'g', price: 2.80 }, { size: 750, unit: 'g', price: 4.20 }],
    en: [{ size: 400, unit: 'g', price: 2.40 }],
  },
  'sp-moutarde': {
    fr: [{ size: 200, unit: 'g', price: 1.50 }, { size: 350, unit: 'g', price: 2.40 }],
    en: [{ size: 200, unit: 'g', price: 1.40 }],
  },
  'sp-ketchup': {
    fr: [{ size: 320, unit: 'g', price: 1.80 }, { size: 560, unit: 'g', price: 2.80 }],
    en: [{ size: 460, unit: 'g', price: 2.20 }],
  },
  // Bouteilles 1L/2L stockées en `L` (cohérent rayon).
  'sp-huile-tournesol': {
    fr: [{ size: 1, unit: 'L', price: 2.20 }, { size: 2, unit: 'L', price: 4.20 }],
    en: [{ size: 1, unit: 'L', price: 2.00 }],
  },
  'sp-huile-olive-vi': {
    fr: [{ size: 50, unit: 'cl', price: 5.20 }, { size: 75, unit: 'cl', price: 7.50 }, { size: 1, unit: 'L', price: 9.50 }],
    en: [{ size: 75, unit: 'cl', price: 7.00 }],
  },

  // ── Autres épicerie / sucré ───────────────────────────────────────

  'gp-miel': {
    fr: [{ size: 250, unit: 'g', price: 4.50 }, { size: 500, unit: 'g', price: 7.80 }, { size: 1, unit: 'kg', price: 13.50 }],
    en: [{ size: 340, unit: 'g', price: 5.20 }],
  },
  'gp-confiture': {
    fr: [{ size: 370, unit: 'g', price: 2.50 }, { size: 720, unit: 'g', price: 4.20 }],
    en: [{ size: 340, unit: 'g', price: 2.30 }],
  },
  // ── Bouillon cube ─────────────────────────────────────────────────
  // Vendu en boîte de N cubes (~10g chacun). On exprime les packs en
  // pièces (= nombre de cubes) — c'est la vraie unité de vente.
  // Conversion liquide → cube : v3.27.7 introduit `reconstitutes` dans
  // `ingredientUnitHints.js` (1 cube → 100 cl de bouillon). Une recette
  // qui demande 1 L de bouillon ⇒ ceil(100/100) = 1 cube nécessaire.
  'gp-bouillon-cube': {
    fr: [
      { size:  6, unit: 'pcs', price: 0.95 },   // 6 cubes (~60 g)
      { size: 12, unit: 'pcs', price: 1.50 },   // 12 cubes (~120 g)
      { size: 24, unit: 'pcs', price: 2.80 },   // 24 cubes (~240 g)
    ],
    en: [
      { size:  8, unit: 'pcs', price: 1.10 },   // 8 cubes (~80 g)
      { size: 12, unit: 'pcs', price: 1.60 },
    ],
  },
  'gp-concentre-tom': {
    fr: [{ size: 140, unit: 'g', price: 0.80 }, { size: 280, unit: 'g', price: 1.50 }],
    en: [{ size: 200, unit: 'g', price: 1.20 }],
  },
  'gp-lait-coco': {
    fr: [{ size: 40, unit: 'cl', price: 1.80 }, { size: 80, unit: 'cl', price: 3.20 }],
    en: [{ size: 40, unit: 'cl', price: 1.70 }],
  },
  'gp-olives-noires': {
    fr: [{ size: 130, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 2.50 }],
    en: [{ size: 200, unit: 'g', price: 2.30 }],
  },
  'gp-olives-vertes': {
    fr: [{ size: 130, unit: 'g', price: 1.60 }, { size: 200, unit: 'g', price: 2.30 }],
    en: [{ size: 200, unit: 'g', price: 2.10 }],
  },
  'gp-amandes': {
    fr: [{ size: 125, unit: 'g', price: 2.80 }, { size: 250, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 4.00 }],
  },
  'gp-noix': {
    fr: [{ size: 200, unit: 'g', price: 4.20 }, { size: 500, unit: 'g', price: 9.80 }],
    en: [{ size: 250, unit: 'g', price: 5.00 }],
  },
  'gp-cacao-poudre': {
    fr: [{ size: 250, unit: 'g', price: 3.80 }],
    en: [{ size: 250, unit: 'g', price: 3.50 }],
  },
  'gp-choco-noir': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 100, unit: 'g', price: 1.70 }],
  },
  'gp-pepites-choco': {
    fr: [{ size: 100, unit: 'g', price: 1.80 }, { size: 200, unit: 'g', price: 3.20 }],
    en: [{ size: 100, unit: 'g', price: 1.70 }],
  },
  'gp-fecule-mais': {
    fr: [{ size: 250, unit: 'g', price: 1.50 }, { size: 400, unit: 'g', price: 2.20 }],
    en: [{ size: 500, unit: 'g', price: 2.50 }],
  },

  // ── Vanille gousse ────────────────────────────────────────────────
  // Vendue à la pièce. Unité 'gousse' n'est pas dans la charte
  // panier (cf. project_basket_supermarket_units_only).
  'gp-vanille-gousse': {
    fr: [{ size: 1, unit: 'pcs', price: 2.50 }, { size: 2, unit: 'pcs', price: 4.50 }],
    en: [{ size: 2, unit: 'pcs', price: 4.20 }],
  },

  // ── Levure ────────────────────────────────────────────────────────

  'gp-levure': {
    // Levure chimique : sachet typique 11g, vendu en boîte de 5 sachets (55g).
    fr: [{ size: 55, unit: 'g', price: 1.80 }],
    en: [{ size: 55, unit: 'g', price: 1.70 }],
  },

  // ─────────────────────────────────────────────────────────────────
  // Enrichissement staples (farines, sucres, sels, poivres,
  // céréales, café, bicarbonate). Conditionnements approximatifs basés
  // sur référence grande surface FR 2025-2026. Reste de l'approximation
  // — l'objectif est d'être proche de la réalité, pas exhaustif.
  // ─────────────────────────────────────────────────────────────────

  // ── Farine (parent générique = T55 standard) ──────────────────────
  'gp-farine': {
    fr: [
      { size: 1, unit: 'kg', price: 0.95 },
      { size: 5, unit: 'kg', price: 4.20 },
    ],
    en: [{ size: 1500, unit: 'g', price: 1.20 }],
  },

  // ── Farine d'épeautre ─────────────────────────────────────────────
  'gp-farine-epeautre': {
    fr: [
      { size:  500, unit: 'g', price: 2.90 },
      { size: 1, unit: 'kg', price: 4.50 },
    ],
    en: [{ size:  500, unit: 'g', price: 2.60 }],
  },

  // ── Farine de sarrasin ────────────────────────────────────────────
  'gp-farine-sarrasin': {
    fr: [
      { size:  500, unit: 'g', price: 3.20 },
      { size: 1, unit: 'kg', price: 5.40 },
    ],
    en: [{ size:  500, unit: 'g', price: 2.80 }],
  },

  // ── Farine de riz ─────────────────────────────────────────────────
  'gp-farine-riz': {
    fr: [
      { size:  500, unit: 'g', price: 2.50 },
      { size: 1, unit: 'kg', price: 4.20 },
    ],
    en: [{ size:  500, unit: 'g', price: 2.20 }],
  },

  // ── Farine de pois chiche ─────────────────────────────────────────
  'gp-farine-pois-ch': {
    fr: [
      { size:  500, unit: 'g', price: 3.40 },
      { size: 1, unit: 'kg', price: 5.80 },
    ],
    en: [{ size:  500, unit: 'g', price: 3.00 }],
  },

  // ── Sucre (parent générique = blanc en poudre) ────────────────────
  'gp-sucre': {
    fr: [
      { size: 1, unit: 'kg', price: 1.10 },
      { size: 5, unit: 'kg', price: 5.00 },
    ],
    en: [{ size: 1, unit: 'kg', price: 1.00 }],
  },

  // ── Sucre glace ───────────────────────────────────────────────────
  'gp-sucre-glace': {
    fr: [
      { size: 250, unit: 'g', price: 1.40 },
      { size: 500, unit: 'g', price: 2.40 },
    ],
    en: [{ size: 500, unit: 'g', price: 1.90 }],
  },

  // ── Vergeoise ─────────────────────────────────────────────────────
  'gp-vergeoise': {
    fr: [{ size: 500, unit: 'g', price: 2.20 }],
    en: [{ size: 500, unit: 'g', price: 2.10 }],
  },

  // ── Sucre vanillé ─────────────────────────────────────────────────
  'gp-sucre-vanille': {
    // Vendu en boîte de 8 sachets de 7,5g (60g total).
    fr: [{ size: 60, unit: 'g', price: 1.20 }],
    en: [{ size: 60, unit: 'g', price: 1.10 }],
  },

  // ── Sel (parent = sel fin standard) ───────────────────────────────
  'sp-sel': {
    fr: [
      { size:  750, unit: 'g', price: 0.70 },
      { size: 1, unit: 'kg', price: 0.90 },
    ],
    en: [{ size:  750, unit: 'g', price: 0.80 }],
  },

  // ── Sel fin ───────────────────────────────────────────────────────
  'sp-sel-fin': {
    fr: [
      { size:  750, unit: 'g', price: 0.70 },
      { size: 1, unit: 'kg', price: 0.90 },
    ],
    en: [{ size:  750, unit: 'g', price: 0.80 }],
  },

  // ── Sel gros ──────────────────────────────────────────────────────
  'sp-sel-gros': {
    fr: [
      { size: 1, unit: 'kg', price: 0.85 },
      { size: 1500, unit: 'g', price: 1.20 },
    ],
    en: [{ size: 1, unit: 'kg', price: 1.00 }],
  },

  // ── Sel aux herbes ────────────────────────────────────────────────
  'sp-sel-herbes': {
    fr: [
      { size: 200, unit: 'g', price: 2.40 },
      { size: 250, unit: 'g', price: 2.80 },
    ],
    en: [{ size: 250, unit: 'g', price: 2.60 }],
  },

  // ── Fleur de sel ──────────────────────────────────────────────────
  'sp-fleur-sel': {
    fr: [
      { size: 125, unit: 'g', price: 4.20 },
      { size: 250, unit: 'g', price: 7.50 },
    ],
    en: [{ size: 125, unit: 'g', price: 4.50 }],
  },

  // ── Poivre noir (référence ; couvre le parent sp-poivres aussi) ───
  'sp-poivres': {
    // Moulin standard ~50g, recharge ~100g.
    fr: [
      { size:  50, unit: 'g', price: 2.40 },
      { size: 100, unit: 'g', price: 3.80 },
    ],
    en: [{ size:  50, unit: 'g', price: 2.20 }],
  },
  'sp-poivre-noir': {
    fr: [
      { size:  50, unit: 'g', price: 2.40 },
      { size: 100, unit: 'g', price: 3.80 },
    ],
    en: [{ size:  50, unit: 'g', price: 2.20 }],
  },
  'sp-poivre-blanc': {
    fr: [
      { size: 50, unit: 'g', price: 2.80 },
      { size: 80, unit: 'g', price: 4.10 },
    ],
    en: [{ size: 50, unit: 'g', price: 2.50 }],
  },
  'sp-poivre-rose': {
    fr: [
      { size: 30, unit: 'g', price: 3.40 },
      { size: 50, unit: 'g', price: 5.20 },
    ],
    en: [{ size: 30, unit: 'g', price: 3.10 }],
  },
  'sp-poivre-sichuan': {
    fr: [
      { size: 30, unit: 'g', price: 3.80 },
      { size: 50, unit: 'g', price: 5.80 },
    ],
    en: [{ size: 30, unit: 'g', price: 3.50 }],
  },

  // ── Herbes fraîches / séchées ──────────────────────────────────────
  // Ajoutées pour que l'optimiseur puisse calculer un prix à
  // partir des unités-recette (branche, botte, feuille) via gramsPer.
  // Référence grande surface FR 2025-2026 (botte fraîche ou flacon séché).
  'sp-thym': {
    fr: [{ size: 30, unit: 'g', price: 1.80 }],
    en: [{ size: 30, unit: 'g', price: 1.80 }],
  },
  'sp-romarin': {
    fr: [{ size: 30, unit: 'g', price: 1.80 }],
    en: [{ size: 30, unit: 'g', price: 1.80 }],
  },
  'sp-persil': {
    fr: [{ size: 30, unit: 'g', price: 1.50 }],
    en: [{ size: 30, unit: 'g', price: 1.50 }],
  },
  'sp-coriandre': {
    fr: [{ size: 30, unit: 'g', price: 1.80 }],
    en: [{ size: 30, unit: 'g', price: 1.80 }],
  },
  'sp-basilic': {
    fr: [{ size: 25, unit: 'g', price: 2.00 }],
    en: [{ size: 25, unit: 'g', price: 2.20 }],
  },
  'sp-menthe': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 1.80 }],
  },
  'sp-laurier': {
    fr: [{ size: 10, unit: 'g', price: 1.50 }, { size: 20, unit: 'g', price: 2.20 }],
    en: [{ size: 10, unit: 'g', price: 1.50 }],
  },
  'sp-ciboulette': {
    fr: [{ size: 20, unit: 'g', price: 1.50 }],
    en: [{ size: 20, unit: 'g', price: 1.50 }],
  },

  // ── Blé Ebly ──────────────────────────────────────────────────────
  'gp-ble-ebly': {
    // Sachet 500g (Ebly standard), boîte 1kg.
    fr: [
      { size:  500, unit: 'g', price: 2.10 },
      { size: 1, unit: 'kg', price: 3.80 },
    ],
    en: [{ size:  500, unit: 'g', price: 2.00 }],
  },

  // ── Semoule de blé ────────────────────────────────────────────────
  'gp-semoule': {
    fr: [
      { size:  500, unit: 'g', price: 1.30 },
      { size: 1, unit: 'kg', price: 2.20 },
    ],
    en: [{ size:  500, unit: 'g', price: 1.40 }],
  },
  'gp-polenta': {
    fr: [{ size: 500, unit: 'g', price: 1.50 }, { size: 1000, unit: 'g', price: 2.50 }],
    en: [{ size: 500, unit: 'g', price: 1.60 }],
  },
  'gp-farine-mais': {
    fr: [{ size: 500, unit: 'g', price: 1.40 }, { size: 1000, unit: 'g', price: 2.40 }],
    en: [{ size: 500, unit: 'g', price: 1.50 }],
  },

  // ── Maïs soufflé / popcorn ────────────────────────────────────────
  'gp-mais-souffle': {
    // Sachet pop-corn micro-ondes ~100g (×3 souvent), vrac 200g.
    fr: [
      { size: 100, unit: 'g', price: 1.20 },
      { size: 200, unit: 'g', price: 2.10 },
    ],
    en: [{ size: 100, unit: 'g', price: 1.10 }],
  },

  // ── Café (parent = moulu standard) ────────────────────────────────
  'gp-cafe': {
    fr: [
      { size: 250, unit: 'g', price: 4.20 },
      { size: 500, unit: 'g', price: 7.80 },
    ],
    en: [{ size: 250, unit: 'g', price: 4.50 }],
  },
  'gp-the-noir': {
    fr: [{ size: 50, unit: 'g', price: 3.20 }, { size: 100, unit: 'g', price: 5.80 }],
    en: [{ size: 50, unit: 'g', price: 3.50 }],
  },
  'gp-lait-concentre-sucre': {
    fr: [{ size: 397, unit: 'g', price: 1.80 }, { size: 794, unit: 'g', price: 3.40 }],
    en: [{ size: 397, unit: 'g', price: 1.70 }],
  },

  // ── Bicarbonate de soude ──────────────────────────────────────────
  'gp-bicarbonate': {
    fr: [
      { size: 500, unit: 'g', price: 2.40 },
      { size: 800, unit: 'g', price: 3.40 },
    ],
    en: [{ size: 500, unit: 'g', price: 2.20 }],
  },

  // ── Pain (parent générique) ──────────────────────────────────────
  // Vendu à la pièce uniquement (1 pcs = 1 baguette ou 1 paquet).
  'gp-pain': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.50 }],
  },

  // ── Pain complet ──────────────────────────────────────────────────
  'gp-pain-complet': {
    fr: [{ size: 1, unit: 'pcs', price: 2.50 }],
    en: [{ size: 1, unit: 'pcs', price: 2.20 }],
  },

  // ── Pain de seigle ────────────────────────────────────────────────
  'gp-pain-seigle': {
    fr: [{ size: 1, unit: 'pcs', price: 2.80 }],
    en: [{ size: 1, unit: 'pcs', price: 2.50 }],
  },

  // ── Légumes vendus à la pièce ─────────────────────────────────────
  'vg-courgette': {
    fr: [{ size: 1, unit: 'pcs', price: 0.90 }, { size: 500, unit: 'g', price: 1.80 }, { size: 1, unit: 'kg', price: 2.80 }],
    en: [{ size: 1, unit: 'pcs', price: 1.10 }, { size: 1, unit: 'kg', price: 3.20 }],
  },
  'vg-aubergine': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }, { size: 1, unit: 'kg', price: 3.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.30 }, { size: 1, unit: 'kg', price: 3.50 }],
  },
  'vg-poivron': {
    fr: [{ size: 1, unit: 'pcs', price: 1.10 }, { size: 3, unit: 'pcs', price: 2.80 }, { size: 500, unit: 'g', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.00 }, { size: 3, unit: 'pcs', price: 2.50 }],
  },
  'vg-concombre': {
    fr: [{ size: 1, unit: 'pcs', price: 0.95 }],
    en: [{ size: 1, unit: 'pcs', price: 1.10 }],
  },
  'vg-butternut': {
    fr: [{ size: 1, unit: 'pcs', price: 2.80 }, { size: 1, unit: 'kg', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 2.50 }],
  },
  'vg-potimarron': {
    fr: [{ size: 1, unit: 'pcs', price: 3.20 }, { size: 1, unit: 'kg', price: 2.80 }],
    en: [{ size: 1, unit: 'pcs', price: 3.00 }],
  },
  'vg-potiron': {
    fr: [{ size: 1, unit: 'pcs', price: 4.50 }, { size: 1, unit: 'kg', price: 1.80 }],
    en: [{ size: 1, unit: 'pcs', price: 4.20 }],
  },

  // ── Fruits vendus à la pièce ──────────────────────────────────────
  'fr-avocat': {
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }, { size: 4, unit: 'pcs', price: 4.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.30 }, { size: 4, unit: 'pcs', price: 4.50 }],
  },
  'fr-kiwi': {
    fr: [{ size: 1, unit: 'pcs', price: 0.50 }, { size: 6, unit: 'pcs', price: 2.80 }, { size: 1, unit: 'kg', price: 4.20 }],
    en: [{ size: 6, unit: 'pcs', price: 2.50 }, { size: 1, unit: 'kg', price: 3.80 }],
  },
  'fr-mangue': {
    fr: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 1, unit: 'kg', price: 4.50 }],
    en: [{ size: 1, unit: 'pcs', price: 2.00 }],
  },
  'fr-orange': {
    fr: [{ size: 1, unit: 'pcs', price: 0.50 }, { size: 1, unit: 'kg', price: 1.80 }, { size: 2, unit: 'kg', price: 3.20 }],
    en: [{ size: 1, unit: 'kg', price: 2.00 }],
  },
  'fr-pasteque': {
    fr: [{ size: 1, unit: 'pcs', price: 4.50 }, { size: 1, unit: 'kg', price: 1.20 }],
    en: [{ size: 1, unit: 'pcs', price: 4.00 }],
  },
  'fr-melon': {
    fr: [{ size: 1, unit: 'pcs', price: 2.20 }],
    en: [{ size: 1, unit: 'pcs', price: 2.50 }],
  },
  'fr-ananas': {
    fr: [{ size: 1, unit: 'pcs', price: 2.50 }],
    en: [{ size: 1, unit: 'pcs', price: 2.80 }],
  },

  // ── v3.129.1 — Ingrédients manquants utilisés dans les recettes ──────

  // ── Fruits frais ──────────────────────────────────────────────────────
  'fr-abricot': {
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1000, unit: 'g', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 2.80 }],
  },
  'fr-framboise': {
    fr: [{ size: 125, unit: 'g', price: 2.80 }, { size: 250, unit: 'g', price: 4.80 }],
    en: [{ size: 150, unit: 'g', price: 3.00 }],
  },
  'fr-myrtille': {
    fr: [{ size: 125, unit: 'g', price: 3.20 }, { size: 500, unit: 'g', price: 8.50 }],
    en: [{ size: 150, unit: 'g', price: 3.50 }],
  },
  'fr-citron-vert': {
    fr: [{ size: 3, unit: 'pcs', price: 1.30 }, { size: 6, unit: 'pcs', price: 2.20 }],
    en: [{ size: 4, unit: 'pcs', price: 1.50 }],
  },
  'fr-petits-suisses': {
    // Pack 12×60 g — 'g' pour cohérence avec les quantités en recette
    fr: [{ size: 720, unit: 'g', price: 2.40 }],
    en: [{ size: 400, unit: 'g', price: 2.50 }],
  },

  // ── Lait demi-écrémé UHT ──────────────────────────────────────────────
  'fr-lait-demi': {
    fr: [{ size: 1, unit: 'L', price: 1.15 }, { size: 6, unit: 'L', price: 6.50 }],
    en: [{ size: 2, unit: 'L', price: 1.40 }, { size: 4, unit: 'L', price: 2.60 }],
  },

  // ── Viandes fraîches ─────────────────────────────────────────────────
  'fr-bavette': {
    fr: [{ size: 200, unit: 'g', price: 3.90 }, { size: 400, unit: 'g', price: 7.50 }],
    en: [{ size: 200, unit: 'g', price: 4.50 }],
  },
  'fr-entrecote': {
    fr: [{ size: 200, unit: 'g', price: 4.80 }, { size: 250, unit: 'g', price: 5.90 }],
    en: [{ size: 250, unit: 'g', price: 5.50 }],
  },
  'fr-filet-boeuf': {
    fr: [{ size: 200, unit: 'g', price: 8.50 }, { size: 400, unit: 'g', price: 16.00 }],
    en: [{ size: 200, unit: 'g', price: 9.00 }],
  },
  'fr-paleron': {
    fr: [{ size: 400, unit: 'g', price: 4.50 }, { size: 800, unit: 'g', price: 8.50 }],
    en: [{ size: 500, unit: 'g', price: 5.00 }],
  },
  'fr-escalope-veau': {
    // Barquette 2 escalopes ≈ 350 g
    fr: [{ size: 350, unit: 'g', price: 6.90 }, { size: 700, unit: 'g', price: 13.00 }],
    en: [{ size: 400, unit: 'g', price: 7.50 }],
  },
  'fr-jarret-veau': {
    fr: [{ size: 600, unit: 'g', price: 7.50 }, { size: 1200, unit: 'g', price: 14.00 }],
    en: [{ size: 600, unit: 'g', price: 8.00 }],
  },
  'fr-cuisse-poulet': {
    // Barquette 4 cuisses ≈ 700–800 g
    fr: [{ size: 700, unit: 'g', price: 4.50 }, { size: 1400, unit: 'g', price: 8.20 }],
    en: [{ size: 800, unit: 'g', price: 5.00 }],
  },

  // ── Œufs — variantes qualité ─────────────────────────────────────────
  'fr-oeufs-bio': {
    fr: [{ size: 6, unit: 'pcs', price: 3.20 }, { size: 12, unit: 'pcs', price: 5.80 }],
    en: [{ size: 6, unit: 'pcs', price: 3.00 }, { size: 12, unit: 'pcs', price: 5.50 }],
  },
  'fr-oeufs-fermier': {
    fr: [{ size: 6, unit: 'pcs', price: 2.50 }, { size: 12, unit: 'pcs', price: 4.50 }],
    en: [{ size: 6, unit: 'pcs', price: 2.40 }],
  },
  'fr-oeufs-label-r': {
    fr: [{ size: 6, unit: 'pcs', price: 2.20 }, { size: 12, unit: 'pcs', price: 4.00 }],
    en: [{ size: 6, unit: 'pcs', price: 2.00 }],
  },
  'fr-oeufs-plein-air': {
    fr: [{ size: 6, unit: 'pcs', price: 2.00 }, { size: 12, unit: 'pcs', price: 3.60 }],
    en: [{ size: 6, unit: 'pcs', price: 1.90 }],
  },

  // ── Surgelés — manquants ──────────────────────────────────────────────
  'frz-boeuf-hache': {
    fr: [{ size: 500, unit: 'g', price: 5.50 }, { size: 1000, unit: 'g', price: 10.00 }],
    en: [{ size: 500, unit: 'g', price: 6.00 }],
  },
  'frz-steaks-haches': {
    // 4-pack ou 6-pack (5% MG standard)
    fr: [{ size: 4, unit: 'pcs', price: 4.90 }, { size: 6, unit: 'pcs', price: 6.80 }],
    en: [{ size: 4, unit: 'pcs', price: 5.50 }],
  },
  'frz-brocoli': {
    fr: [{ size: 450, unit: 'g', price: 2.00 }, { size: 1000, unit: 'g', price: 3.80 }],
    en: [{ size: 1000, unit: 'g', price: 3.20 }],
  },
  'frz-champignons': {
    fr: [{ size: 300, unit: 'g', price: 2.50 }, { size: 600, unit: 'g', price: 4.50 }],
    en: [{ size: 400, unit: 'g', price: 3.00 }],
  },
  'frz-poivrons': {
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1000, unit: 'g', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 2.80 }],
  },
  'frz-pommes-terre': {
    fr: [{ size: 750, unit: 'g', price: 2.20 }, { size: 1500, unit: 'g', price: 3.80 }],
    en: [{ size: 1000, unit: 'g', price: 3.00 }],
  },
  'frz-pain-hamburger': {
    // 4 pains par lot
    fr: [{ size: 4, unit: 'pcs', price: 2.20 }],
    en: [{ size: 4, unit: 'pcs', price: 2.50 }, { size: 6, unit: 'pcs', price: 3.50 }],
  },
  'frz-sorbet-fraise': {
    fr: [{ size: 500, unit: 'g', price: 3.50 }, { size: 1000, unit: 'g', price: 6.00 }],
    en: [{ size: 500, unit: 'g', price: 4.00 }],
  },
  'frz-thon-steak': {
    fr: [{ size: 300, unit: 'g', price: 7.50 }, { size: 450, unit: 'g', price: 10.50 }],
    en: [{ size: 300, unit: 'g', price: 8.00 }],
  },

  // ── Épicerie sèche — manquants ────────────────────────────────────────
  'gp-biscuits-sale': {
    fr: [{ size: 100, unit: 'g', price: 1.20 }, { size: 200, unit: 'g', price: 2.20 }],
    en: [{ size: 200, unit: 'g', price: 2.00 }],
  },
  'gp-boudoirs': {
    // Biscuits à la cuiller (200g)
    fr: [{ size: 200, unit: 'g', price: 2.50 }],
    en: [{ size: 200, unit: 'g', price: 2.80 }],
  },
  'gp-cacahuetes': {
    fr: [{ size: 200, unit: 'g', price: 2.00 }, { size: 500, unit: 'g', price: 4.50 }],
    en: [{ size: 250, unit: 'g', price: 2.50 }],
  },
  'gp-choco-patissier': {
    // Tablette chocolat noir pâtissier (200g)
    fr: [{ size: 200, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 5.20 }],
    en: [{ size: 200, unit: 'g', price: 3.00 }],
  },
  'gp-citrons-confits': {
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 400, unit: 'g', price: 6.20 }],
    en: [{ size: 200, unit: 'g', price: 3.80 }],
  },
  'gp-crackers': {
    fr: [{ size: 150, unit: 'g', price: 1.80 }, { size: 300, unit: 'g', price: 3.20 }],
    en: [{ size: 200, unit: 'g', price: 2.00 }],
  },
  'gp-croûtons': {
    fr: [{ size: 75, unit: 'g', price: 1.50 }, { size: 150, unit: 'g', price: 2.50 }],
    en: [{ size: 100, unit: 'g', price: 1.80 }],
  },
  'gp-extrait-vanille': {
    // Flacon 50 ml — stocké en cl pour cohérence liquides
    fr: [{ size: 5, unit: 'cl', price: 3.50 }],
    en: [{ size: 5, unit: 'cl', price: 4.00 }],
  },
  'gp-lentilles-vert': {
    fr: [{ size: 500, unit: 'g', price: 2.00 }, { size: 1000, unit: 'g', price: 3.50 }],
    en: [{ size: 500, unit: 'g', price: 2.20 }],
  },
  'gp-noisettes': {
    fr: [{ size: 150, unit: 'g', price: 3.50 }, { size: 200, unit: 'g', price: 4.50 }],
    en: [{ size: 200, unit: 'g', price: 4.00 }],
  },
  'gp-noix-cajou': {
    fr: [{ size: 150, unit: 'g', price: 3.80 }, { size: 250, unit: 'g', price: 5.80 }],
    en: [{ size: 200, unit: 'g', price: 4.50 }],
  },
  'gp-nouilles-asie': {
    // Vermicelles de riz ou nouilles soba (250g)
    fr: [{ size: 250, unit: 'g', price: 2.00 }, { size: 500, unit: 'g', price: 3.50 }],
    en: [{ size: 400, unit: 'g', price: 2.50 }],
  },
  'gp-pate-tamarin': {
    fr: [{ size: 200, unit: 'g', price: 2.80 }],
    en: [{ size: 200, unit: 'g', price: 3.20 }],
  },
  'gp-petits-pois': {
    // Boîte de conserve (poids net égoutté ≈ 400 g)
    fr: [{ size: 400, unit: 'g', price: 1.20 }, { size: 800, unit: 'g', price: 2.10 }],
    en: [{ size: 400, unit: 'g', price: 1.40 }],
  },
  'gp-pignons': {
    fr: [{ size: 50, unit: 'g', price: 3.80 }, { size: 100, unit: 'g', price: 6.50 }],
    en: [{ size: 100, unit: 'g', price: 7.00 }],
  },
  'gp-vin-rouge-cuis': {
    // Vin de cuisine (75 cl)
    fr: [{ size: 75, unit: 'cl', price: 3.50 }],
    en: [{ size: 75, unit: 'cl', price: 4.00 }],
  },
  'gp-vin-blanc-cuis': {
    fr: [{ size: 75, unit: 'cl', price: 3.50 }],
    en: [{ size: 75, unit: 'cl', price: 4.00 }],
  },
  'gp-cognac': {
    fr: [{ size: 35, unit: 'cl', price: 12.00 }, { size: 70, unit: 'cl', price: 22.00 }],
    en: [{ size: 35, unit: 'cl', price: 13.00 }],
  },

  // ── Miso (rayon asiatique) ────────────────────────────────────────────
  'jp-miso': {
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 500, unit: 'g', price: 7.50 }],
    en: [{ size: 300, unit: 'g', price: 4.50 }],
  },
  'jp-miso-aka': {
    // Miso rouge — fermentation longue
    fr: [{ size: 200, unit: 'g', price: 3.80 }, { size: 500, unit: 'g', price: 8.00 }],
    en: [{ size: 300, unit: 'g', price: 5.00 }],
  },
  'jp-miso-shiro': {
    // Miso blanc — doux
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 500, unit: 'g', price: 7.50 }],
    en: [{ size: 300, unit: 'g', price: 4.50 }],
  },

  // ── Épices & condiments — manquants ──────────────────────────────────
  'sp-aneth': {
    fr: [{ size: 20, unit: 'g', price: 1.80 }],
    en: [{ size: 20, unit: 'g', price: 1.80 }],
  },
  'sp-cannelle': {
    fr: [{ size: 40, unit: 'g', price: 2.00 }],
    en: [{ size: 40, unit: 'g', price: 2.20 }],
  },
  'sp-cumin': {
    fr: [{ size: 40, unit: 'g', price: 2.00 }],
    en: [{ size: 40, unit: 'g', price: 2.20 }],
  },
  'sp-curcuma': {
    fr: [{ size: 40, unit: 'g', price: 2.00 }],
    en: [{ size: 40, unit: 'g', price: 2.20 }],
  },
  'sp-curry': {
    fr: [{ size: 40, unit: 'g', price: 2.50 }],
    en: [{ size: 50, unit: 'g', price: 2.80 }],
  },
  'sp-gingembre': {
    // Gingembre moulu (poudre) — rayon épices
    fr: [{ size: 35, unit: 'g', price: 2.20 }],
    en: [{ size: 38, unit: 'g', price: 2.50 }],
  },
  'sp-herbes-prov': {
    fr: [{ size: 40, unit: 'g', price: 2.00 }],
    en: [{ size: 40, unit: 'g', price: 2.20 }],
  },
  'sp-muscade': {
    fr: [{ size: 30, unit: 'g', price: 2.50 }],
    en: [{ size: 30, unit: 'g', price: 2.80 }],
  },
  'sp-nuoc-mam': {
    // Sauce poisson — bouteille 20 cl standard
    fr: [{ size: 20, unit: 'cl', price: 2.50 }, { size: 70, unit: 'cl', price: 7.00 }],
    en: [{ size: 20, unit: 'cl', price: 2.80 }],
  },
  'sp-origan': {
    fr: [{ size: 25, unit: 'g', price: 1.80 }],
    en: [{ size: 25, unit: 'g', price: 2.00 }],
  },
  'sp-paprika': {
    fr: [{ size: 50, unit: 'g', price: 2.20 }],
    en: [{ size: 50, unit: 'g', price: 2.50 }],
  },
  'sp-piment-cayenne': {
    fr: [{ size: 30, unit: 'g', price: 2.00 }],
    en: [{ size: 30, unit: 'g', price: 2.20 }],
  },
  'sp-piment-espelette': {
    fr: [{ size: 40, unit: 'g', price: 4.50 }],
    en: [{ size: 40, unit: 'g', price: 5.00 }],
  },
  'sp-ras-el-hanout': {
    fr: [{ size: 50, unit: 'g', price: 2.80 }],
    en: [{ size: 50, unit: 'g', price: 3.20 }],
  },
  'sp-safran': {
    // Sachet filaments 0,5 g — très faibles quantités en recette
    fr: [{ size: 0.5, unit: 'g', price: 3.50 }],
    en: [{ size: 0.5, unit: 'g', price: 4.50 }],
  },
  'sp-sesame-blanc': {
    fr: [{ size: 100, unit: 'g', price: 2.00 }, { size: 250, unit: 'g', price: 4.20 }],
    en: [{ size: 100, unit: 'g', price: 2.20 }],
  },
  'sp-sesame-noir': {
    fr: [{ size: 100, unit: 'g', price: 2.50 }],
    en: [{ size: 100, unit: 'g', price: 2.80 }],
  },
  'sp-sriracha': {
    fr: [{ size: 250, unit: 'g', price: 3.50 }, { size: 450, unit: 'g', price: 5.80 }],
    en: [{ size: 250, unit: 'g', price: 4.00 }],
  },

  // ── Légumes — manquants ───────────────────────────────────────────────
  'vg-asperges': {
    // Botte 500 g
    fr: [{ size: 500, unit: 'g', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 5.00 }],
  },
  'vg-avocat': {
    fr: [{ size: 1, unit: 'pcs', price: 1.50 }, { size: 3, unit: 'pcs', price: 3.50 }],
    en: [{ size: 1, unit: 'pcs', price: 1.80 }, { size: 3, unit: 'pcs', price: 4.50 }],
  },
  'vg-celeri': {
    // Pied de céleri-branche entier
    fr: [{ size: 1, unit: 'pcs', price: 2.50 }],
    en: [{ size: 1, unit: 'pcs', price: 3.00 }],
  },
  'vg-chou-rouge': {
    fr: [{ size: 1, unit: 'pcs', price: 2.00 }],
    en: [{ size: 1, unit: 'pcs', price: 2.20 }],
  },
  'vg-chou-vert': {
    fr: [{ size: 1, unit: 'pcs', price: 2.00 }],
    en: [{ size: 1, unit: 'pcs', price: 2.20 }],
  },
  'vg-chou-chinois': {
    fr: [{ size: 1, unit: 'pcs', price: 2.00 }],
    en: [{ size: 1, unit: 'pcs', price: 1.80 }],
  },
  'vg-echalote': {
    // Filet 250 g ou 500 g
    fr: [{ size: 250, unit: 'g', price: 1.50 }, { size: 500, unit: 'g', price: 2.80 }],
    en: [{ size: 200, unit: 'g', price: 1.80 }],
  },
  'vg-epinards': {
    // Sachet pousses d'épinards frais
    fr: [{ size: 250, unit: 'g', price: 2.50 }, { size: 500, unit: 'g', price: 4.50 }],
    en: [{ size: 200, unit: 'g', price: 2.80 }],
  },
  'vg-cresson': {
    // Botte ou sachet feuilles de cresson
    fr: [{ size: 1, unit: 'botte', price: 2.50 }, { size: 200, unit: 'g', price: 2.50 }],
    en: [{ size: 200, unit: 'g', price: 2.20 }],
  },
  'vg-germes-soja': {
    fr: [{ size: 200, unit: 'g', price: 1.20 }, { size: 500, unit: 'g', price: 2.50 }],
    en: [{ size: 400, unit: 'g', price: 2.00 }],
  },
  'vg-haricots-v': {
    // Haricots verts frais (filet 500 g ou 1 kg)
    fr: [{ size: 500, unit: 'g', price: 2.80 }, { size: 1000, unit: 'g', price: 5.00 }],
    en: [{ size: 500, unit: 'g', price: 3.00 }],
  },
  'vg-navet': {
    fr: [{ size: 500, unit: 'g', price: 1.50 }, { size: 1000, unit: 'g', price: 2.80 }],
    en: [{ size: 500, unit: 'g', price: 1.80 }],
  },
  'vg-oignon-rouge': {
    fr: [{ size: 500, unit: 'g', price: 1.50 }, { size: 1000, unit: 'g', price: 2.50 }],
    en: [{ size: 500, unit: 'g', price: 1.80 }],
  },
  'vg-oignon-vert': {
    // Botte d'oignons verts (≈ 100 g)
    fr: [{ size: 1, unit: 'pcs', price: 1.00 }],
    en: [{ size: 1, unit: 'pcs', price: 1.20 }],
  },
  'vg-patate-douce': {
    fr: [{ size: 1000, unit: 'g', price: 2.80 }, { size: 1500, unit: 'g', price: 3.90 }],
    en: [{ size: 1000, unit: 'g', price: 3.00 }],
  },
  'vg-radis': {
    // Botte de radis (≈ 200–250 g)
    fr: [{ size: 1, unit: 'pcs', price: 1.20 }],
    en: [{ size: 1, unit: 'pcs', price: 1.50 }],
  },
  'vg-tofu': {
    // Bloc de tofu ferme (250 g ou 400 g)
    fr: [{ size: 250, unit: 'g', price: 2.80 }, { size: 400, unit: 'g', price: 4.20 }],
    en: [{ size: 400, unit: 'g', price: 3.50 }],
  },

  // ── Nouveaux ingrédients PR-B ────────────────────────────────────
  'gp-azuki': {
    fr: [{ size: 500, unit: 'g', price: 2.50 }, { size: 1000, unit: 'g', price: 4.50 }],
    en: [{ size: 500, unit: 'g', price: 2.80 }],
  },
  'gp-haricots-noirs': {
    fr: [{ size: 400, unit: 'g', price: 1.40 }, { size: 800, unit: 'g', price: 2.60 }],
    en: [{ size: 400, unit: 'g', price: 1.30 }],
  },
  'gp-houmous': {
    fr: [{ size: 200, unit: 'g', price: 2.20 }, { size: 400, unit: 'g', price: 3.90 }],
    en: [{ size: 200, unit: 'g', price: 2.00 }],
  },
  'gp-tapioca': {
    fr: [{ size: 400, unit: 'g', price: 2.00 }, { size: 800, unit: 'g', price: 3.50 }],
    en: [{ size: 400, unit: 'g', price: 2.20 }],
  },
  'gp-coco-rapee': {
    fr: [{ size: 200, unit: 'g', price: 2.50 }, { size: 400, unit: 'g', price: 4.50 }],
    en: [{ size: 200, unit: 'g', price: 2.30 }],
  },

  // ── Pâtes/feuilles/pains/nouilles PR-C ────────────────────────────────
  'gp-tortillas-ble': {
    fr: [{ size: 8, unit: 'pcs', price: 2.00 }, { size: 12, unit: 'pcs', price: 2.80 }],
    en: [{ size: 8, unit: 'pcs', price: 2.50 }],
  },
  'gp-pate-filo': {
    fr: [{ size: 250, unit: 'g', price: 2.20 }, { size: 450, unit: 'g', price: 3.80 }],
    en: [{ size: 250, unit: 'g', price: 2.50 }],
  },
  'gp-feuille-brick': {
    fr: [{ size: 200, unit: 'g', price: 2.00 }, { size: 400, unit: 'g', price: 3.50 }],
    en: [{ size: 200, unit: 'g', price: 2.20 }],
  },
  'gp-gnocchi': {
    fr: [{ size: 500, unit: 'g', price: 1.50 }, { size: 1000, unit: 'g', price: 2.80 }],
    en: [{ size: 500, unit: 'g', price: 1.80 }],
  },
  'gp-cannelloni': {
    fr: [{ size: 250, unit: 'g', price: 2.00 }, { size: 500, unit: 'g', price: 3.50 }],
    en: [{ size: 250, unit: 'g', price: 2.20 }],
  },
  'gp-pain-pita': {
    fr: [{ size: 6, unit: 'pcs', price: 1.80 }, { size: 12, unit: 'pcs', price: 3.20 }],
    en: [{ size: 6, unit: 'pcs', price: 2.00 }],
  },
  'gp-chips-tortilla': {
    fr: [{ size: 170, unit: 'g', price: 2.50 }, { size: 400, unit: 'g', price: 4.80 }],
    en: [{ size: 170, unit: 'g', price: 2.80 }],
  },
  'jp-dangmyeon': {
    fr: [{ size: 200, unit: 'g', price: 3.50 }, { size: 500, unit: 'g', price: 7.00 }],
    en: [{ size: 200, unit: 'g', price: 3.20 }],
  },
}
