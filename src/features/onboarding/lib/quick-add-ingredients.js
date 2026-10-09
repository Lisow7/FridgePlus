// Pré-amorce du frigo (fil rouge onboarding, Mécanisme A). Ids réels du catalogue
// choisis pour GARANTIR ≥ 1 recette READY une fois ajoutés (validé par test —
// cf. quick-add-ingredients.test.js, Blocker C). Ne pas modifier sans relancer le test.
//
// ⚠️ IMPORTANT : n'utiliser QUE des ids « feuilles » (stockables). Un id « parent
// de groupe » (fr-beurre, gp-tomate…) est purgé du stock par le garde-fou
// (App.jsx parentIdsInStock) → la puce s'ajoutait puis disparaissait aussitôt.
// D'où fr-beurre→fr-beurre-doux et gp-tomate→gp-tomates-pelees (feuilles).
export const QUICK_ADD_IDS = [
  'fr-oeufs-standard', 'gp-spaghetti', 'fr-lardons', 'fr-parmesan', 'gp-tomates-pelees', 'fr-beurre-doux',
]
