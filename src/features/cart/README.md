# Feature `cart`

> Panier de courses (**Premium**) : transforme des besoins (recettes, ajouts manuels) en liste
> d'achat avec les **conditionnements grande surface les moins chers** et un suivi de coût/budget.
> Parcours en phases. (Code lu sur `dev` le 2026-06-22, pas seulement les noms de fichiers.)

## Rôle
Aider à acheter ce qu'il manque : pour chaque besoin, proposer la meilleure combinaison de packs
(prix mini), suivre le budget, sauvegarder/partager des listes, puis reverser les achats au frigo.

## Accès (gating)
Route `/cart` (`pages/cart-page.jsx`) sous **`AuthGuard`** (non connecté → `/login`). Le **premium est
vérifié _inline_ dans `CartPage`** (affiche un `UpgradeGate` si non-premium) — ce n'est **pas** un
guard de route : il n'existe aucun garde de route Premium (l'échafaudage `PremiumGuard`, jamais branché,
a été retiré le 2026-10-08).

## Structure
- **`api/`** (Supabase) — `basket.js` (CRUD des `basket_items` : add/update/remove/removeByRecipe/clear),
  `shared-baskets.js` (paniers partagés), `shopping-lists.js` (listes sauvegardées).
- **`hooks/`** — `use-basket` (state du panier + **pattern anti-race « version tracking »** : quand
  plusieurs fetches sont en vol, les réponses obsolètes sont ignorées — **ne pas casser ce
  mécanisme**), `use-cart-actions`.
- **`lib/`** :
  - `pack-optimizer.js` — **algorithme knapsack (DP)** : pour un besoin (grammage/volume), trouve la
    combinaison de packs au **prix minimum**. Gère les conversions d'unités (cl = pivot liquides ;
    densité ≈ 1 pour liquide↔masse). Packs depuis `@shared/static/pack-sizes`, prix via
    `@shared/lib/pricing/pricing-resolver`.
  - `cart-helpers.js` — `getPacksForIngredient` : packs **spécifiques par ingrédient** sinon fallback
    **par sous-catégorie** (`@shared/static/default-packs-by-category`) ; renvoie toujours non-vide.
  - `spending-payload.js` — payload de dépense.
- **`components/`** — UX **en phases** : `home-phase` → `prepare-phase` → `shopping-phase` →
  `whats-next-phase` ; plus `pack-selector`, `cart-budget-bar`, `cart-suggestions-*`,
  `shared-basket-page`, `shopping-lists-modal`, `save-shopping-list-modal`, `add-to-fridge-modal`.
- **`index.js`** — façade publique (re-exporte aussi des libs `@shared/lib/pricing/*` et budget/spending).

## Décisions non-évidentes
- **Premium vérifié inline** (UpgradeGate), pas via guard de route (voir « Accès » ci-dessus).
- **Pack-optimizer = knapsack DP** sur des conditionnements réels grande surface — modifier la table
  `@shared/static/pack-sizes` ou le résolveur de prix change directement les suggestions et coûts.
  ⚠️ Certains commentaires du code citent encore `src/data/packSizes.js` (chemin **périmé**) — la
  vraie source est `@shared/static/pack-sizes`.
- **Anti-race dans `use-basket`** : préserver le « version tracking » lors de toute modif des fetches.
- i18n inline par composant → [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).

## Dépendances
- `@shared/static/pack-sizes`, `@shared/static/default-packs-by-category`,
  `@shared/static/ingredient-unit-hints`, `@shared/lib/pricing/*`, `@shared/api/budget`,
  `@shared/api/spending`.
- Feature `recipes` (phase « prepare » : besoins issus des recettes). Vue d'ensemble : `docs/ARCHITECTURE.md`.
