import { createContext, useContext } from 'react'

// RecipeFormContext — Sprint 11 S11.e.1.
//
// PRIMITIVES (context + consumer hook) en shared/ pour rester
// consommable depuis n'importe quelle feature (RecipePanel, RecipePage,
// futur quick-create depuis FAB, etc.).
//
// La logique d'orchestration (state + setters + rendu de RecipeFormModal)
// vit dans app/contexts/recipe-form-provider.jsx.
//
// API exposée par useRecipeForm() :
//   - openCreate()              : ouvre le form en mode création (vide)
//   - openEdit(recipe)          : ouvre le form en mode édition (pré-rempli)
//   - close()                   : ferme le form (depuis le composant lui-même)
//   - showForm, editRecipe      : état (rare à consommer directement, surtout
//                                 utile pour le composant qui rend la modale)

export const RecipeFormContext = createContext(null)

export function useRecipeForm() {
  const ctx = useContext(RecipeFormContext)
  if (!ctx) {
    throw new Error('useRecipeForm must be used within <RecipeFormProvider>')
  }
  return ctx
}
