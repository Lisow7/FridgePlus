// Helpers pour exporter le JSON pricing modifié.
//
// Extraction de la logique inline du PricingSection (Phase H.2) en fonctions
// pures testables. Permet de :
//   - Fiabiliser le format du JSON exporté
//   - Tester les cas limites (edits vides, override partiel par lang, etc.)
//   - Réutiliser la logique de merge dans d'autres contextes (CLI, future API)
//
// Aucune dépendance React — tout en pur JS.

/**
 * Merge un set d'edits utilisateur dans un objet pricing existant.
 *
 * Format des edits : `{ [ingredientId]: { fr: [packs], en: [...], ... } }`
 * — chaque entrée override complètement les packs de l'ingrédient pour
 * toutes les langues fournies.
 *
 * Met à jour `lastUpdated` à la date courante (ISO `YYYY-MM-DD`).
 *
 * @param {object} basePricing - Pricing actuel avec `{ year, lastUpdated, source, currencyByLang, prices }`
 * @param {object} edits        - Map { ingredientId: newPacksByLang }
 * @param {Date}   [now]        - Pour tests : injectable, défaut `new Date()`
 * @returns {object} Nouveau pricing JSON prêt pour download/écriture
 */
export function mergePricingEdits(basePricing, edits, now = new Date()) {
  if (!basePricing || typeof basePricing !== 'object') {
    throw new TypeError('mergePricingEdits: basePricing must be an object')
  }
  const safeEdits = edits ?? {}
  const merged = {
    ...basePricing,
    lastUpdated: now.toISOString().slice(0, 10),
    prices: { ...(basePricing.prices ?? {}) },
  }
  for (const [id, newPacksByLang] of Object.entries(safeEdits)) {
    if (!id || typeof newPacksByLang !== 'object' || newPacksByLang === null) continue
    merged.prices[id] = newPacksByLang
  }
  return merged
}

/**
 * Sérialise un objet pricing pour téléchargement. Format identique à celui
 * généré par `scripts/generate-pricing-json.mjs` (indenté 2 espaces +
 * newline final) pour minimiser le diff Git.
 *
 * @param {object} pricing
 * @returns {string} JSON formaté
 */
export function formatPricingForDownload(pricing) {
  return JSON.stringify(pricing, null, 2) + '\n'
}

/**
 * Renvoie le nom de fichier suggéré pour le téléchargement.
 * Convention identique au generator : `pricing-<year>.json`.
 *
 * @param {object} pricing
 * @returns {string}
 */
export function getDownloadFilename(pricing) {
  const year = pricing?.year ?? new Date().getFullYear()
  return `pricing-${year}.json`
}

/**
 * Compte le nombre d'ingrédients dans un objet pricing. Utile pour les
 * stats d'export et la validation post-merge.
 *
 * @param {object} pricing
 * @returns {number}
 */
export function countPricedIngredients(pricing) {
  return Object.keys(pricing?.prices ?? {}).length
}

/**
 * Vérifie si un set d'edits est valide (tous les prix sont des nombres > 0).
 * Pour validation côté UI avant d'activer le bouton « Télécharger ».
 *
 * @param {object} edits
 * @returns {{ valid: boolean, errors: Array<{id, lang, packIdx, reason}> }}
 */
export function validateEdits(edits) {
  const errors = []
  if (!edits || typeof edits !== 'object') return { valid: true, errors }
  for (const [id, byLang] of Object.entries(edits)) {
    if (!byLang || typeof byLang !== 'object') {
      errors.push({ id, lang: null, packIdx: null, reason: 'invalid_packs_object' })
      continue
    }
    for (const [lang, packs] of Object.entries(byLang)) {
      if (!Array.isArray(packs)) continue
      for (let i = 0; i < packs.length; i++) {
        const p = packs[i]
        if (!p || typeof p !== 'object') {
          errors.push({ id, lang, packIdx: i, reason: 'invalid_pack' })
          continue
        }
        if (!Number.isFinite(p.price) || p.price <= 0) {
          errors.push({ id, lang, packIdx: i, reason: 'invalid_price' })
        }
        if (!p.unit) errors.push({ id, lang, packIdx: i, reason: 'missing_unit' })
        if (!Number.isFinite(p.size) || p.size <= 0) {
          errors.push({ id, lang, packIdx: i, reason: 'invalid_size' })
        }
      }
    }
  }
  return { valid: errors.length === 0, errors }
}
