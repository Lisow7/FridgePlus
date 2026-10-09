// Helpers de lecture rétro-compatible pour les ingrédients d'une recette.
// Refonte Recettes Phase 11.a — D18 schema enrichi.
//
// Format LEGACY (existant) :
//   recipe.ingredients = [{ ids, qty, required }, ...]
//
// Format ENRICHI (futur, optionnel) :
//   recipe.ingredients = {
//     groups: [
//       {
//         name: { fr: "Pour la pâte", en: "For the dough" },
//         items: [{ id, alternatives[], amount, unit, required, notes, prep }]
//       }
//     ],
//     sub_recipes: [{ recipe_id, scale, notes }]
//   }
//
// Les consumers passent par ces helpers pour ne voir qu'une seule forme
// normalisée (groupes), facilitant la migration progressive recette par
// recette.

/**
 * True si la recette utilise le format enrichi (objet avec `groups`).
 * False pour le format legacy (array) ou absent.
 */
export function hasIngredientGroups(recipe) {
  const ing = recipe?.ingredients
  return !!ing && !Array.isArray(ing) && Array.isArray(ing.groups)
}

/**
 * Retourne les groupes d'ingrédients sous forme uniforme.
 * - Format enrichi : retourne `recipe.ingredients.groups` tel quel
 * - Format legacy (array) : wrap en `[{ name: null, items: [...] }]`
 * - Absent : retourne `[]`
 *
 * @returns {Array<{ name: object|null, items: Array }>}
 */
export function getIngredientGroups(recipe) {
  const ing = recipe?.ingredients
  if (!ing) return []
  if (Array.isArray(ing)) {
    return [{ name: null, items: ing }]
  }
  if (Array.isArray(ing.groups)) {
    return ing.groups.map(g => ({
      name: g?.name ?? null,
      items: Array.isArray(g?.items) ? g.items : [],
    }))
  }
  return []
}

/**
 * Retourne tous les items d'ingrédients à plat (tous groupes confondus).
 * Préserve l'ordre des groupes puis l'ordre intra-groupe.
 *
 * Pour les consumers qui n'ont pas besoin du contexte de groupe (ex :
 * scoring contre le stock, calcul coût total, validation orphelin).
 *
 * @returns {Array} items (format hétérogène : legacy `{ids, qty, ...}` ou
 *                  enrichi `{id, alternatives, amount, unit, ...}`)
 */
export function getIngredientItemsFlat(recipe) {
  const groups = getIngredientGroups(recipe)
  const out = []
  for (const g of groups) {
    for (const item of g.items) out.push(item)
  }
  return out
}

/**
 * Retourne la liste des sous-recettes (D19), ou `[]` si absentes ou format legacy.
 *
 * @returns {Array<{ recipe_id, scale, notes }>}
 */
export function getSubRecipes(recipe) {
  const ing = recipe?.ingredients
  if (!ing || Array.isArray(ing)) return []
  return Array.isArray(ing.sub_recipes) ? ing.sub_recipes : []
}

/**
 * Retourne le nom localisé d'un groupe (`{fr, en, ...}`) ou null.
 * Cascade : userLang → fr → première valeur.
 *
 * @param {object|null} groupName - jsonb du nom ou null
 * @param {string} lang - 'fr' / 'en' / etc.
 */
export function pickGroupName(groupName, lang = 'fr') {
  if (!groupName) return null
  if (typeof groupName === 'string') return groupName
  return groupName[lang] ?? groupName.fr ?? Object.values(groupName)[0] ?? null
}

/**
 * Extrait l'ID principal d'un item d'ingrédient, peu importe le format.
 * - Format enrichi v2 : `item.id` (string)
 * - Format legacy : `item.ids[0]` (premier ID du tableau)
 *
 * @returns {string|null}
 */
export function getIngredientId(item) {
  if (!item) return null
  if (item.id) return item.id
  if (Array.isArray(item.ids) && item.ids.length > 0) return item.ids[0]
  return null
}

/**
 * Extrait la quantité d'un item, peu importe le format.
 * - Format enrichi v2 : `{amount: item.amount, unit: item.unit}` (plat)
 * - Format legacy : `item.qty` (objet `{amount, unit}`)
 *
 * @returns {{amount: number, unit: string} | null}
 */
export function getIngredientQty(item) {
  if (!item) return null
  if (item.qty?.amount != null) return item.qty
  if (item.amount != null) return { amount: item.amount, unit: item.unit ?? null }
  return null
}

/**
 * Une ligne d'ingrédient pour le balisage Recipe : « 200 g de Spaghetti »,
 * « 3 Œufs », « Poivre noir ». Le nom vient de la table des ingrédients
 * (`ingredientsById`, une Map id → { labels }), comme sur la fiche ; à défaut,
 * la ligne rédigée de la recette, puis l'identifiant.
 *
 * UNE seule écriture, partagée par le balisage injecté au montage
 * (`recipe-to-schema-org.js`) et par le HTML pré-rendu
 * (`scripts/lib/prerender-page.mjs`) : deux copies d'une même règle finissent
 * par diverger (audit du 2026-10-04, SEO-06). Ce module n'importe rien : un
 * script Node du build peut le lire tel quel.
 */
export function ligneIngredient(item, ingredientsById, lang = 'fr') {
  const baseId = getIngredientIds(item)[0]
  const baseInfo = ingredientsById?.get?.(baseId)
  const nom = baseInfo?.labels?.[lang] ?? baseInfo?.labels?.fr
    ?? item?.labels?.[lang] ?? item?.label ?? baseId ?? ''
  const qty = getIngredientQty(item)
  if (qty?.amount == null) return nom
  const unite = qty.unit && qty.unit !== 'pcs' ? ` ${qty.unit}` : ''
  const separateur = qty.unit === 'pcs' ? ' ' : ' de '
  return `${qty.amount}${unite}${separateur}${nom}`.trim()
}

/**
 * True si l'item est marqué required.
 * Compat 2 formats : `item.required` est le même nom dans les 2.
 */
export function isIngredientRequired(item) {
  return item?.required === true
}

/**
 * Extrait TOUS les IDs candidats d'un item (id principal + alternatives).
 * - Format enrichi v2 : `[item.id, ...item.alternatives]`
 * - Format legacy : `item.ids` (array tel quel)
 *
 * @returns {string[]}
 */
export function getIngredientIds(item) {
  if (!item) return []
  if (Array.isArray(item.ids)) return item.ids
  const out = []
  if (item.id) out.push(item.id)
  if (Array.isArray(item.alternatives)) out.push(...item.alternatives)
  return out
}
