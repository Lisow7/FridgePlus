import { createContext, useContext } from 'react'

// DeletingRecipeContext — Sprint 11 S11.e.2.
//
// Primitives en `shared/` pour rester consommable depuis n'importe
// quelle feature (RecipePage en overlay, RecipePanel, etc.).
//
// L'orchestration (state + setter) vit dans app/contexts/.
//
// API exposée par useDeletingRecipe() :
//   - requestDelete(recipe)     : ouvre la confirm dialog
//   - cancel()                  : ferme la dialog sans supprimer
//   - deletingRecipe            : recipe en attente de confirmation (ou null)
//
// La confirmation finale est faite par RecipeDeleteConfirmModal rendu
// au top-level via recipe-browser-modals.jsx (callback
// onRecipeDeletionConfirmed dans App.jsx qui supprime côté DB).

export const DeletingRecipeContext = createContext(null)

export function useDeletingRecipe() {
  const ctx = useContext(DeletingRecipeContext)
  if (!ctx) {
    throw new Error('useDeletingRecipe must be used within <DeletingRecipeProvider>')
  }
  return ctx
}
