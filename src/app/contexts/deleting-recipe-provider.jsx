import { useState, useCallback, useMemo } from 'react'
import { DeletingRecipeContext } from '@shared/contexts/deleting-recipe-context'

// DeletingRecipeProvider — Sprint 11 S11.e.2.
//
// Lift le state `deletingRecipe` (avant : local à App.jsx) en context
// global pour que RecipePage en overlay puisse demander une suppression
// depuis n'importe quelle route.
//
// Architecture Bulletproof React :
//   - PRIMITIVES (context + hook) : shared/contexts/deleting-recipe-context.js
//   - ORCHESTRATION (state + setters) : ici
//   - RENDU (RecipeDeleteConfirmModal) : recipe-browser-modals.jsx
//     consume `deletingRecipe` via le hook et passe la cible à la dialog.

export function DeletingRecipeProvider({ children }) {
  const [deletingRecipe, setDeletingRecipe] = useState(null)

  const requestDelete = useCallback((recipe) => {
    setDeletingRecipe(recipe)
  }, [])

  const cancel = useCallback(() => {
    setDeletingRecipe(null)
  }, [])

  const value = useMemo(() => ({
    deletingRecipe,
    requestDelete,
    cancel,
  }), [deletingRecipe, requestDelete, cancel])

  return (
    <DeletingRecipeContext.Provider value={value}>
      {children}
    </DeletingRecipeContext.Provider>
  )
}
