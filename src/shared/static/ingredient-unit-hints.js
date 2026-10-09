// Suggestions d'unités de mesure adaptées par ingrédient.
//
// Sources : conventions cuisine française (YouSchool CAP cuisine,
// pâtisserie Dumontweb, Comment Économiser), Wikipedia "Cooking weights
// and measures". Valeurs `gramsPer` indicatives (médiane des sources).
//
// Stratégie : override spécifique > préfixe par défaut > fallback global.
// `defaultUnit` = unité pré-sélectionnée à l'ajout d'ingrédient dans la recette.
// `altUnits` = autres options proposées en priorité (l'utilisateur peut quand même
// piocher dans la liste complète des WEIGHT_UNITS).
// `gramsPer` = équivalence en grammes pour `toGrams()` (calcul du coût panier).
// `reconstitutes` (v3.27.7) = pour les ingrédients concentrés/en pièce qui
//   produisent une quantité X de l'ingrédient réel utilisé en cuisine. Permet
//   au panier de convertir un besoin volumique/massique vers le bon nombre de
//   packs. Format : { [packUnit]: { amount, unit } } — « 1 packUnit produit
//   `amount` `unit` reconstitués ». Ex: bouillon cube → 1 cube produit 100 cl
//   de bouillon ; concentré de tomates → 1 g de concentré ≈ 2.85 g de coulis.

const FALLBACK = { defaultUnit: 'g', altUnits: ['kg','unité'] }

// 1) Defaults par préfixe d'ID — joue quand aucun override spécifique
//    Note : 'fr-' regroupe viande, poisson, dairy, fruits ET œufs ; on
//    distingue les fruits à pièce et les œufs via les overrides spécifiques.
const PREFIX_DEFAULTS = {
  'sp-':  { defaultUnit: 'cc',     altUnits: ['cs','pincée','g'] },
  'vg-':  { defaultUnit: 'g',      altUnits: ['kg','unité'] },
  'fr-':  { defaultUnit: 'g',      altUnits: ['kg','unité'] },
  'frz-': { defaultUnit: 'g',      altUnits: ['kg','unité'] },
  'gp-':  { defaultUnit: 'g',      altUnits: ['kg','sachet'] },
  'jp-':  { defaultUnit: 'g',      altUnits: ['kg'] },
  'bk-':  { defaultUnit: 'g',      altUnits: ['kg','tranche'] },
}

// 2) Overrides par ingrédient (lot 1 — ~20 entrées emblématiques)
const SPECIFIC = {
  // ── Ail : gousse par défaut, tête pour grosse quantité ──────────────────
  // reconstitutes : 1 tête d'ail (= 1 pcs en rayon) ≈ 10 gousses.
  // Permet à l'optimiseur de convertir "4 gousses" → "1 pcs" avec son prix.
  'vg-ail':         { defaultUnit: 'gousse',  altUnits: ['tete','g'],
                      gramsPer: { gousse: 5, tete: 50 },
                      reconstitutes: { pcs: { amount: 10, unit: 'gousse' } } },

  // ── Herbes fraîches ────────────────────────────────────────────────────
  'sp-thym':        { defaultUnit: 'branche', altUnits: ['botte','g'],
                      gramsPer: { branche: 1, botte: 20 } },
  'sp-romarin':     { defaultUnit: 'branche', altUnits: ['botte','g'],
                      gramsPer: { branche: 2, botte: 25 } },
  'sp-persil':      { defaultUnit: 'botte',   altUnits: ['branche','g','cs'],
                      gramsPer: { branche: 1, botte: 30 } },
  'sp-coriandre':   { defaultUnit: 'botte',   altUnits: ['branche','g'],
                      gramsPer: { branche: 1, botte: 30 } },
  'sp-basilic':     { defaultUnit: 'feuille', altUnits: ['botte','g'],
                      gramsPer: { feuille: 0.5, botte: 30 } },
  'sp-menthe':      { defaultUnit: 'feuille', altUnits: ['botte','g'],
                      gramsPer: { feuille: 0.5, botte: 25 } },
  'sp-laurier':     { defaultUnit: 'feuille', altUnits: ['g'],
                      gramsPer: { feuille: 0.2 } },
  'sp-ciboulette':  { defaultUnit: 'botte',   altUnits: ['g'],
                      gramsPer: { botte: 20 } },

  // ── Sel / poivre / aromates de finition ───────────────────────────────
  'sp-sel-fin':     { defaultUnit: 'pincée',  altUnits: ['cc','g','PM'],
                      gramsPer: { 'pincée': 1, cc: 6, cs: 18 } },
  'sp-sel-gros':    { defaultUnit: 'pincée',  altUnits: ['cc','g','PM'],
                      gramsPer: { 'pincée': 1.5, cc: 7 } },
  'sp-fleur-sel':   { defaultUnit: 'pincée',  altUnits: ['cc','g','PM'],
                      gramsPer: { 'pincée': 0.8 } },
  'sp-poivre-noir': { defaultUnit: 'pincée',  altUnits: ['cc','g','PM'],
                      gramsPer: { 'pincée': 0.4, cc: 2 } },
  'sp-poivre-blanc':{ defaultUnit: 'pincée',  altUnits: ['cc','g','PM'],
                      gramsPer: { 'pincée': 0.4, cc: 2 } },

  // ── Levures / sucres particuliers : sachet par défaut ──────────────────
  'gp-levure':       { defaultUnit: 'sachet', altUnits: ['g'],
                       gramsPer: { sachet: 11 } },
  'gp-levure-boul':  { defaultUnit: 'sachet', altUnits: ['g'],
                       gramsPer: { sachet: 7 } },
  'gp-levure-seche': { defaultUnit: 'sachet', altUnits: ['g'],
                       gramsPer: { sachet: 7 } },
  'gp-sucre-vanille':{ defaultUnit: 'sachet', altUnits: ['g'],
                       gramsPer: { sachet: 7.5 } },
  'gp-bicarbonate':  { defaultUnit: 'cc',     altUnits: ['g','sachet'],
                       gramsPer: { cc: 5, sachet: 5 } },

  // ── Vanille gousse ─────────────────────────────────────────────────────
  // reconstitutes : 1 pcs vendu en rayon = 1 gousse.
  'gp-vanille-gousse': { defaultUnit: 'gousse', altUnits: ['g'],
                         gramsPer: { gousse: 3 },
                         reconstitutes: { pcs: { amount: 1, unit: 'gousse' } } },

  // ── Fromage en tranches (chèvre, bûche en rondelles) ──────────────────
  'fr-chevre':       { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 25 } },
  'fr-feta':         { defaultUnit: 'g',       altUnits: ['kg'],
                       gramsPer: { tranche: 30 } }, // si jamais utilisée en tranche

  // ── Œufs : toujours à l'unité (parent + variantes) ─────────────────────
  'fr-oeuf':         { defaultUnit: 'unité',  altUnits: ['unité'],
                       gramsPer: { 'unité': 50 } },

  // ── Légumes typiquement comptés à la pièce ─────────────────────────────
  'vg-tomate':       { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 120 } },
  'vg-tomatillo':    { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 60 } },
  'vg-chou-chinois': { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 1000 } },
  'vg-oignon':       { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 110 } },
  'vg-carottes':     { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 80 } },
  'vg-courgette':    { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 200 } },
  'vg-aubergine':    { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 250 } },
  'vg-poivron':      { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 150 } },
  'vg-pomme-terre':  { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 150 } },
  'vg-concombre':    { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 300 } },
  'vg-poireau':      { defaultUnit: 'unité',  altUnits: ['g','botte'],
                       gramsPer: { 'unité': 150, botte: 600 } },
  'vg-betterave':    { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 200 } },
  'vg-brocoli':      { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 500 } },
  'vg-fenouil':      { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 350 } },
  'vg-laitue':       { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 300 } },
  'vg-salade-verte': { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 200 } },
  'vg-radis':        { defaultUnit: 'botte',  altUnits: ['g'],
                       gramsPer: { botte: 200, 'unité': 5 } },
  'vg-asperges':     { defaultUnit: 'botte',  altUnits: ['g','unité'],
                       gramsPer: { botte: 500, 'unité': 25 } },
  'vg-celeri':       { defaultUnit: 'unité',  altUnits: ['g','branche'],
                       gramsPer: { 'unité': 600, branche: 50 } },

  // ── Fruits typiquement comptés à la pièce ──────────────────────────────
  'fr-pomme':        { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 150 } },
  'fr-poire':        { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 170 } },
  'fr-banane':       { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 120 } },
  'fr-orange':       { defaultUnit: 'unité',  altUnits: ['g','kg'],
                       gramsPer: { 'unité': 180 } },
  'fr-citron':       { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 80 } },
  'fr-citron-vert':  { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 60 } },
  'fr-avocat':       { defaultUnit: 'unité',  altUnits: ['g'],
                       gramsPer: { 'unité': 200 } },

  // ── Charcuterie : tranches (sauf lardons en g, cohérent avec l'usage) ─
  'fr-jambon':       { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 30 } },
  'fr-jambon-blanc': { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 30 } },
  'fr-jambon-sec':   { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 18 } },
  'fr-bacon':        { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 8 } },
  'fr-mortadelle':   { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 25 } },
  'fr-chorizo':      { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 5 } },
  'fr-saucisson':    { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 6 } },
  // Lardons : explicitement en g (pas de tranche, vendus en barquette)
  'fr-lardons':      { defaultUnit: 'g',       altUnits: ['kg'] },

  // ── Pain : tranches pour le pain de mie / hamburger ───────────────────
  'gp-pain-mie':     { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 25 } },
  'gp-pain-burger':  { defaultUnit: 'unité',   altUnits: ['g'],
                       gramsPer: { 'unité': 70 } },
  'gp-pain-grille':  { defaultUnit: 'tranche', altUnits: ['g'],
                       gramsPer: { tranche: 12 } },

  // Baguette / pain artisanal : recettes utilisant « tranche »
  // doivent pouvoir être converties en pcs au moment du panier
  // (1 baguette ≈ 250 g ≈ 8 tranches).
  'gp-baguette':     { defaultUnit: 'pcs', altUnits: ['tranche', 'g'],
                       gramsPer: { pcs: 250, 'unité': 250, tranche: 30 } },
  'gp-pain':         { defaultUnit: 'pcs', altUnits: ['tranche', 'g'],
                       gramsPer: { pcs: 400, 'unité': 400, tranche: 50 } },
  'gp-pain-complet': { defaultUnit: 'pcs', altUnits: ['tranche', 'g'],
                       gramsPer: { pcs: 500, 'unité': 500, tranche: 50 } },
  'gp-pain-seigle':  { defaultUnit: 'pcs', altUnits: ['tranche', 'g'],
                       gramsPer: { pcs: 500, 'unité': 500, tranche: 50 } },

  // ── Liquides spécifiques : cs/cl par défaut, g possible si la recette pèse ─
  'sp-huile-olive':    { defaultUnit: 'cs', altUnits: ['cl','ml','g'],
                         gramsPer: { cs: 14, cc: 5 } },
  'sp-huile-olive-ex': { defaultUnit: 'cs', altUnits: ['cl','ml','g'],
                         gramsPer: { cs: 14, cc: 5 } },
  'sp-vinaigre':       { defaultUnit: 'cs', altUnits: ['cl','cc','g'],
                         gramsPer: { cs: 15, cc: 5 } },
  'fr-lait':           { defaultUnit: 'cl', altUnits: ['ml','L','g'],
                         gramsPer: { cl: 10, ml: 1 } },
  'fr-creme':          { defaultUnit: 'cl', altUnits: ['ml','cs','g'],
                         gramsPer: { cl: 10, cs: 15 } },

  // ── Ingrédients concentrés / reconstitués (v3.27.7) ────────────────
  // Quand la recette stocke le bouillon en cl/L (volume reconstitué) et que
  // le pack vendu est en pièces (cubes), on convertit via `reconstitutes` :
  //   1 cube → 100 cl de bouillon. Donc 1 L de bouillon → 1 cube nécessaire.
  'gp-bouillon-cube': { defaultUnit: 'pcs', altUnits: ['cl','L','g'],
                        gramsPer: { pcs: 10 },
                        reconstitutes: { pcs: { amount: 100, unit: 'cl' } } },

  // Concentré de tomates : 1 g de concentré ≈ 2.85 g de coulis (donnée
  // moyenne d'industries — ratio variable selon les marques).
  'gp-concentre-tom': { defaultUnit: 'g', altUnits: ['cs','cc'],
                        gramsPer: { cs: 18, cc: 6 },
                        reconstitutes: { g: { amount: 2.85, unit: 'g' } } },

  // ── Pâtes & sauces asiatiques : cuillère à soupe par défaut ─────────
  'sp-gochujang':     { defaultUnit: 'cs',  altUnits: ['cc','g'] },
  'sp-doubanjiang':   { defaultUnit: 'cs',  altUnits: ['cc','g'] },
  'sp-sauce-tonkatsu':{ defaultUnit: 'cs',  altUnits: ['cc','g'] },

  // ── Câpres, poivre vert, galanga : en grammes par défaut ─────────────
  'sp-capres':        { defaultUnit: 'g',   altUnits: ['cs','cc'] },
  'sp-poivre-vert':   { defaultUnit: 'g',   altUnits: ['cc','pincée'] },
  'sp-galanga':       { defaultUnit: 'g',   altUnits: ['cc','cs'] },

  // ── Vins & spiritueux de cuisine : cl par défaut ──────────────────────
  'gp-vin-blanc-cuis':        { defaultUnit: 'cl',  altUnits: ['cs','ml'] },
  'gp-cognac':                { defaultUnit: 'cl',  altUnits: ['cs','ml'] },

  // ── Lait concentré : cl par défaut (utilisé en volume en cuisine) ─────
  'gp-lait-concentre-sucre':  { defaultUnit: 'g',   altUnits: ['cl','cs','ml'] },

  // ── Pains plats & feuilles de pâte : à l'unité ───────────────────────
  'gp-tortillas-ble': { defaultUnit: 'unité', altUnits: ['g'],
                        gramsPer: { 'unité': 40 } },
  'gp-pate-filo':     { defaultUnit: 'unité', altUnits: ['g'],
                        gramsPer: { 'unité': 15 } },
  'gp-feuille-brick': { defaultUnit: 'unité', altUnits: ['g'],
                        gramsPer: { 'unité': 20 } },
  'gp-pain-pita':     { defaultUnit: 'unité', altUnits: ['g'],
                        gramsPer: { 'unité': 70 } },
}

// 3) Résolveur — override > préfixe > fallback
export function getUnitHints(ingredientId) {
  if (!ingredientId) return FALLBACK
  if (SPECIFIC[ingredientId]) return SPECIFIC[ingredientId]
  for (const [prefix, hints] of Object.entries(PREFIX_DEFAULTS)) {
    if (ingredientId.startsWith(prefix)) return hints
  }
  return FALLBACK
}

// Helper : grammes par unité-pièce pour un ingrédient donné. Renvoie 0 si
// l'unité n'est pas renseignée pour cet ingrédient (le panier saute alors
// la conversion plutôt que d'inventer une valeur).
export function getGramsPer(ingredientId, unit) {
  const hints = getUnitHints(ingredientId)
  return hints.gramsPer?.[unit] ?? 0
}

// Helper : équivalence reconstituée pour un ingrédient concentré
// vendu dans une certaine unité (cube, sachet, gramme de concentré…).
// Renvoie `{ amount, unit }` si défini, sinon null.
//
// Sémantique : « 1 `packUnit` de cet ingrédient produit `amount` `unit` de
// l'ingrédient réel utilisé en cuisine ».
//
// Exemples :
//   getReconstitutes('gp-bouillon-cube', 'pcs') → { amount: 100, unit: 'cl' }
//     (1 cube → 100 cl de bouillon reconstitué)
//   getReconstitutes('gp-concentre-tom', 'g')   → { amount: 2.85, unit: 'g' }
//     (1 g de concentré ≈ 2.85 g de coulis équivalent)
export function getReconstitutes(ingredientId, packUnit) {
  const hints = getUnitHints(ingredientId)
  return hints.reconstitutes?.[packUnit] ?? null
}

// Exports pour tests
export { PREFIX_DEFAULTS, SPECIFIC, FALLBACK }
