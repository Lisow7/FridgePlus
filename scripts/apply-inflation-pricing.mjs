/**
 * apply-inflation-pricing.mjs — Phase 2 Fridge+ (v3.120.0)
 *
 * Applique les indices d'inflation Eurostat HICP (CC-BY 4.0) aux prix
 * du panier Fridge+ pour générer le batch annuel de mise à jour.
 *
 * Source : Eurostat HICP — CC-BY 4.0
 *   https://ec.europa.eu/eurostat/web/hicp/data/database
 *
 * Usage :
 *   npm run pricing:inflate -- --from 2026 --to 2027         # dry-run (défaut)
 *   npm run pricing:inflate -- --from 2026 --to 2027 --write  # écrit le batch
 *
 * Sortie dry-run : rapport stdout "X prix ajustés, +Y% moyenne"
 * Sortie --write : scripts/data/pricing-update-YYYY-jan.mjs
 *
 * @readonly Par défaut (--dry). Modifie le filesystem uniquement avec --write.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Arguments CLI ────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const fromYear = parseInt(args[args.indexOf('--from') + 1] || '0', 10)
const toYear   = parseInt(args[args.indexOf('--to')   + 1] || '0', 10)
const writeMode = args.includes('--write')

if (!fromYear || !toYear || toYear <= fromYear) {
  console.error('✗ Usage : npm run pricing:inflate -- --from <YYYY> --to <YYYY+1> [--write]')
  console.error('  Exemple : npm run pricing:inflate -- --from 2026 --to 2027')
  process.exit(1)
}

// ─── Chargement du mapping et du pricing courant ──────────────────────────────

const mappingPath = resolve(__dirname, 'data', 'eurostat-mapping.json')
const pricingPath = resolve(ROOT, 'src', 'data', 'pricing', `${fromYear}.json`)

const { categories } = JSON.parse(readFileSync(mappingPath, 'utf8'))
const pricing = JSON.parse(readFileSync(pricingPath, 'utf8'))
const ingredientIds = Object.keys(pricing.prices)

// ─── Fetch Eurostat HICP (indices annuels moyens) ────────────────────────────
// Dataset : prc_hicp_aind (annual average indices, base 2015=100)
// Filtre : geo=FR, coicop=<code>, time=fromYear,toYear

async function fetchHicp(coicop) {
  const url = [
    'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_aind',
    `?unit=I15&coicop=${coicop}&geo=FR&time=${fromYear},${toYear}`,
  ].join('')

  let res
  try {
    res = await fetch(url)
  } catch (e) {
    throw new Error(`Réseau inaccessible pour ${coicop} : ${e.message}`)
  }
  if (!res.ok) throw new Error(`Eurostat HTTP ${res.status} pour ${coicop}`)

  const json = await res.json()

  // Format JSON-stat : les valeurs sont dans json.value[], les labels de temps
  // dans json.dimension.time.category.index (clé → position dans value[]).
  const timeIndex = json.dimension?.time?.category?.index ?? {}
  const values    = json.value ?? {}

  const posFrom = timeIndex[String(fromYear)]
  const posTo   = timeIndex[String(toYear)]

  if (posFrom === undefined || posTo === undefined) {
    throw new Error(
      `Indices manquants pour ${coicop} : from=${fromYear}(pos:${posFrom}) to=${toYear}(pos:${posTo}). ` +
      `Les données Eurostat peuvent ne pas encore être disponibles pour ${toYear}.`
    )
  }

  const indexFrom = values[posFrom]
  const indexTo   = values[posTo]

  if (!indexFrom || !indexTo) {
    throw new Error(`Valeurs nulles pour ${coicop} : from=${indexFrom} to=${indexTo}`)
  }

  return { coicop, indexFrom, indexTo, ratio: indexTo / indexFrom }
}

// ─── Catégorisation des ingrédients ──────────────────────────────────────────

function categorize(id) {
  for (const cat of categories) {
    for (const pattern of cat.match_id_contains) {
      if (id.includes(pattern)) return cat.coicop
    }
  }
  return null
}

// ─── Arrondi commercial (2 décimales, ×5 si JPY) ─────────────────────────────

function roundPrice(price, lang) {
  if (lang === 'ja') {
    return Math.round(price / 5) * 5
  }
  return Math.round(price * 100) / 100
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🌍 Fridge+ — Inflation pricing ${fromYear} → ${toYear}`)
console.log(`   Source : Eurostat HICP FR — CC-BY 4.0`)
console.log(`   Mode   : ${writeMode ? '✏️  --write (génère le batch)' : '🔍 --dry (simulation)'}`)
console.log()

// 1. Fetch tous les ratios HICP
const coicopCodes = [...new Set(categories.map(c => c.coicop))]
let ratios = {}

console.log('📡 Récupération des indices Eurostat...')
const fetchResults = await Promise.allSettled(coicopCodes.map(fetchHicp))
let fetchErrors = 0

for (const result of fetchResults) {
  if (result.status === 'fulfilled') {
    const { coicop, indexFrom, indexTo, ratio } = result.value
    const cat = categories.find(c => c.coicop === coicop)
    ratios[coicop] = ratio
    const pct = ((ratio - 1) * 100).toFixed(2)
    const sign = ratio >= 1 ? '+' : ''
    console.log(`   ✓ ${coicop} (${cat?.label_fr ?? '?'}) : ${indexFrom.toFixed(2)} → ${indexTo.toFixed(2)} (${sign}${pct}%)`)
  } else {
    console.error(`   ✗ ${result.reason.message}`)
    fetchErrors++
  }
}

if (fetchErrors === coicopCodes.length) {
  console.error('\n✗ Tous les fetches ont échoué. Vérifiez votre connexion ou la disponibilité des données Eurostat pour ' + toYear + '.')
  process.exit(1)
}
if (fetchErrors > 0) {
  console.warn(`\n⚠️  ${fetchErrors} catégorie(s) non récupérées — les ingrédients concernés ne seront pas ajustés.`)
}

// 2. Catégoriser les ingrédients et calculer les nouveaux prix
console.log(`\n📊 Calcul des ajustements sur ${ingredientIds.length} ingrédients...`)

const batch = {}
const stats = { adjusted: 0, skipped: 0, totalRatio: 0 }
const categoryStats = {}

for (const id of ingredientIds) {
  const coicop = categorize(id)
  if (!coicop || !ratios[coicop]) {
    stats.skipped++
    continue
  }

  const ratio = ratios[coicop]
  const original = pricing.prices[id]
  const adjusted = {}

  for (const [lang, packs] of Object.entries(original)) {
    adjusted[lang] = packs.map(pack => ({
      ...pack,
      price: roundPrice(pack.price * ratio, lang),
    }))
  }

  batch[id] = adjusted
  stats.adjusted++
  stats.totalRatio += ratio

  categoryStats[coicop] = (categoryStats[coicop] || 0) + 1
}

// 3. Rapport
const avgPct = stats.adjusted > 0
  ? (((stats.totalRatio / stats.adjusted) - 1) * 100).toFixed(2)
  : '0.00'

console.log(`\n📈 Résultat :`)
console.log(`   ✓ ${stats.adjusted} prix ajustés (${avgPct}% en moyenne)`)
console.log(`   - ${stats.skipped} ingrédients non catégorisés (inchangés)`)
console.log()
console.log('   Répartition par catégorie :')
for (const [coicop, count] of Object.entries(categoryStats)) {
  const cat = categories.find(c => c.coicop === coicop)
  const pct = ((ratios[coicop] - 1) * 100).toFixed(2)
  const sign = ratios[coicop] >= 1 ? '+' : ''
  console.log(`   • ${coicop} ${cat?.label_fr ?? '?'} : ${count} ingrédients (${sign}${pct}%)`)
}

if (!writeMode) {
  console.log('\n💡 Dry-run terminé. Ajouter --write pour générer le fichier batch.')
  process.exit(0)
}

// 4. Écriture du batch
const batchName = `PRICING_UPDATE_${toYear}_JAN`
const batchFilename = `pricing-update-${toYear}-jan.mjs`
const batchPath = resolve(__dirname, 'data', batchFilename)

const lines = [
  `/**`,
  ` * ${batchFilename} — Mise à jour inflation annuelle ${fromYear} → ${toYear}`,
  ` *`,
  ` * Généré automatiquement par scripts/apply-inflation-pricing.mjs`,
  ` * Source : Eurostat HICP FR — CC-BY 4.0`,
  ` *   https://ec.europa.eu/eurostat/web/hicp/data/database`,
  ` *`,
  ` * Indices utilisés (base 2015=100, moyenne annuelle) :`,
]
for (const [coicop, ratio] of Object.entries(ratios)) {
  const cat = categories.find(c => c.coicop === coicop)
  const pct = ((ratio - 1) * 100).toFixed(2)
  const sign = ratio >= 1 ? '+' : ''
  lines.push(` *   ${coicop} (${cat?.label_fr ?? '?'}) : ${sign}${pct}%`)
}
lines.push(` *`)
lines.push(` * Usage : npm run pricing:apply -- --batch scripts/data/${batchFilename}`)
lines.push(` */`)
lines.push('')
lines.push(`export const ${batchName} = ${JSON.stringify(batch, null, 2)}`)
lines.push('')

writeFileSync(batchPath, lines.join('\n'), 'utf8')
console.log(`\n✅ Batch écrit : scripts/data/${batchFilename}`)
console.log(`   → Appliquer : npm run pricing:apply -- --batch scripts/data/${batchFilename}`)
console.log(`   → Vérifier  : npm run pricing:audit`)
