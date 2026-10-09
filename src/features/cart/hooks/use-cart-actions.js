import { useCallback } from 'react'
import { supabase } from '@shared/lib/supabase/client'
import { addBasketItems, clearBasket, removeBasketItemsByIds, updateBasketItemsBatch } from '@features/cart/api/basket'
import { toGrams } from '@shared/lib/recipes/recipe-utils'
import { getEmbeddedPrice } from '@shared/lib/pricing/open-prices'

// `stock` est REQUIS en esprit : sans lui, le filtre ci-dessous ne retire plus
// rien et le panier se remplit de ce qu'on possede deja. Un appelant qui
// l'oublierait retomberait donc EXACTEMENT dans le defaut corrige le
// 2026-08-28 — en silence. C'est pourquoi un test verifie que les deux pages
// appelantes le passent reellement (meme parade que le garde budgetaire IA,
// reste debranche trois mois faute d'un test de branchement).
export function useCartActions({ user, basket, stock, lang, ingredientsById, refreshBasket }) {
  const handleManualAdd = useCallback(async (item) => {
    if (!user?.id || !item?.ingredient_id) return { error: { message: 'invalid_args' } }
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
  }, [user, refreshBasket])

  const handleLoadList = useCallback(async (items) => {
    if (!user?.id || !Array.isArray(items)) return { error: { message: 'invalid_args' } }
    // Un vidage refusé arrête tout : sinon la liste s'ajoutait PAR-DESSUS
    // l'ancien panier, et l'écran la disait chargée (relevé le 2026-10-08).
    const { error: erreurVidage } = await clearBasket(user.id)
    if (erreurVidage) return { error: erreurVidage }
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
    return { error: null }
  }, [user, refreshBasket])

  const handleAddToCart = useCallback(async (recipe, selectedServings = recipe.servings ?? 1, { ignoreStock = false } = {}) => {
    if (!user?.id) return
    if ((basket ?? []).some(i => i.recipe_id === recipe.id)) return 'duplicate'
    const scaleFactor = selectedServings / (recipe.servings ?? 1)
    // Ne mettre au panier que ce qui MANQUE : c'est la promesse de
    // l'application. Ce filtre existait dans `app/hooks/use-basket-actions.js`
    // (page d'accueil) et avait ete perdu dans cette copie, faute de recevoir le
    // stock : la condition s'ecrivait `(ignoreStock || true)`, toujours vraie.
    // Meme geste, meme recette, panier different selon l'ecran de depart.
    //
    // `ids?.some` et non `ids.some` : certaines lignes de recette ont un tableau
    // d'identifiants vide.
    const enStock = stock ?? new Set()
    const items = (recipe.ingredients ?? [])
      .filter(ing => ing.required && (ignoreStock || !ing.ids?.some(id => enStock.has(id))))
      .map(ing => {
        const id = ing.ids?.[0]
        const qData = ing.qty
        const rawAmount = qData?.amount ?? null
        const unit = qData?.unit ?? 'g'
        const scaledAmount = rawAmount != null ? Math.round(rawAmount * scaleFactor * 10) / 10 : null
        const grams = qData ? toGrams(qData.amount, qData.unit, id) : 0
        const ingredient = ingredientsById?.get?.(id)
        const price = grams ? Math.round((getEmbeddedPrice(ingredient, lang) ?? 0) * grams / 100 * scaleFactor * 100) / 100 : null
        const label = ing.labels?.[lang] ?? ing.labels?.fr ?? id
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
      .filter(i => i.ingredient_id)
    if (!items.length) return 'all_in_fridge'
    const { error } = await addBasketItems(user.id, items)
    if (!error) await refreshBasket()
  }, [user, basket, stock, lang, ingredientsById, refreshBasket])

  // Finalise les courses :
  //   1. Transfère les ingrédients cochés dans le frigo (user_stock upsert)
  //   2. Supprime uniquement les articles cochés du panier
  //   → les articles non cochés restent dans le panier pour la prochaine fois
  const handleCompleteShopping = useCallback(async (basket) => {
    if (!user?.id) return { error: { message: 'not_authenticated' } }
    const checkedItems = basket.filter(i => i.checked)

    // 1. Ajouter les ingrédients cochés au frigo (upsert — pas de cross-feature import)
    const uniqueIds = [...new Set(checkedItems.map(i => i.ingredient_id).filter(Boolean))]
    if (uniqueIds.length > 0) {
      await supabase.from('user_stock').upsert(
        uniqueIds.map(id => ({ user_id: user.id, ingredient_id: id })),
        { onConflict: 'user_id,ingredient_id', ignoreDuplicates: true }
      )
    }

    // 2. Supprimer uniquement les articles cochés (les non-cochés restent dans le panier)
    const checkedIds = checkedItems.map(i => i.id).filter(Boolean)
    if (checkedIds.length > 0) {
      await removeBasketItemsByIds(checkedIds)
    }

    await refreshBasket()
    return { error: null, addedToFridge: uniqueIds.length }
  }, [user, refreshBasket])

  // Stepper personnes : recalcule les quantités d'une recette via le ratio
  // amount_initial × newServings / recipe_servings_initial (basé sur les
  // valeurs INITIALES pour éviter le drift d'arrondi sur UPDATE successifs).
  const handleUpdateRecipeServings = useCallback(async (recipeId, newServings) => {
    if (!user?.id || !recipeId) return
    const safeServings = Math.max(1, Math.min(12, Math.round(newServings)))
    const items = (basket ?? []).filter(i => i.recipe_id === recipeId)
    if (items.length === 0) return
    const updates = items.map(item => {
      const baseAmount = item.amount_initial ?? item.amount
      const baseServings = item.recipe_servings_initial ?? item.recipe_servings ?? 1
      const ratio = safeServings / baseServings
      const newAmount = Math.round((baseAmount ?? 0) * ratio * 10) / 10
      // Le prix doit suivre la quantité de façon PROPORTIONNELLE et SANS DRIFT.
      // Bug corrigé : avant on faisait price_courant × (servings/baseServings),
      // ce qui COMPOUNDAIT le prix à chaque changement de portions (l'amount,
      // lui, part de amount_initial donc ne driftait pas → désync). On scale
      // désormais le prix par le ratio incrémental newAmount/amount_courant.
      const curAmount = item.amount ?? newAmount
      const newPrice = item.price != null && curAmount > 0
        ? Math.round((item.price * (newAmount / curAmount)) * 100) / 100
        : item.price ?? null
      return {
        id: item.id,
        amount: newAmount,
        price: newPrice,
        recipe_servings: safeServings,
        ...(item.amount_initial == null ? { amount_initial: baseAmount } : {}),
        ...(item.recipe_servings_initial == null ? { recipe_servings_initial: baseServings } : {}),
      }
    })
    const { error } = await updateBasketItemsBatch(updates)
    if (!error) await refreshBasket()
  }, [user, basket, refreshBasket])

  const handleRemoveAllByIngredient = useCallback(async (ingredientId) => {
    if (!user?.id || !ingredientId) return { error: { message: 'invalid_args' } }
    const ids = (basket ?? [])
      .filter(row => row.ingredient_id === ingredientId)
      .map(row => row.id)
      .filter(Boolean)
    if (ids.length === 0) return { error: null, removed: 0 }
    await removeBasketItemsByIds(ids)
    await refreshBasket()
    return { error: null, removed: ids.length }
  }, [user, basket, refreshBasket])

  return { handleManualAdd, handleLoadList, handleAddToCart, handleCompleteShopping, handleRemoveAllByIngredient, handleUpdateRecipeServings }
}
