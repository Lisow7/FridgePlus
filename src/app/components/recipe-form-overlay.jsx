import { Suspense, lazy } from 'react'
import { useRecipeForm } from '@shared/contexts/recipe-form-context'

// RecipeFormOverlay — Sprint 11 S11.e.1.
//
// Composant top-level qui rend RecipeFormModal en se basant sur l'état
// du RecipeFormProvider (showForm/editRecipe). Permet d'ouvrir le form
// depuis n'importe quelle route via useRecipeForm().openCreate/openEdit.
//
// Reçoit onSave depuis App.jsx (qui détient handleSaveCustomRecipe ;
// celui-ci dépend de user + setCustomRecipes qu'on ne veut pas lifter).
//
// Avant Sprint 11 S11.e.1 : RecipeFormModal était rendu localement dans
// RecipePanel, donc inaccessible depuis les routes /profile, /recipe/:id
// (overlay), /community, etc.

const RecipeFormModal = lazy(() => import('@features/recipes/components/recipe-form-modal'))

export default function RecipeFormOverlay({ onSave, lang, darkMode }) {
  const { showForm, editRecipe, close } = useRecipeForm()

  if (!showForm) return null

  return (
    <Suspense fallback={null}>
      <RecipeFormModal
        initialRecipe={editRecipe}
        onSave={onSave}
        onClose={close}
        lang={lang}
        darkMode={darkMode}
      />
    </Suspense>
  )
}
