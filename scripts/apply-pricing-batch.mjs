/**
 * Applique un lot d'enrichissement à `src/shared/static/pricing/<year>.json`.
 *
 * Stratégie : merge non-destructif. Chaque entrée du lot est ajoutée au
 * pricing JSON existant. Si un id est déjà présent, il est **écrasé** (le
 * lot devient autoritaire) — utile pour corriger un prix existant.
 *
 * Usage :
 *   node scripts/apply-pricing-batch.mjs --batch <path/to/batch.mjs>
 *   node scripts/apply-pricing-batch.mjs --batch scripts/data/pricing-batch-1-2026.mjs
 *
 * Idempotent : relancer le script avec le même batch produit le même JSON.
 *
 * Le `lastUpdated` est mis à jour à la date courante. Les autres méta
 * (year, source, currencyByLang) sont conservées.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const batchArgIdx = process.argv.indexOf('--batch')
if (batchArgIdx < 0 || !process.argv[batchArgIdx + 1]) {
  console.error('✗ Usage : node scripts/apply-pricing-batch.mjs --batch <path>')
  process.exit(1)
}
const batchPath = resolve(ROOT, process.argv[batchArgIdx + 1])

// Charge le batch (export nommé attendu : { ... } avec n'importe quel nom)
const batchModule = await import(pathToFileURL(batchPath).href)
const batchKey = Object.keys(batchModule).find(k => k !== 'default' && typeof batchModule[k] === 'object')
const batch = batchModule[batchKey]
if (!batch || typeof batch !== 'object') {
  console.error(`✗ Aucun export d'objet trouvé dans ${batchPath}`)
  process.exit(1)
}

// Charge le pricing courant (année active)
const year = new Date().getFullYear()
const pricingPath = resolve(ROOT, 'src/shared/static/pricing', `${year}.json`)
const pricing = JSON.parse(readFileSync(pricingPath, 'utf8'))

// Merge : chaque id du batch écrase ou ajoute dans pricing.prices
let added = 0
let overridden = 0
for (const [id, byLang] of Object.entries(batch)) {
  if (pricing.prices[id]) {
    overridden++
  } else {
    added++
  }
  pricing.prices[id] = byLang
}

// Met à jour la métadonnée lastUpdated
pricing.lastUpdated = new Date().toISOString().slice(0, 10)

writeFileSync(pricingPath, JSON.stringify(pricing, null, 2) + '\n', 'utf8')

console.log(`✓ Lot appliqué : ${batchPath.split(/[/\\]/).pop()}`)
console.log(`  Ajoutés       : ${added}`)
console.log(`  Écrasés       : ${overridden}`)
console.log(`  Total entries pricing : ${Object.keys(pricing.prices).length}`)
console.log(`  lastUpdated   : ${pricing.lastUpdated}`)
console.log(`  Cible         : ${pricingPath}`)
