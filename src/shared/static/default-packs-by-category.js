// Conditionnements grande surface PAR DÉFAUT, par sous-catégorie.
//
// Utilisé en fallback quand un ingrédient n'a pas de packs spécifiques
// dans `packSizes.js`. L'objectif est que chaque ingrédient de la base
// puisse proposer un set de conditionnements plausible (référence
// grande surface FR 2025-2026), sans tomber sur un mini-form qty/unit libre
// qui produirait des combinaisons absurdes (« 1 pièce de farine »,
// « 1 kg de lait »…).
//
// Les prix sont **indicatifs** (estimations grande surface FR 2025-2026)
// et seront affinés à terme via la feature « admin pricing update »
// (cf. mémoire project_admin_pricing_update.md). Pour des packs
// spécifiques précis, ajoute l'entrée correspondante dans `packSizes.js`.
//
// Convention :
//   - size : nombre, dans l'unité indiquée
//   - unit : 'g' / 'kg' / 'ml' / 'cl' / 'L' / 'pcs' (jamais cs/cc/pincée,
//            cf. mémoire project_basket_supermarket_units_only.md)
//   - price : prix indicatif TTC en € (mode FR)

export const DEFAULT_PACKS_BY_SUBCAT = {
  // ── Fruits & Légumes ──────────────────────────────────────────────
  vegetables: [
    { size: 1,    unit: 'pcs', price: 0.50 },
    { size: 500,  unit: 'g',   price: 1.20 },
    { size: 1,    unit: 'kg',  price: 2.20 },
  ],
  fruits: [
    { size: 1,    unit: 'pcs', price: 0.45 },
    { size: 500,  unit: 'g',   price: 1.50 },
    { size: 1,    unit: 'kg',  price: 2.80 },
  ],
  'tropical-fruits': [
    { size: 1,    unit: 'pcs', price: 1.20 },
    { size: 1,    unit: 'kg',  price: 4.50 },
  ],

  // ── Crémerie & Œufs ───────────────────────────────────────────────
  // Stocké en cl/L cohérent rayon (1L brique, pack 6×1L).
  dairy: [
    { size: 25, unit: 'cl', price: 0.45 },   // mini brique
    { size: 1,  unit: 'L',  price: 1.20 },   // brique standard
    { size: 6,  unit: 'L',  price: 6.30 },   // pack 6 × 1 L
  ],
  cheese: [
    { size: 200,  unit: 'g',   price: 3.50 },
    { size: 250,  unit: 'g',   price: 4.20 },
    { size: 500,  unit: 'g',   price: 7.50 },
  ],
  eggs: [
    { size: 6,    unit: 'pcs', price: 1.80 },
    { size: 10,   unit: 'pcs', price: 2.80 },
    { size: 12,   unit: 'pcs', price: 3.20 },
  ],

  // ── Boucherie & Charcuterie ───────────────────────────────────────
  meat: [
    { size: 250,  unit: 'g',   price: 4.50 },
    { size: 500,  unit: 'g',   price: 8.50 },
    { size: 1,    unit: 'kg',  price: 15.00 },
  ],
  deli: [
    { size: 100,  unit: 'g',   price: 2.50 },
    { size: 200,  unit: 'g',   price: 4.50 },
  ],

  // ── Poissonnerie ──────────────────────────────────────────────────
  fish: [
    { size: 200,  unit: 'g',   price: 5.50 },
    { size: 500,  unit: 'g',   price: 12.00 },
    { size: 1,    unit: 'kg',  price: 22.00 },
  ],

  // ── Bio / Végé ────────────────────────────────────────────────────
  'vegan-proteins': [
    { size: 200,  unit: 'g',   price: 3.50 },
    { size: 400,  unit: 'g',   price: 6.00 },
  ],
  tofu: [
    { size: 200,  unit: 'g',   price: 2.50 },
    { size: 400,  unit: 'g',   price: 4.50 },
  ],

  // ── Boulangerie ───────────────────────────────────────────────────
  // Pain TOUJOURS en pcs (1 pcs = 1 baguette ou 1 paquet/sachet).
  // Le poids n'est jamais utilisé pour le pain (cohérent avec packSizes.js).
  bread: [
    { size: 1, unit: 'pcs', price: 1.10 },   // baguette / pain individuel
    { size: 4, unit: 'pcs', price: 3.50 },   // pack mini-baguettes
  ],

  // ── Épicerie sec ──────────────────────────────────────────────────
  'pasta-rice': [
    { size: 500,  unit: 'g',   price: 1.50 },
    { size: 1,    unit: 'kg',  price: 2.80 },
  ],
  rice: [
    { size: 500,  unit: 'g',   price: 1.80 },
    { size: 1,    unit: 'kg',  price: 3.20 },
  ],
  // Sous-catégorie hétérogène (céréales petit-déj 250g–750g + farines/
  // semoule/Ebly 500g–1kg). En pratique, presque tous les ingrédients de
  // `cereals` ont leurs packs spécifiques dans `packSizes.js` — ce
  // fallback reste pour les rares cas non couverts.
  cereals: [
    { size: 500,  unit: 'g',   price: 2.50 },
    { size: 750,  unit: 'g',   price: 4.20 },
    { size: 1,    unit: 'kg',  price: 4.50 },
  ],
  canned: [
    { size: 200,  unit: 'g',   price: 1.20 },
    { size: 400,  unit: 'g',   price: 2.20 },
    { size: 800,  unit: 'g',   price: 3.80 },
  ],
  'nuts-dried': [
    { size: 100,  unit: 'g',   price: 2.50 },
    { size: 200,  unit: 'g',   price: 4.50 },
    { size: 500,  unit: 'g',   price: 9.50 },
  ],
  sweet: [
    { size: 100,  unit: 'g',   price: 2.20 },
    { size: 250,  unit: 'g',   price: 4.50 },
    { size: 500,  unit: 'g',   price: 8.50 },
  ],
  dry: [
    { size: 250,  unit: 'g',   price: 1.50 },
    { size: 500,  unit: 'g',   price: 2.80 },
    { size: 1,    unit: 'kg',  price: 5.00 },
  ],
  basic: [
    { size: 500,  unit: 'g',   price: 1.20 },
    { size: 1,    unit: 'kg',  price: 2.20 },
  ],

  // ── Condiments & Épices ───────────────────────────────────────────
  'salt-spices': [
    { size: 100,  unit: 'g',   price: 1.50 },
    { size: 250,  unit: 'g',   price: 3.20 },
    { size: 500,  unit: 'g',   price: 5.50 },
  ],
  herbs: [
    { size: 25,   unit: 'g',   price: 1.50 },
    { size: 100,  unit: 'g',   price: 4.50 },
  ],
  sauces: [
    { size: 200,  unit: 'g',   price: 2.20 },
    { size: 500,  unit: 'g',   price: 4.50 },
  ],

  // ── Huiles & Vinaigres ────────────────────────────────────────────
  // 1L stocké en `L` (cohérent rayon).
  oils: [
    { size: 50, unit: 'cl', price: 4.50 },
    { size: 75, unit: 'cl', price: 6.50 },
    { size: 1,  unit: 'L',  price: 8.50 },
  ],

  // ── Surgelés ──────────────────────────────────────────────────────
  'frozen-meat': [
    { size: 400,  unit: 'g',   price: 5.50 },
    { size: 800,  unit: 'g',   price: 9.80 },
  ],
  'frozen-fish': [
    { size: 400,  unit: 'g',   price: 7.50 },
    { size: 800,  unit: 'g',   price: 13.50 },
  ],
  'frozen-veg': [
    { size: 500,  unit: 'g',   price: 2.50 },
    { size: 1,    unit: 'kg',  price: 4.50 },
  ],
  'ready-meals': [
    { size: 1,    unit: 'pcs', price: 4.50 },   // plat individuel
    { size: 2,    unit: 'pcs', price: 7.50 },   // plat à partager
  ],
  // 1L stocké en `L` (cohérent rayon).
  'ice-cream': [
    { size: 50, unit: 'cl', price: 4.50 },   // pot 500 ml
    { size: 1,  unit: 'L',  price: 7.80 },   // pot 1 L
  ],
  // Pain surgelé en 1 pcs (= 1 sachet/paquet), cohérent avec
  // toutes les autres variantes de pain.
  'frozen-bread': [
    { size: 1, unit: 'pcs', price: 3.50 },
  ],

  // ── Fallback générique pour les sous-catégories non listées ──────
  // Sert quand un ingrédient n'a pas de sous-catégorie reconnue ou
  // quand l'arbre INGREDIENTS expose une nouvelle sous-catégorie pas
  // encore documentée ici. Évite de retomber sur un mini-form vrac.
  other: [
    { size: 250,  unit: 'g',   price: 2.00 },
    { size: 500,  unit: 'g',   price: 3.50 },
    { size: 1,    unit: 'kg',  price: 6.00 },
  ],
}

// Renvoie les packs par défaut pour une sous-catégorie d'INGREDIENTS,
// avec fallback sur 'other' si la sous-catégorie n'est pas listée ici.
export function getDefaultPacksFor(subcat) {
  return DEFAULT_PACKS_BY_SUBCAT[subcat] ?? DEFAULT_PACKS_BY_SUBCAT.other
}
