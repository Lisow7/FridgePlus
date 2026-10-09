import { useCallback, useEffect, useRef } from 'react'
import { getCustomRecipes, saveCustomRecipe, markAdminModifiedRead } from '@features/recipes/lib/custom-recipes'

// Hook regroupant les 4 callbacks de gestion des recettes custom
// (créées par l'utilisateur). Sprint 10 S10.a.9 — extrait depuis App.jsx.
//
// Le state `customRecipes` reste dans App.jsx car il est consommé par
// plusieurs sections JSX et le flow d'auth (logout/login reset). Le
// hook reçoit la state + ses setters par injection.
//
// Renvoie :
//   - handleSaveCustomRecipe          : sauvegarde + refetch
//   - handleDeleteCustomRecipe        : ouvre la modale RGPD (Article 17)
//   - handleRecipeDeletionConfirmed   : refetch après confirmation modale
//   - handleMarkAdminModifiedRead     : marque le badge admin_modified lu
//
// La modale de suppression utilise la RPC SQL `delete_custom_recipe_rgpd`
// (hard delete + cascade favoris + notif favoriteurs + log RGPD).
//
// ⚠️ `customRecipesRef` est interne au hook : sans le useRef, la
// callback `handleDeleteCustomRecipe` dépendrait de `customRecipes`
// (array qui change à chaque save/load) → recréation à chaque render →
// peut déclencher Maximum update depth chez les consumers.

export function useCustomRecipesHandlers({
  user,
  customRecipes,
  setCustomRecipes,
  setDeletingRecipe,
}) {
  const customRecipesRef = useRef(customRecipes)
  useEffect(() => { customRecipesRef.current = customRecipes }, [customRecipes])

  const handleSaveCustomRecipe = useCallback(async (recipe) => {
    await saveCustomRecipe(recipe, user?.id)
    setCustomRecipes(await getCustomRecipes(user?.id))
  }, [user?.id, setCustomRecipes])

  // Prépare l'ouverture de la modale en stockant la recette à supprimer.
  // La suppression effective se fait dans RecipeDeleteConfirmModal.
  const handleDeleteCustomRecipe = useCallback((id) => {
    if (!user?.id) return
    const recipe = customRecipesRef.current.find(r => r.id === id)
    if (recipe) setDeletingRecipe(recipe)
  }, [user?.id, setDeletingRecipe])

  const handleRecipeDeletionConfirmed = useCallback(async () => {
    setDeletingRecipe(null)
    if (user?.id) setCustomRecipes(await getCustomRecipes(user.id))
  }, [user?.id, setDeletingRecipe, setCustomRecipes])

  const handleMarkAdminModifiedRead = useCallback(async (id) => {
    if (!user?.id) return
    await markAdminModifiedRead(id, user.id)
    setCustomRecipes(prev => prev.map(r => r.id === id ? { ...r, admin_modified: false } : r))
  }, [user?.id, setCustomRecipes])

  return {
    handleSaveCustomRecipe,
    handleDeleteCustomRecipe,
    handleRecipeDeletionConfirmed,
    handleMarkAdminModifiedRead,
  }
}
