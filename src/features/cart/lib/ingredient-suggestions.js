// Sélection d'ingrédients suggérés à partir de mots-clés français.
//
// Mutualisé le 2026-07-30 (§2 audit front) : ces quatre fonctions étaient
// dupliquées à l'identique dans `empty-basket-state.jsx` et
// `cart-suggestions-modal.jsx` — sauf `pickDefaultIngredients`, dont les deux
// copies avaient DIVERGÉ (cf. l'option `fill` plus bas). Les fusionner sans le
// voir aurait changé le comportement du modal de suggestions.

export function normalizeFr(s) {
  return (s ?? '').toString().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe')
}

// Index id → ingrédient. On conserve la `subcat` pour pouvoir résoudre le pack
// par défaut au moment du clic sur un chip (cf. handleAddIngredient).
export function buildIngredientIndex(ingredientsByCat) {
  const idx = new Map()
  for (const [subcat, list] of Object.entries(ingredientsByCat ?? {})) {
    if (!Array.isArray(list)) continue
    for (const ing of list) {
      if (ing?.id && !idx.has(ing.id)) idx.set(ing.id, { ...ing, subcat })
    }
  }
  return idx
}

// Détecte les ingrédients qui sont des « têtes de groupe » (un id référencé par
// d'autres via `group_id`). Un parent comme `fr-lait` est une catégorie ; les
// enfants `fr-lait-demi-ecreme`, `fr-lait-entier` sont les ingrédients réels
// qu'on veut suggérer, parce qu'ils ont des packs précis (1 L, 6 × 1 L…) et un
// sens concret au supermarché.
export function buildParentIdSet(ingredientIndex) {
  const parents = new Set()
  for (const ing of ingredientIndex.values()) {
    if (ing.group_id) parents.add(ing.group_id)
  }
  return parents
}

/**
 * Cherche un ingrédient par mot-clé, en préférant un enfant à sa catégorie.
 *
 * @param {Map} ingredientIndex
 * @param {string[]} keywords
 * @param {object} [options]
 * @param {boolean} [options.fill=false] — complète jusqu'à 5 avec n'importe
 *   quels ingrédients quand les mots-clés n'ont pas suffi. C'était la SEULE
 *   différence entre les deux copies historiques : l'empty state du panier
 *   remplit (il doit toujours proposer 5 chips pour ne pas paraître cassé), le
 *   modal de suggestions non (il affiche ce qu'il a trouvé, sans bouche-trou).
 *   Défaut `false` = comportement du modal, pour que l'option soit explicite
 *   côté appelant qui remplit.
 */
export function pickDefaultIngredients(ingredientIndex, keywords, { fill = false } = {}) {
  const parentIds = buildParentIdSet(ingredientIndex)
  const out = []
  const seenIds = new Set()

  const findFor = (keyword) => {
    const norm = normalizeFr(keyword)
    let parentMatch = null
    for (const ing of ingredientIndex.values()) {
      if (seenIds.has(ing.id)) continue
      const labelFr = normalizeFr(ing.labels?.fr)
      if (!labelFr.includes(norm)) continue
      if (parentIds.has(ing.id)) { if (!parentMatch) parentMatch = ing; continue }
      return ing
    }
    return parentMatch
  }

  for (const keyword of keywords) {
    const ing = findFor(keyword)
    if (ing) { out.push(ing); seenIds.add(ing.id) }
    if (out.length >= 5) break
  }

  if (fill && out.length < 5) {
    for (const ing of ingredientIndex.values()) {
      if (out.length >= 5) break
      if (seenIds.has(ing.id)) continue
      if (parentIds.has(ing.id)) continue  // pas de catégorie parente en bouche-trou
      out.push(ing)
      seenIds.add(ing.id)
    }
  }

  return out
}
