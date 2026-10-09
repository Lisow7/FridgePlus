import { useState, useCallback } from 'react'
import { addBasketItems, clearBasket, updateBasketItemsBatch } from '@features/cart/api/basket'
import { toGrams } from '@shared/lib/recipes/recipe-utils'
import { getEmbeddedPrice } from '@shared/lib/pricing/open-prices'

// Hook regroupant les actions non-destructives du panier (CRUD + load
// liste sauvegardée + stepper personnes). Sprint 10 S10.a.8 — extrait
// depuis App.jsx.
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
  // et permettre de l'éditer inline. Reset à null quand user vide ou
  // modifie manuellement le panier — il quitte alors le contexte
  // « édition d'une liste » et le panier redevient un panier libre.
  const [loadedListInfo, setLoadedListInfo] = useState(null)

  const handleAddToCart = useCallback(async (recipe, selectedServings = recipe.servings ?? 1, { ignoreStock = false } = {}) => {
    if (!user?.id) return
    if (basket.some(i => i.recipe_id === recipe.id)) return 'duplicate'
    const scaleFactor = selectedServings / (recipe.servings ?? 1)
    const items = recipe.ingredients
      .map((ing, originalIndex) => ({ ing, originalIndex }))
      .filter(({ ing }) => ing.required && (ignoreStock || !ing.ids.some(id => stock.has(id))))
      .map(({ ing }) => {
        const id = ing.ids[0]
        // Depuis v3.1.0 toutes les recettes (BDD + custom) stockent qty
        // directement dans ing.qty.
        const qData = ing.qty
        const rawAmount = qData?.amount ?? null
        const unit = qData?.unit ?? 'g'
        const scaledAmount = rawAmount != null ? Math.round(rawAmount * scaleFactor * 10) / 10 : null
        const grams = qData ? toGrams(qData.amount, qData.unit, id) : 0
        const ingredient = ingredientsById?.get?.(id)
        const price = grams ? Math.round((getEmbeddedPrice(ingredient, lang) ?? 0) * grams / 100 * scaleFactor * 100) / 100 : null
        const label = ing.labels?.[lang] ?? ing.labels?.fr ?? id
        // amount_initial + recipe_servings_initial pour que le stepper
        // recalcule via un ratio basé sur la valeur initiale, sans drift
        // d'arrondi sur des UPDATE successifs.
        return {
          recipe_id: recipe.id,
          recipe_name: recipe.isCustom ? (recipe.name ?? recipe.id) : recipe.id,
          recipe_emoji: recipe.emoji,
          ingredient_id: id,
          label,
          amount: scaledAmount,
          amount_initial: scaledAmount,
          unit,
          price,
          recipe_servings: selectedServings,
          recipe_servings_initial: selectedServings,
        }
      })
    if (!items.length) return 'all_in_fridge'
    const { error } = await addBasketItems(user.id, items)
    if (!error) await refreshBasket()
  }, [user?.id, basket, stock, lang, ingredientsById, refreshBasket])

  // Stepper personnes : ajuste le nombre de personnes d'une recette
  // dans le panier et recalcule toutes les quantités via le ratio
  // amount_initial × newServings / recipe_servings_initial.
  // Le ratio est basé sur les valeurs initiales pour éviter le drift
  // d'arrondi sur des UPDATE successifs (cf. migration
  // 20260504_basket_servings_stepper.sql).
  const handleUpdateRecipeServings = useCallback(async (recipeId, newServings) => {
    if (!user?.id || !recipeId) return
    const safeServings = Math.max(1, Math.min(12, Math.round(newServings)))
    const items = basket.filter(i => i.recipe_id === recipeId)
    if (items.length === 0) return
    const updates = items.map(item => {
      // Si amount_initial est NULL (item legacy avant v3.27.4), on
      // l'initialise à amount/recipe_servings actuel pour démarrer
      // la référence proprement.
      const baseAmount = item.amount_initial ?? item.amount
      const baseServings = item.recipe_servings_initial ?? item.recipe_servings ?? 1
      const ratio = safeServings / baseServings
      const newAmount = Math.round((baseAmount ?? 0) * ratio * 10) / 10
      // Le prix doit suivre la quantité de façon PROPORTIONNELLE et SANS DÉRIVE.
      //
      // 🔴 Formule d'origine : `item.price * ratio`, où `ratio` se calcule
      // depuis les portions INITIALES mais `item.price` est le prix COURANT.
      // Le prix se composait donc à chaque changement pendant que la quantité,
      // repartant de `amount_initial`, ne dérivait pas — les deux se
      // désynchronisaient et le budget estimé devenait faux. Mesuré le
      // 2026-08-28 : un aller-retour 4 → 2 → 4 personnes ramenait un article de
      // 4 € à 2 €, trois allers-retours à 1 €, la quantité restant correcte.
      //
      // On met donc le prix à l'échelle par le ratio INCRÉMENTAL
      // `newAmount / amount_courant`. Correctif déjà appliqué dans
      // `features/cart/hooks/use-cart-actions.js` — il n'avait jamais été
      // reporté ici, alors que ce chemin est celui de l'ACCUEIL (App.jsx).
      const curAmount = item.amount ?? newAmount
      const newPrice = item.price != null && curAmount > 0
        ? Math.round((item.price * (newAmount / curAmount)) * 100) / 100
        : item.price ?? null
      return {
        id: item.id,
        amount: newAmount,
        price: newPrice,
        recipe_servings: safeServings,
        // One-time backfill si colonnes initiales NULL.
        ...(item.amount_initial == null ? { amount_initial: baseAmount } : {}),
        ...(item.recipe_servings_initial == null ? { recipe_servings_initial: baseServings } : {}),
      }
    })
    const { error } = await updateBasketItemsBatch(updates)
    if (!error) await refreshBasket()
  }, [user?.id, basket, refreshBasket])

  // Ajout manuel d'un ingrédient au panier (hors recette).
  // Insère un basket_item avec recipe_id=NULL (cf. migration
  // 20260503_basket_manual_add.sql). Refetch synchrone (await) après
  // l'INSERT pour garantir que l'UI reflète la BDD avant de rendre la
  // main. Retourne { error } pour que les callers puissent réagir.
  const handleManualAddBasketItem = useCallback(async (item) => {
    if (!user?.id || !item?.ingredient_id) {
      return { error: { message: 'invalid_args' } }
    }
    const row = {
      recipe_id: null,
      recipe_name: null,
      recipe_emoji: null,
      ingredient_id: item.ingredient_id,
      label: item.label ?? '',
      amount: Number(item.amount) || 1,
      unit: item.unit ?? 'pcs',
      price: item.price ?? null,
    }
    const { error } = await addBasketItems(user.id, [row])
    if (error) return { error }
    await refreshBasket()
    return { error: null }
  }, [user?.id, refreshBasket])

  // Charge une liste sauvegardée dans le panier actuel.
  // Stratégie : remplace complètement le panier (clearBasket +
  // addBasketItems depuis le snapshot). Si l'utilisateur a un panier
  // en cours, c'est à la modale appelante de demander confirmation.
  // Le 2e argument optionnel `listInfo: { id, name }` permet de
  // tracker quelle liste est chargée (header + édition inline).
  const handleLoadShoppingList = useCallback(async (items, listInfo = null) => {
    if (!user?.id || !Array.isArray(items)) return { error: { message: 'invalid_args' } }
    await clearBasket(user.id)
    const rows = items.map(it => ({
      recipe_id: it.recipe_id ?? null,
      recipe_name: it.recipe_name ?? null,
      recipe_emoji: it.recipe_emoji ?? null,
      ingredient_id: it.ingredient_id,
      label: it.label ?? '',
      amount: Number(it.amount) || 1,
      unit: it.unit ?? 'pcs',
      price: it.price ?? null,
      checked: it.checked ?? false,
      recipe_servings: it.recipe_servings ?? null,
      recipe_servings_initial: it.recipe_servings_initial ?? null,
      amount_initial: it.amount_initial ?? null,
    }))
    if (rows.length > 0) {
      const { error } = await addBasketItems(user.id, rows)
      if (error) return { error }
    }
    await refreshBasket()
    if (listInfo?.id) setLoadedListInfo({ id: listInfo.id, name: listInfo.name ?? '' })
    return { error: null }
  }, [user?.id, refreshBasket])

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
    handleManualAddBasketItem,
    handleLoadShoppingList,
    handleRenameLoadedList,
  }
}
