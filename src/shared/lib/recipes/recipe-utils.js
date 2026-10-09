import { getGramsPer } from '@shared/static/ingredient-unit-hints'
import { PACK_SIZES } from '@shared/static/pack-sizes'
import { getIngredientItemsFlat, getIngredientQty, getIngredientIds, isIngredientRequired } from './recipe-ingredients'
import { formatPrix } from '@shared/lib/i18n/prix'

// Dérive un prix €/100g depuis un tableau de packs `{size, unit, price}`
// (on prend le pack le moins cher au gramme). Retourne null si aucun pack
// n'est convertible en grammes. Partagé entre prix BDD et fallback PACK_SIZES.
export function pricePer100gFromPacks(packs, ingredientId = null) {
  if (!Array.isArray(packs) || packs.length === 0) return null
  let minPpg = null
  for (const pack of packs) {
    const pg = toGrams(pack.size, pack.unit, ingredientId)
    if (!pg || !(pack.price > 0)) continue
    const ppg = pack.price / pg * 100
    if (minPpg === null || ppg < minPpg) minPpg = ppg
  }
  return minPpg
}

// €/100g depuis `ingredient.price` (colonne BDD).
// Depuis la refonte BDD (2026-05) le format est un TABLEAU de packs
// `{ fr: [{size,unit,price}], … }` — on en dérive le €/100g. On garde une
// compat avec l'ancien format scalaire (un nombre €/100g) par sécurité.
export function embeddedPricePer100g(ingredient, lang = 'fr', ingredientId = null) {
  const data = ingredient?.price?.[lang] ?? ingredient?.price?.fr
  if (data == null) return null
  if (typeof data === 'number') return data > 0 ? data : null
  if (Array.isArray(data)) return pricePer100gFromPacks(data, ingredientId ?? ingredient?.id)
  return null
}

// Helper pour récupérer le prix unitaire (€/100g) d'un ingrédient.
// Ordre de priorité : 1) prix BDD, 2) PACK_SIZES (pack le moins cher).
function getUnitPrice(ingredientsById, ids, lang) {
  if (!ids?.length) return null
  for (const id of ids) {
    // 1. Prix BDD (tableau de packs → €/100g)
    const ing = ingredientsById?.get?.(id) ?? ingredientsById?.[id]
    const dbPrice = embeddedPricePer100g(ing, lang, id)
    if (dbPrice > 0) return { id, price: dbPrice }
    // 2. Fallback PACK_SIZES
    const ppg = pricePer100gFromPacks(PACK_SIZES[id]?.[lang] ?? PACK_SIZES[id]?.fr, id)
    if (ppg > 0) return { id, price: ppg }
  }
  return null
}

// Convertit une quantité en grammes pour le calcul de coût.
// Les unités-pièce (gousse, branche, sachet, tranche, unité…) sont résolues
// via le mapping ingredientUnitHints — passer ingredientId quand disponible.
export function toGrams(amount, unit, ingredientId = null) {
  if (!amount || unit === 'pm' || unit === 'PM') return 0
  if (unit === 'g')  return amount
  if (unit === 'kg') return amount * 1000
  if (unit === 'cl') return amount * 10
  if (unit === 'ml') return amount
  if (unit === 'L')  return amount * 1000
  if (unit === 'pcs') return amount * 100  // legacy : pièce générique sans hint
  // Unités-pièce / sachets / tranches : résolues via gramsPer si ingrédient connu
  if (ingredientId) {
    const g = getGramsPer(ingredientId, unit)
    if (g) return amount * g
  }
  return 0
}

// Devise par langue
const CURRENCY = { fr: '€', en: '£', es: '€', de: '€', ja: '¥' }
export function getCurrency(lang) { return CURRENCY[lang] ?? '€' }

// Calcule le coût total d'une recette (en unité monétaire locale).
// scaleFactor = selectedServings / recipe.servings (1 par défaut)
// ingredientsById = Map<id, ingredient> (depuis useIngredientsById()) — fournit
// les prix par 100g via ingredient.price[lang].
// Supporte le format legacy `[{ ids, qty }]` et le format enrichi v2 `{ groups }`.
export function calcRecipeCost(recipe, lang = 'fr', scaleFactor = 1, ingredientsById = null) {
  let total = 0
  let hasPrice = false

  for (const ing of getIngredientItemsFlat(recipe)) {
    const ids = getIngredientIds(ing)
    const found = getUnitPrice(ingredientsById, ids, lang)
    if (!found) continue

    const qData = getIngredientQty(ing)
    if (!qData) continue

    const grams = toGrams(qData.amount, qData.unit, found.id)
    if (!grams) continue

    total += (found.price * grams) / 100
    hasPrice = true
  }

  if (!hasPrice || !Number.isFinite(total)) return null
  return Math.round(total * scaleFactor * 100) / 100
}

// Calcule le coût uniquement des ingrédients manquants (required, non en stock).
// Supporte le format legacy `[{ ids, qty }]` et le format enrichi v2 `{ groups }`.
export function calcMissingCost(recipe, stock, lang = 'fr', scaleFactor = 1, ingredientsById = null) {
  let total = 0
  let hasPrice = false

  for (const ing of getIngredientItemsFlat(recipe)) {
    if (!isIngredientRequired(ing)) continue
    const ids = getIngredientIds(ing)
    if (ids.some(id => stock.has(id))) continue // déjà en stock

    const found = getUnitPrice(ingredientsById, ids, lang)
    if (!found) continue

    const qData = getIngredientQty(ing)
    if (!qData) continue

    const grams = toGrams(qData.amount, qData.unit, found.id)
    if (!grams) continue

    total += (found.price * grams) / 100
    hasPrice = true
  }

  if (!hasPrice || !Number.isFinite(total)) return null
  return Math.round(total * scaleFactor * 100) / 100
}

// ─── P12.a — Calcul coût multi-modes ────────────────────────────────────────
// 3 modes MVP (mode 'shopping' pack-aware différé P12.b après migration
// pack-optimizer vers shared/) :
//   - 'total'       : coût total brut de la recette
//   - 'per_serving' : total / recipe.servings (comparaison entre recettes)
//   - 'marginal'    : coût des ingrédients required NON en stock (frigo-aware)
//
// Q Factor (food cost industry standard, cf. theculinarypro.com) :
//   - Multiplicateur optionnel pour intégrer pertes épluchage/déchets/oublis
//   - Conventionnellement 1.05 (sit-down restaurant) à 1.10 (large waste)
//   - Domestique : 1.00 par défaut (l'user contrôle plus son gaspi)

export const COST_MODES = Object.freeze({
  TOTAL:       'total',
  PER_SERVING: 'per_serving',
  MARGINAL:    'marginal',
})

/**
 * Calcule le coût d'une recette selon un mode (D20 simplifié).
 *
 * @param {Object} recipe         - Recette (format legacy ou v2)
 * @param {Object} options
 * @param {string} options.mode   - 'total' | 'per_serving' | 'marginal' (default 'total')
 * @param {string} [options.lang='fr']
 * @param {number} [options.scaleFactor=1]    - Mult portions (default 1)
 * @param {number} [options.qFactor=1]        - Mult waste/pertes (default 1, neutre)
 * @param {Map|Object} [options.ingredientsById] - Catalogue ingrédients
 * @param {Set} [options.stock]   - Requis si mode='marginal' (sinon erreur silencieuse → null)
 * @returns {number|null}  Coût arrondi à 2 décimales, ou null si pas de prix
 */
export function calcRecipeCostByMode(recipe, {
  mode = COST_MODES.TOTAL,
  lang = 'fr',
  scaleFactor = 1,
  qFactor = 1,
  ingredientsById = null,
  stock = null,
} = {}) {
  let baseCost = null

  if (mode === COST_MODES.MARGINAL) {
    if (!stock) return null
    baseCost = calcMissingCost(recipe, stock, lang, scaleFactor, ingredientsById)
  } else {
    // 'total' et 'per_serving' partent du même coût total
    baseCost = calcRecipeCost(recipe, lang, scaleFactor, ingredientsById)
  }

  if (baseCost == null) return null

  if (mode === COST_MODES.PER_SERVING) {
    const servings = recipe?.servings
    if (!servings || servings <= 0) return null
    baseCost = baseCost / servings
  }

  // Q Factor (waste/pertes) — n'altère pas le calcul si qFactor=1
  if (qFactor !== 1) {
    baseCost = baseCost * qFactor
  }

  return Math.round(baseCost * 100) / 100
}

export function formatPrice(value, lang = 'fr') {
  if (!Number.isFinite(value) || value < 0) return null
  // Les deux langues servies passent par `Intl` (« 4,99 € » / « €4.99 » —
  // audit du 2026-10-04, UX-15) ; les autres, héritées, gardent leur monnaie.
  if (lang === 'fr' || lang === 'en') return formatPrix(value, lang, { approx: true })
  const currency = getCurrency(lang)
  if (lang === 'ja') return `~${Math.round(value)}${currency}`
  return `~${value.toFixed(2)}${currency}`
}

// Pluriel des unités (au-delà de 1, donc à partir de 2). Indexé par langue
// puis par clé d'unité ; chaque entrée = [singulier, pluriel].
// Les clés couvrent à la fois les codes utilisés dans recipes.js (gousse, tete…)
// et les libellés utilisés dans le form de création (unité(s), pincée(s)…).
const UNIT_FORMS = {
  fr: {
    'unité':       ['pièce',     'pièces'],
    'unité(s)':    ['pièce',     'pièces'],
    'pincée':      ['pincée',    'pincées'],
    'pincée(s)':   ['pincée',    'pincées'],
    'sachet':      ['sachet',    'sachets'],
    'botte':       ['botte',     'bottes'],
    'tasse':       ['tasse',     'tasses'],
    'gousse':      ['gousse',    'gousses'],
    'tete':        ['tête',      'têtes'],
    'tête':        ['tête',      'têtes'],
    'tranche':     ['tranche',   'tranches'],
    'branche':     ['branche',   'branches'],
    'feuille':     ['feuille',   'feuilles'],
    'cs':          ['c. à s.',   'c. à s.'],
    'cc':          ['c. à c.',   'c. à c.'],
    'c. à café':   ['c. à café', 'c. à café'],
    'c. à soupe':  ['c. à soupe','c. à soupe'],
    'verre':       ['verre',     'verres'],
    'bol':         ['bol',       'bols'],
    'pot':         ['pot',       'pots'],
    'louche':      ['louche',    'louches'],
    'carré':       ['carré',     'carrés'],
    'tablette':    ['tablette',  'tablettes'],
    'morceau':     ['morceau',   'morceaux'],
    'noix':        ['noix',      'noix'],
    'goutte':      ['goutte',    'gouttes'],
    'PM':          ['',          ''],
    'pm':          ['',          ''],
  },
  en: {
    'unit':        ['unit',     'units'],
    'unit(s)':     ['unit',     'units'],
    'unité':       ['unit',     'units'],
    'unité(s)':    ['unit',     'units'],
    'pinch':       ['pinch',    'pinches'],
    'pinch(es)':   ['pinch',    'pinches'],
    'pincée':      ['pinch',    'pinches'],
    'pincée(s)':   ['pinch',    'pinches'],
    'packet':      ['packet',   'packets'],
    'sachet':      ['packet',   'packets'],
    'bunch':       ['bunch',    'bunches'],
    'botte':       ['bunch',    'bunches'],
    'cup':         ['cup',      'cups'],
    'tasse':       ['cup',      'cups'],
    'clove':       ['clove',    'cloves'],
    'gousse':      ['clove',    'cloves'],
    'head':        ['head',     'heads'],
    'tete':        ['head',     'heads'],
    'tête':        ['head',     'heads'],
    'slice':       ['slice',    'slices'],
    'tranche':     ['slice',    'slices'],
    'sprig':       ['sprig',    'sprigs'],
    'branche':     ['sprig',    'sprigs'],
    'leaf':        ['leaf',     'leaves'],
    'feuille':     ['leaf',     'leaves'],
    'tsp':         ['tsp',      'tsp'],
    'cc':          ['tsp',      'tsp'],
    'tbsp':        ['tbsp',     'tbsp'],
    'cs':          ['tbsp',     'tbsp'],
    'glass':       ['glass',    'glasses'],
    'verre':       ['glass',    'glasses'],
    'bowl':        ['bowl',     'bowls'],
    'bol':         ['bowl',     'bowls'],
    'jar':         ['jar',      'jars'],
    'pot':         ['jar',      'jars'],
    'ladle':       ['ladle',    'ladles'],
    'louche':      ['ladle',    'ladles'],
    'square':      ['square',   'squares'],
    'carré':       ['square',   'squares'],
    'bar':         ['bar',      'bars'],
    'tablette':    ['bar',      'bars'],
    'piece':       ['piece',    'pieces'],
    'morceau':     ['piece',    'pieces'],
    'knob':        ['knob',     'knobs'],
    'noix':        ['knob',     'knobs'],
    'drop':        ['drop',     'drops'],
    'goutte':      ['drop',     'drops'],
    'to taste':    ['',         ''],
  },
}

// Renvoie le libellé d'unité adapté à la quantité (singulier <2, pluriel ≥2)
// dans la langue demandée. Renvoie l'unité brute si aucune correspondance.
export function localizeUnit(amount, unit, lang = 'fr') {
  if (!unit) return ''
  const map = UNIT_FORMS[lang] ?? UNIT_FORMS.fr
  const forms = map[unit]
  if (!forms) return unit
  return amount >= 2 ? forms[1] : forms[0]
}

// Format quantité + unité, en gérant les conversions g→kg / cl→L et la
// pluralisation des unités texte (gousse(s), tranche(s), unité(s)…).
export function formatQty(amount, unit, lang = 'fr') {
  if (amount == null || unit === 'pm' || unit === 'PM' || unit === 'to taste' || unit === 'al gusto' || unit === 'nach Geschmack' || unit === '適量') return null
  if (unit === 'g') {
    if (amount >= 1000) {
      const kg = amount / 1000
      return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`
    }
    return `${amount} g`
  }
  if (unit === 'cl') {
    if (amount >= 100) {
      const l = amount / 100
      return `${Number.isInteger(l) ? l : l.toFixed(1)} L`
    }
    return `${amount} cl`
  }
  if (unit === 'pcs') {
    // Cas spéciaux : ½ poivron, 1½ pomme — la fraction parle d'elle-même
    if (amount === 0.5) return '½'
    if (amount === 1.5) return '1½'
    // Sinon on affiche le nombre + "unité(s)" / "unit(s)" / etc. avec pluriel adaptatif
    const localized = localizeUnit(amount, 'unité', lang)
    return localized ? `${amount} ${localized}` : `${amount}`
  }
  if (['g','kg','ml','cl','L','mL'].includes(unit)) return `${amount} ${unit}`
  const localized = localizeUnit(amount, unit, lang)
  return localized ? `${amount} ${localized}` : `${amount}`
}
