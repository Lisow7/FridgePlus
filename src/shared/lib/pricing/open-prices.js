import { embeddedPricePer100g } from '@shared/lib/recipes/recipe-utils'

const CACHE_KEY = 'fridge-prices-cache'
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

const COUNTRY_ISO = { fr: 'FR', en: 'GB', es: 'ES', de: 'DE', ja: 'JP' }

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') }
  catch { return {} }
}

function writeCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

function getCached(ingredientId, lang) {
  const cache = readCache()
  const entry = cache[`${ingredientId}_${lang}`]
  if (!entry) return null
  if (Date.now() - entry.ts > TTL_MS) return null
  return entry.price
}

function setCached(ingredientId, lang, price) {
  const cache = readCache()
  cache[`${ingredientId}_${lang}`] = { price, ts: Date.now() }
  writeCache(cache)
}

// Retourne le prix €/100g d'un ingrédient. `ingredient.price` est stocké en
// BDD sous forme de TABLEAU de packs `{ fr: [{size,unit,price}], … }` (depuis
// la refonte BDD 2026-05) — on délègue la dérivation €/100g à recipe-utils
// (gère aussi l'ancien format scalaire). N'appelle PAS l'API.
// (Pas de cycle d'import : recipe-utils n'importe pas open-prices.)
export function getEmbeddedPrice(ingredient, lang = 'fr') {
  return embeddedPricePer100g(ingredient, lang, ingredient?.id)
}

// Tente de récupérer un prix €/100g depuis Open Prices API (v3.93.0).
// Calcul fiable uniquement quand product_quantity (grammes) est disponible.
// Retourne null si pas de donnée utilisable → l'appelant doit prévoir un fallback.
// Cache localStorage 24h pour éviter les appels répétés.
export async function fetchLivePrice(ingredientId, productName, lang = 'fr') {
  const cached = getCached(ingredientId, lang)
  if (cached !== null) return cached

  const country = COUNTRY_ISO[lang] ?? 'FR'
  try {
    const url = `https://prices.openfoodfacts.org/api/v1/prices?product_name=${encodeURIComponent(productName)}&location_country=${country}&page_size=20`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    const items = data.items ?? []
    if (!items.length) return null

    // €/100g = price / product_quantity * 100 (product_quantity en grammes/ml)
    // On exclut les entrées sans quantité produit (impossible de normaliser).
    const pricesPer100g = items
      .filter(i => typeof i.price === 'number' && i.price > 0)
      .map(i => {
        const qty = i.product?.product_quantity
        if (!qty || qty <= 0) return null
        return (i.price / qty) * 100
      })
      .filter(p => p !== null && p > 0.01 && p < 100) // filtre aberrants (< 1c ou > 100€/100g)
      .sort((a, b) => a - b)

    if (!pricesPer100g.length) return null

    const median = pricesPer100g[Math.floor(pricesPer100g.length / 2)]
    const price100g = Math.round(median * 100) / 100
    setCached(ingredientId, lang, price100g)
    return price100g
  } catch {
    return null
  }
}

// Rafraîchit les prix d'une liste d'ingrédients en batch.
// Chaque entrée : { id, labelFr }
// Retourne un objet { ingredientId: price } — ne contient que les IDs avec données exploitables.
export async function refreshPrices(ingredients, lang = 'fr') {
  const results = {}
  await Promise.allSettled(
    ingredients.map(async ({ id, labelFr }) => {
      const price = await fetchLivePrice(id, labelFr, lang)
      if (price !== null) results[id] = price
    })
  )
  return results
}

export function clearPriceCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}
