// Recalcul proportionnel des quantités d'ingrédients (scaling par portions).
// Pur/immutable. N'altère QUE qty.amount ; préserve ids, unit, labels, required.
// Les libellés affichés ne sont pas réécrits (éditables à la main — cf invariant).

const round2 = (x) => Math.round(x * 100) / 100

export function scaleQuantities(ingredients, factor) {
  if (!Array.isArray(ingredients) || !(factor > 0) || factor === 1) return ingredients
  return ingredients.map((slot) => {
    const amount = slot?.qty?.amount
    if (amount == null || typeof amount !== 'number') return slot
    return { ...slot, qty: { ...slot.qty, amount: round2(amount * factor) } }
  })
}

export function scaleToServings(ingredients, from, to) {
  if (!(from > 0) || !(to > 0)) return ingredients
  return scaleQuantities(ingredients, to / from)
}
