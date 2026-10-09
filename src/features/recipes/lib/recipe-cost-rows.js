import { getIngredientItemsFlat, getIngredientIds, getIngredientQty, isIngredientRequired } from '@shared/lib/recipes/recipe-ingredients'
import { embeddedPricePer100g, toGrams as sharedToGrams, formatQty } from '@shared/lib/recipes/recipe-utils'
import { PACK_SIZES } from '@shared/static/pack-sizes'

// Résolution du prix par ingrédient pour l'onglet Coût du RecipeModal.
// Extrait verbatim de recipe-modal.jsx (2026-07-25, audit front §2) : logique
// pure et testable, sans changement de comportement. Priorité de résolution du
// prix unitaire (€/100 g) : 1) prix BDD embarqué → 2) prix live Open Prices →
// 3) fallback PACK_SIZES (pack le moins cher).
//
// Retourne, par ingrédient : { label, qtyStr, itemPrice, inStock, required, isLive }.
export function computeCostRows({ recipe, lang, ingredientsById, livePrices, scaleFactor, stock }) {
  return getIngredientItemsFlat(recipe).map(ing => {
    const ingIds = getIngredientIds(ing)
    let priceId = null, unitPricePer100g = null, isLive = false
    for (const iid of ingIds) {
      // 1. Prix BDD (tableau de packs → €/100g)
      const ingredient = ingredientsById?.get?.(iid) ?? ingredientsById?.[iid]
      const dbPrice = embeddedPricePer100g(ingredient, lang, iid)
      if (dbPrice > 0) { priceId = iid; unitPricePer100g = dbPrice; break }
      // 2. Prix live Open Prices (€/100g calculé via product_quantity)
      const liveP = livePrices?.[iid]
      if (liveP > 0) { priceId = iid; unitPricePer100g = liveP; isLive = true; break }
      // 3. Fallback PACK_SIZES → dérivé €/100g depuis le pack le moins cher
      const packs = PACK_SIZES[iid]?.[lang] ?? PACK_SIZES[iid]?.fr
      if (packs?.length) {
        let minPpg = null
        for (const pack of packs) {
          const pg = sharedToGrams(pack.size, pack.unit, iid)
          if (!pg) continue
          const ppg = pack.price / pg * 100
          if (minPpg === null || ppg < minPpg) minPpg = ppg
        }
        if (minPpg > 0) { priceId = iid; unitPricePer100g = minPpg; break }
      }
    }
    const id = priceId ?? ingIds[0]
    const qData = getIngredientQty(ing)
    const scaledAmount = qData?.amount != null ? Math.round(qData.amount * scaleFactor * 10) / 10 : null
    const grams = qData ? sharedToGrams(qData.amount, qData.unit, id) : 0
    const rawPrice = unitPricePer100g && grams ? Math.round(unitPricePer100g * grams / 100 * scaleFactor * 100) / 100 : null
    const itemPrice = (rawPrice != null && Number.isFinite(rawPrice) && rawPrice > 0) ? rawPrice : null
    const qtyStr = scaledAmount != null ? formatQty(scaledAmount, qData.unit, lang) : null
    const inStock = ingIds.some(iid => stock.has(iid))
    const label = ing.labels?.[lang] ?? ing.labels?.fr ?? id
    return { label, qtyStr, itemPrice, inStock, required: isIngredientRequired(ing), isLive }
  })
}
