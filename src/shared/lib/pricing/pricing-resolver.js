// Phase D : résolveur pricing avec override JSON.
//
// Stratégie :
//   1. `src/data/pricing/<year>.json` est la **source de vérité** pour les
//      prix grande surface (référence grande surface FR, estimations
//      annuelles à éditer manuellement ou via la future UI admin Phase H).
//   2. `src/data/packSizes.js` reste autoritaire pour la **structure** des
//      packs (sizes/units) qui change rarement. Si un pack est dans le JSON
//      pour cette année, le prix vient du JSON. Sinon fallback sur le prix
//      du JS (valeur historique).
//   3. Le millésime utilisé est l'année courante (configurable via
//      `setActivePricingYear` pour les tests).
//
// Pourquoi un overlay plutôt qu'une migration directe ?
//   • Pas de point de non-retour : si le JSON est manquant/buggé, on retombe
//     sur les prix du JS.
//   • Permet d'archiver les années passées (pricing/2025.json,
//     pricing/2026.json, etc.) et de comparer dans le temps.
//   • Compatible avec une UI admin future qui éditera uniquement le JSON
//     courant sans toucher au code source.

// Import dynamique : on essaie d'importer le JSON de l'année courante. S'il
// n'existe pas (cas pré-2026 ou édition partielle), on tombe en mode "no
// override" et tous les prix viennent de packSizes.js.
import pricing2026 from '@shared/static/pricing/2026.json'

const PRICING_BY_YEAR = {
  2026: pricing2026,
}

let _activeYear = new Date().getFullYear()

/**
 * Permet de forcer une année active (utile pour les tests, ou pour préviewer
 * une mise à jour de prix future avant publication).
 * @param {number} year
 */
export function setActivePricingYear(year) {
  if (Number.isInteger(year) && PRICING_BY_YEAR[year]) {
    _activeYear = year
  }
}

/**
 * @returns {number} l'année de pricing active
 */
export function getActivePricingYear() {
  // Si l'année courante n'a pas de JSON, on retombe sur la plus récente dispo.
  if (PRICING_BY_YEAR[_activeYear]) return _activeYear
  const years = Object.keys(PRICING_BY_YEAR).map(Number).sort((a, b) => b - a)
  return years[0] ?? _activeYear
}

/**
 * @returns {{year:number, lastUpdated:string, source:string}|null}
 *   Métadonnées du pricing actif (utile pour afficher dans le footer/admin).
 */
export function getPricingMeta() {
  const y = getActivePricingYear()
  const data = PRICING_BY_YEAR[y]
  if (!data) return null
  return {
    year: data.year,
    lastUpdated: data.lastUpdated,
    source: data.source,
  }
}

/**
 * Renvoie les packs avec prix d'un ingrédient pour une langue donnée.
 *
 * Stratégie de résolution :
 *   1. Si `pricing/<year>.json` contient cet ingrédient et cette langue,
 *      on renvoie les packs du JSON (source de vérité).
 *   2. Sinon, le caller doit utiliser `PACK_SIZES[id][lang]` (fallback JS).
 *
 * @param {string} id
 * @param {string} [lang='fr']
 * @returns {Array<{size:number, unit:string, price:number}>|null}
 *   La liste des packs du JSON pricing, ou `null` si l'ingrédient/lang n'est
 *   pas couvert par le JSON. Le caller fait alors fallback sur packSizes.js.
 */
export function getOverridePacks(id, lang = 'fr') {
  if (!id) return null
  const pricing = PRICING_BY_YEAR[getActivePricingYear()]
  if (!pricing) return null
  const langs = pricing.prices?.[id]
  if (!langs) return null
  // Fallback fr si la langue demandée n'est pas dans le JSON pour cet ID.
  return langs[lang] ?? langs.fr ?? null
}

/**
 * Helper pour `packOptimizer` et `getFullIngredient` — renvoie les packs
 * effectifs (JSON override OR JS fallback) pour un ingrédient.
 *
 * @param {string} id
 * @param {object} packSizesEntry  - PACK_SIZES[id] depuis packSizes.js
 * @param {string} [lang='fr']
 * @returns {Array<{size:number, unit:string, price:number}>|null}
 */
export function resolvePacks(id, packSizesEntry, lang = 'fr') {
  const override = getOverridePacks(id, lang)
  if (override?.length > 0) return override
  return packSizesEntry?.[lang] ?? packSizesEntry?.fr ?? null
}

/**
 * Liste les années de pricing disponibles (utile pour un sélecteur admin).
 * @returns {number[]} années triées descendantes
 */
export function listAvailablePricingYears() {
  return Object.keys(PRICING_BY_YEAR).map(Number).sort((a, b) => b - a)
}
