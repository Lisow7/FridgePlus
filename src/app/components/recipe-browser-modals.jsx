import { Suspense, lazy } from 'react'

const RecipeDeleteConfirmModal = lazy(() => import('@features/recipes/components/recipe-delete-confirm-modal'))
const RecipePanel              = lazy(() => import('@features/recipes/components/recipe-panel'))

// Composant orchestrant les 2 surfaces top-level liées au browsing
// et à la gestion des recettes :
//   1. RecipeDeleteConfirmModal — modale de confirmation RGPD
//      Article 17 ouverte quand `deletingRecipe` est non-null.
//      La suppression effective (hard delete + cascade favoris +
//      notif favoriteurs + log RGPD) se fait via la RPC SQL
//      `delete_custom_recipe_rgpd` côté modale.
//   2. RecipePanel — panneau plein écran de browsing des recettes
//      (base + custom + public), affiché quand `showRecipes === true`.
//
// Sprint 10 S10.a.20 — extrait depuis App.jsx. Les deux composants
// vivent ici car la suppression d'une recette custom déclenchée
// depuis RecipePanel passe par `onDeleteCustomRecipe` (qui ouvre
// la modale via `setDeletingRecipe`).
//
// `deletingRecipe.name` peut être :
//   - string  : recette custom (name est un string brut)
//   - object  : recette de base ({ fr, en, es, de, ja })
// Le fallback `deletingRecipe.id` couvre le cas où aucune des deux
// formes n'est exploitable (recette corrompue / source inconnue).

export default function RecipeBrowserModals({
  // Delete confirm
  deletingRecipe,
  onDeletingRecipeClose,
  onRecipeDeletionConfirmed,
  // Recipe panel
  showRecipes,
  onShowRecipesClose,
  stock,
  favorites,
  customRecipes,
  publicRecipes,
  leftovers,
  basketRecipeIds,
  allergenPrefs,
  onToggleFavorite,
  onToggleIngredient,
  onResetStock,
  // Sprint 11 S11.e.1 — onSaveCustomRecipe retiré (RecipeFormModal
  // rendu au top-level d'App.jsx via RecipeFormOverlay).
  onDeleteCustomRecipe,
  onMarkAdminModifiedRead,
  onAddToCart,
  onShowSupport,
  // Onboarding step 2 : callback appelé quand une recette de la liste
  // triée par stock est ouverte (pas une recherche libre). Optionnel.
  onSuggestionOpen,
  // i18n / theme
  lang,
  darkMode,
}) {
  return (
    <>
      {deletingRecipe && (
        <Suspense fallback={null}>
          <RecipeDeleteConfirmModal
            recipeId={deletingRecipe.id}
            recipeName={
              typeof deletingRecipe.name === 'string'
                ? deletingRecipe.name
                : (deletingRecipe.name?.[lang] ?? deletingRecipe.name?.fr ?? deletingRecipe.id)
            }
            lang={lang}
            darkMode={darkMode}
            onClose={onDeletingRecipeClose}
            onDeleted={onRecipeDeletionConfirmed}
          />
        </Suspense>
      )}

      {showRecipes && (
        <Suspense fallback={null}>
          <RecipePanel
            stock={stock}
            onClose={onShowRecipesClose}
            onReset={onResetStock}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            lang={lang}
            darkMode={darkMode}
            onToggleIngredient={onToggleIngredient}
            customRecipes={customRecipes}
            publicRecipes={publicRecipes}
            onDeleteCustomRecipe={onDeleteCustomRecipe}
            onMarkAdminModifiedRead={onMarkAdminModifiedRead}
            allergenPrefs={allergenPrefs}
            onAddToCart={onAddToCart}
            basketRecipeIds={basketRecipeIds}
            leftovers={leftovers}
            onShowSupport={onShowSupport}
            onSuggestionOpen={onSuggestionOpen}
          />
        </Suspense>
      )}
    </>
  )
}
