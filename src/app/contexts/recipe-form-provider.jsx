import { useState, useCallback, useMemo } from 'react'
import { RecipeFormContext } from '@shared/contexts/recipe-form-context'

// RecipeFormProvider — Sprint 11 S11.e.1.
//
// Lift le state showForm + editRecipe d'un endroit unique (avant : local
// à RecipePanel), pour que n'importe quel composant routé puisse ouvrir
// le formulaire de création/édition de recette custom.
//
// Architecture Bulletproof React :
//   - PRIMITIVES (context + useRecipeForm hook) : shared/contexts/
//   - ORCHESTRATION (état + setters) : ici (app/contexts/)
//   - RENDU (RecipeFormModal) : dans App.jsx, qui a accès à
//     handleSaveCustomRecipe via le state customRecipes.
//
// Pourquoi ne PAS rendre RecipeFormModal directement dans le provider :
// le onSave callback dépend de App.jsx state (setCustomRecipes + user).
// Garder le rendu dans App.jsx évite de lifter cette logique aussi.
// Le provider ne fait que tenir l'état d'ouverture du form.

export function RecipeFormProvider({ children }) {
  const [editRecipe, setEditRecipe] = useState(null)
  const [showForm, setShowForm]     = useState(false)

  const openCreate = useCallback(() => {
    setEditRecipe(null)
    setShowForm(true)
  }, [])

  const openEdit = useCallback((recipe) => {
    setEditRecipe(recipe)
    setShowForm(true)
  }, [])

  const close = useCallback(() => {
    setShowForm(false)
    setEditRecipe(null)
  }, [])

  const value = useMemo(() => ({
    showForm, editRecipe,
    openCreate, openEdit, close,
  }), [showForm, editRecipe, openCreate, openEdit, close])

  return (
    <RecipeFormContext.Provider value={value}>
      {children}
    </RecipeFormContext.Provider>
  )
}
