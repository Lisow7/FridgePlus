/**
 * Supprime des entrées de `pricing/<year>.json`.
 *
 * Usage :
 *   node scripts/remove-pricing-entries.mjs --ids id1,id2,id3
 *
 * Idempotent : si un id n'est pas présent, ignore silencieusement.
 *
 * Cas d'usage : nettoyage post-fusion d'ingrédients (cf. v3.43.0 — suppression
 * des doublons sp-miso/gp-algues quand les jp- équivalents prennent le relais).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const idsArgIdx = process.argv.indexOf('--ids')
if (idsArgIdx < 0 || !process.argv[idsArgIdx + 1]) {
  console.error('✗ Usage : node scripts/remove-pricing-entries.mjs --ids <id1,id2,...>')
  process.exit(1)
}
const ids = process.argv[idsArgIdx + 1].split(',').map(s => s.trim()).filter(Boolean)

const year = new Date().getFullYear()
const pricingPath = resolve(ROOT, 'src/shared/static/pricing', `${year}.json`)
const pricing = JSON.parse(readFileSync(pricingPath, 'utf8'))

let removed = 0
const notFound = []
for (const id of ids) {
  if (pricing.prices[id]) {
    delete pricing.prices[id]
    removed++
  } else {
    notFound.push(id)
  }
}

pricing.lastUpdated = new Date().toISOString().slice(0, 10)
writeFileSync(pricingPath, JSON.stringify(pricing, null, 2) + '\n', 'utf8')

console.log(`✓ Suppressions appliquées`)
console.log(`  Demandés       : ${ids.length}`)
console.log(`  Supprimés      : ${removed}`)
if (notFound.length > 0) {
  console.log(`  Non trouvés    : ${notFound.length} (${notFound.join(', ')})`)
}
console.log(`  Total restant  : ${Object.keys(pricing.prices).length}`)
console.log(`  Cible          : ${pricingPath}`)
