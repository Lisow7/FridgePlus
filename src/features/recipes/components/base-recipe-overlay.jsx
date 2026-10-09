import { useBaseRecipes } from '@shared/contexts/data-provider'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { pickLocalizedName } from '@shared/lib/recipes/recipe-i18n'
import { computeLockedServings } from '@features/recipes/lib/base-recipe-servings-lock'
import RecipeModal from './recipe-modal'

const BACK_TO_I18N = {
  fr: (name) => `Retour à ${name}`,
  en: (name) => `Back to ${name}`,
}

// Overlay affichant une recette de base par-dessus la recette en cours, sans
// changement de route (cf. la conception « base-recipe-links » du 2026-07-14
// — l'URL de la recette d'origine reste affichée pendant tout l'aperçu).
// Réutilise RecipeModal en entier (variant='modal') — bandeau de retour
// fourni via la prop `returnBanner` (Task 7). `useCloseOnBackButton` est déjà
// documenté comme composable avec des modales imbriquées (jeton unique par
// instance) — aucune coordination supplémentaire nécessaire avec la modale
// parente.
//
// Portions : verrouillées sur ce que la recette d'origine requiert quand
// celle-ci déclare un usage substantiel (sub_recipes) de cette recette de
// base — voir la conception « base-recipe-servings-lock » du 2026-07-15.
// Sans entrée sub_recipes correspondante (mention textuelle seule), les
// portions restent libres et figées à leur valeur par défaut, comme avant.

export default function BaseRecipeOverlay({
  recipeId, originRecipe, originServings, onClose, lang = 'fr', darkMode = false,
  stock, favorites, onToggleFavorite, onToggleIngredient, allergenPrefs,
  onAddToCart, basketRecipeIds,
}) {
  const { recipesById, recipeNames } = useBaseRecipes()
  const recipe = recipesById.get(recipeId)

  useCloseOnBackButton(true, onClose)

  if (!recipe) return null

  // Même résolution de nom que RecipeModal (recipe-modal.jsx) : une recette
  // officielle n'a pas de `.name` propre (rowsToRecipes() ne le mappe pas),
  // le nom vit dans la map recipeNames séparée. Seules les recettes custom
  // portent leur nom directement sur l'objet.
  const originName = originRecipe.isCustom
    ? pickLocalizedName(originRecipe.name, null, lang, originRecipe.id)
    : pickLocalizedName(recipeNames[originRecipe.id], null, lang, originRecipe.id)

  const lockedServings = computeLockedServings({ originRecipe, originServings, baseRecipe: recipe })

  return (
    <RecipeModal
      recipe={recipe}
      variant="modal"
      onClose={onClose}
      lang={lang}
      darkMode={darkMode}
      stock={stock}
      favorites={favorites}
      onToggleFavorite={onToggleFavorite}
      onToggleIngredient={onToggleIngredient}
      allergenPrefs={allergenPrefs}
      onAddToCart={onAddToCart}
      basketRecipeIds={basketRecipeIds}
      returnBanner={{ label: (BACK_TO_I18N[lang] ?? BACK_TO_I18N.fr)(originName), onClick: onClose }}
      lockedServings={lockedServings ?? undefined}
      lockedByLabel={lockedServings != null ? originName : undefined}
      lockedOriginServings={lockedServings != null ? originServings : undefined}
    />
  )
}
