import { useCallback, useEffect, useRef } from 'react'
import { loadCustomRecipes, saveCustomRecipe, markAdminModifiedRead } from '@features/recipes/lib/custom-recipes'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'

// Hook regroupant les 4 callbacks de gestion des recettes custom
// (créées par l'utilisateur). Sprint 10 S10.a.9 — extrait depuis App.jsx.
//
// Le state `customRecipes` reste dans App.jsx car il est consommé par
// plusieurs sections JSX et le flow d'auth (logout/login reset). Le
// hook reçoit la state + ses setters par injection.
//
// Renvoie :
//   - handleSaveCustomRecipe          : sauvegarde + refetch ; rend `{ error }`
//   - handleDeleteCustomRecipe        : ouvre la modale RGPD (Article 17)
//   - handleRecipeDeletionConfirmed   : refetch après confirmation modale
//   - handleMarkAdminModifiedRead     : marque le badge admin_modified lu
//
// 🔴 2026-10-05 — deux règles, absentes jusque-là :
//   1. le résultat d'un enregistrement est RENDU à l'appelant. Avant, il était
//      jeté : le formulaire fermait et purgeait son brouillon sur une recette
//      que la base avait refusée ;
//   2. un rechargement raté ne VIDE pas « Mes recettes ». La lecture rendait
//      une liste vide sur erreur, et on la posait telle quelle à l'écran.
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
  const signalerEchec = useSaveErrorToast()

  // Recharge la liste depuis la base. Si la lecture échoue, la liste affichée
  // est gardée et `repli` y applique le changement qu'on SAIT avoir eu lieu.
  const recharger = useCallback(async (repli) => {
    const { recipes, error } = await loadCustomRecipes(user?.id)
    if (error) setCustomRecipes(repli)
    else setCustomRecipes(recipes)
  }, [user?.id, setCustomRecipes])

  const handleSaveCustomRecipe = useCallback(async (recipe) => {
    let error
    try { ({ error } = await saveCustomRecipe(recipe, user?.id)) }
    catch (err) { error = err ?? new Error('unknown') }
    if (error) return { error }
    // Enregistrée. À défaut de pouvoir relire la base : la recette remplace
    // l'ancienne à sa place, ou prend la tête de liste (les plus récentes d'abord).
    await recharger((liste) => (liste.some((r) => r.id === recipe.id)
      ? liste.map((r) => (r.id === recipe.id ? recipe : r))
      : [recipe, ...liste]))
    return { error: null }
  }, [user?.id, recharger])

  // Prépare l'ouverture de la modale en stockant la recette à supprimer.
  // La suppression effective se fait dans RecipeDeleteConfirmModal.
  const handleDeleteCustomRecipe = useCallback((id) => {
    if (!user?.id) return
    const recipe = customRecipesRef.current.find(r => r.id === id)
    if (recipe) setDeletingRecipe(recipe)
  }, [user?.id, setDeletingRecipe])

  // `recipeId` : la recette que la modale vient de supprimer (elle le passe en
  // second argument). Sert seulement si la liste ne peut pas être relue.
  const handleRecipeDeletionConfirmed = useCallback(async (_bilan, recipeId) => {
    setDeletingRecipe(null)
    if (user?.id) await recharger((liste) => liste.filter((r) => r.id !== recipeId))
  }, [user?.id, setDeletingRecipe, recharger])

  // Le bandeau ne disparaît que si l'écriture a tenu : effacé à l'écran sur une
  // écriture refusée, il serait revenu au rechargement suivant.
  const handleMarkAdminModifiedRead = useCallback(async (id) => {
    if (!user?.id) return
    const { error } = await markAdminModifiedRead(id, user.id)
    if (error) { signalerEchec(); return }
    setCustomRecipes(prev => prev.map(r => r.id === id ? { ...r, admin_modified: false } : r))
  }, [user?.id, setCustomRecipes, signalerEchec])

  return {
    handleSaveCustomRecipe,
    handleDeleteCustomRecipe,
    handleRecipeDeletionConfirmed,
    handleMarkAdminModifiedRead,
  }
}
