import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  loadBasketFromDB,
  addBasketItems,
  updateBasketItem,
  removeBasketItem,
  removeBasketByRecipe,
  clearBasket,
} from '@features/cart/api/basket'
import { logError } from '@shared/lib/observability/sentry'

// Sprint 6 PR S6.e — Custom hook `useBasket`.
//
// Encapsule le state `basket` (array de basket_items) et ses opérations
// de manipulation avec le pattern anti-race « version tracking » :
// quand plusieurs fetches sont en vol, on jette les réponses obsolètes.
//
// Avant cette PR, ce pattern était dupliqué 8+ fois dans App.jsx
// (handleToggleBasketItem, handleChangeBasketItemPack,
// handleAddManualBasketItem, handleRemoveBasketItem, handleClearBasket,
// handleRestoreBasketItems, handleRemoveBasketRecipe, etc.). Chacun
// faisait son propre `++version` + `if (myVersion === ref.current)`.
//
// Périmètre de cette PR :
//   - State `basket`, `basketLoading`, `basketFetchVersionRef` (interne).
//   - useEffect qui load depuis DB sur changement `user?.id`.
//   - Helpers basiques : `refresh`, `toggleItem`, `changeItemPack`,
//     `addBatch`, `removeItem`, `restoreItems`, `removeRecipe`, `clear`.
//   - Memo dérivé : `basketRecipeIds`.
//   - Raw setter `setBasket` exposé pour cas d'orchestration externe.
//
// Hors périmètre (restent dans App.jsx) :
//   - `handleAddToCart` (recette → basket) : couplé à stock/lang/
//     ingredientsById/recipe. Appelle `basket.addBatch(items)` pour
//     l'insertion DB + refresh.
//   - `handleUpdateRecipeServings` : recalc batch updates, appelle
//     `basket.refresh()` après. Reste dans App.jsx pour le moment.
//   - `handleClearBasket` (orchestration snapshot + spending event +
//     toast undo) : appelle `basket.clear()` pour la partie BDD.

export function useBasket(user) {
  const [basket, setBasket] = useState([])
  const [basketLoading, setBasketLoading] = useState(false)
  // Compteur de version pour les fetches : permet d'ignorer une
  // réponse en retard si une mutation plus récente a déjà résolu.
  // Pattern « stale-fetch ignored ». Référence stable, ne déclenche
  // pas de re-render.
  const versionRef = useRef(0)

  // Helper interne : bump la version + retourne le numéro pour
  // comparaison dans le .then. Encapsule le pattern duppliqué.
  const newFetchToken = useCallback(() => ++versionRef.current, [])
  const isLatestToken = useCallback((token) => token === versionRef.current, [])

  // Refresh : refetch complet du basket depuis la DB. Version-tracked.
  const refresh = useCallback(async () => {
    if (!user?.id) return
    const token = newFetchToken()
    const data = await loadBasketFromDB(user.id)
    if (isLatestToken(token)) setBasket(data)
  }, [user?.id, newFetchToken, isLatestToken])

  // Load initial au mount + sur changement user. Reset si pas de user.
  useEffect(() => {
    if (!user?.id) {
      setBasket([])
      return
    }
    const token = newFetchToken()
    setBasketLoading(true)
    loadBasketFromDB(user.id)
      .then(data => {
        if (!isLatestToken(token)) return
        setBasket(data)
        setBasketLoading(false)
      })
      .catch(err => {
        if (!isLatestToken(token)) return
        setBasketLoading(false)
        logError(err, { tag: 'useBasket.load', userId: user.id })
      })
  }, [user?.id, newFetchToken, isLatestToken])

  // Toggle checked d'un item. Update local immédiat (optimistic), DB
  // en background. Pas de refresh nécessaire car update simple.
  const toggleItem = useCallback(async (itemId, checked) => {
    updateBasketItem(itemId, { checked })
    setBasket(prev => prev.map(i => i.id === itemId ? { ...i, checked } : i))
  }, [])

  // Change le conditionnement d'un basket_item (pack size/unit/price).
  // Update local + DB, pas de refresh.
  const changeItemPack = useCallback(async (itemId, { size, unit, price }) => {
    if (!itemId || size == null || !unit) return
    const fields = {
      amount: size,
      amount_initial: size,
      unit,
      price: price != null ? Math.round(price * 100) / 100 : null,
    }
    updateBasketItem(itemId, fields)
    setBasket(prev => prev.map(i => i.id === itemId ? { ...i, ...fields } : i))
  }, [])

  // Insère N basket_items en BDD, puis refresh pour avoir les ids
  // générés côté serveur. Utilisé par handleAddToCart (App.jsx) et
  // handleRestoreBasketItems (undo après suppression).
  const addBatch = useCallback(async (items) => {
    if (!user?.id || !items?.length) return { error: null }
    const { error } = await addBasketItems(user.id, items)
    if (!error) await refresh()
    return { error }
  }, [user?.id, refresh])

  // Retire un item du basket. Update local optimistic + DB. Si la
  // BDD refuse (RLS, network), on refetch pour restaurer visuellement
  // l'item (cohérence BDD-state).
  const removeItem = useCallback(async (itemId) => {
    if (!itemId) return
    setBasket(prev => prev.filter(i => i.id !== itemId))   // optimistic
    const { error } = await removeBasketItem(itemId)
    if (error) await refresh()                              // rollback
  }, [refresh])

  // Restaure une liste d'items après undo. Strip id/user_id/added_at
  // pour que Supabase régénère proprement (sinon insert RLS échoue
  // sur duplicate id ou user_id mismatch).
  const restoreItems = useCallback(async (items) => {
    if (!user?.id || !Array.isArray(items) || items.length === 0) return
    const cleanItems = items.map(({ id: _id, user_id: _u, added_at: _a, ...rest }) => rest)
    await addBasketItems(user.id, cleanItems)
    await refresh()
  }, [user?.id, refresh])

  // Retire toutes les lignes d'une recette du basket. Optimistic +
  // rollback si erreur DB.
  const removeRecipe = useCallback(async (recipeId) => {
    if (!user?.id) return
    setBasket(prev => prev.filter(i => i.recipe_id !== recipeId))   // optimistic
    const { error } = await removeBasketByRecipe(user.id, recipeId)
    if (error) await refresh()                                       // rollback
  }, [user?.id, refresh])

  // Vide complètement le basket. Utilisé par handleClearBasket dans
  // App.jsx (qui orchestre aussi le toast undo + snapshot).
  const clear = useCallback(async () => {
    if (!user?.id) return
    const { error } = await clearBasket(user.id)
    if (!error) await refresh()
  }, [user?.id, refresh])

  // Memo : Set des recipe_ids présents dans le basket. Utilisé par
  // RecipePanel et RecipeCard pour afficher le badge « dans le panier ».
  const basketRecipeIds = useMemo(
    () => new Set(basket.map(i => i.recipe_id).filter(Boolean)),
    [basket]
  )

  return {
    basket, setBasket,
    basketLoading, setBasketLoading,
    basketRecipeIds,
    refresh,
    toggleItem,
    changeItemPack,
    addBatch,
    removeItem,
    restoreItems,
    removeRecipe,
    clear,
    // Exposé pour les call-sites qui orchestrent un fetch manuel
    // (ex : App.jsx handleAddToCart qui veut son propre refresh
    // version-tracké post-insert).
    newFetchToken,
    isLatestToken,
  }
}
