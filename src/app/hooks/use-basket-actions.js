import { useState, useCallback } from 'react'
import { useCartActions } from '@features/cart/hooks/use-cart-actions'

// Hook regroupant les actions non-destructives du panier (CRUD + load
// liste sauvegardée + stepper personnes). Sprint 10 S10.a.8 — extrait
// depuis App.jsx.
//
// 🔴 UNE seule implémentation du panier (audit du 2026-10-04, ARCH-07) : ce
// hook DÉLÈGUE à `useCartActions` (panier, fiche recette). Il en était une
// COPIE — 78 à 92 % identique —, et chaque copie avait déjà perdu un correctif
// de l'autre, rattrapé à la main et en retard : le filtre du stock (perdu côté
// panier, remis le 2026-08-28) et le prix qui dérivait au fil des portions
// (jamais reporté ici avant le 2026-08-29). Il ne garde que ce qui est propre
// à l'accueil : le nom de la liste chargée. Le test `une-seule-implementation`
// refuse qu'il réécrive lui-même dans le panier.
//
// Note d'architecture : les flux destructifs avec toast undo (vider
// panier, transfert panier→frigo) sont dans `useBasketToasts`. Ils
// reçoivent `setLoadedListInfo` retourné ici pour pouvoir reset le
// nom de la liste chargée quand l'utilisateur quitte ce contexte.
//
// Renvoie :
//   - loadedListInfo               : null | { id, name }
//   - setLoadedListInfo            : injecté dans useBasketToasts
//   - handleAddToCart              : ajoute une recette (scaling servings + prix)
//   - handleUpdateRecipeServings   : ajuste le nb de personnes d'une recette
//   - handleManualAddBasketItem    : ajoute un ingrédient hors recette
//   - handleLoadShoppingList       : charge une liste sauvegardée
//   - handleRenameLoadedList       : renomme la liste actuellement chargée
//
// Dépendances injectées : user, lang, basket, stock, ingredientsById,
// refreshBasket (du hook useBasket).

export function useBasketActions({
  user,
  lang,
  basket,
  stock,
  ingredientsById,
  refreshBasket,
}) {
  // Tracker la liste actuellement chargée dans le panier pour afficher
  // son nom dans le header (au lieu du générique « Panier de courses »)
  // et permettre de l'éditer inline. Remis à null quand on VIDE le panier
  // (`handleClearBasket`, dans `useBasketToasts`) — et seulement là : un
  // ajout à la main ou un changement de portions garde le nom affiché. Ce
  // commentaire promettait l'inverse ; ni cette version ni la copie
  // d'avant le 2026-10-08 ne le faisaient.
  const [loadedListInfo, setLoadedListInfo] = useState(null)

  const { handleAddToCart, handleUpdateRecipeServings, handleManualAdd, handleLoadList } =
    useCartActions({ user, basket, stock, lang, ingredientsById, refreshBasket })

  // Charge une liste sauvegardée dans le panier actuel (le panier est
  // remplacé ; c'est à la modale appelante de demander confirmation).
  // Le 2e argument optionnel `listInfo: { id, name }` permet de
  // tracker quelle liste est chargée (header + édition inline).
  const handleLoadShoppingList = useCallback(async (items, listInfo = null) => {
    const resultat = await handleLoadList(items)
    if (!resultat.error && listInfo?.id) setLoadedListInfo({ id: listInfo.id, name: listInfo.name ?? '' })
    return resultat
  }, [handleLoadList])

  // Update du nom de la liste actuellement chargée dans le panier.
  // Persiste en BDD via updateShoppingList puis met à jour le state.
  const handleRenameLoadedList = useCallback(async (newName) => {
    if (!loadedListInfo?.id) return { error: { message: 'no_list_loaded' } }
    const { updateShoppingList } = await import('@features/cart/api/shopping-lists')
    const { error } = await updateShoppingList(loadedListInfo.id, { name: newName })
    if (error) return { error }
    setLoadedListInfo(prev => prev ? { ...prev, name: newName } : null)
    return { error: null }
  }, [loadedListInfo?.id])

  return {
    loadedListInfo,
    setLoadedListInfo,
    handleAddToCart,
    handleUpdateRecipeServings,
    handleManualAddBasketItem: handleManualAdd,
    handleLoadShoppingList,
    handleRenameLoadedList,
  }
}
