/**
 * Génère `src/shared/static/pricing/<year>.json` depuis `src/shared/static/pack-sizes.js`.
 *
 * Cas d'usage :
 *   1. **Initialisation** (v3.30.0) : on extrait les prix actuellement en dur
 *      dans packSizes.js et on les copie dans pricing/2026.json. Ce fichier
 *      JSON devient le point d'édition pour les futures mises à jour
 *      annuelles (cf. Phase H — UI admin import CSV).
 *
 *   2. **Régénération annuelle** (à venir) : on ré-extrait depuis le JS
 *      pour démarrer une nouvelle année, on archive l'ancien fichier (ex:
 *      pricing/2025.json) et on édite uniquement pricing/<année>.json.
 *
 * Le JSON généré est **idempotent** : relancer le script ne change que
 * les prix qui auraient été modifiés en JS depuis. Pour des modifications
 * de prix manuelles, éditer directement le JSON (et NE PAS relancer ce
 * script).
 *
 * Usage :
 *   node scripts/generate-pricing-json.mjs            # année courante
 *   node scripts/generate-pricing-json.mjs --year 2027 # année cible
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Année cible : --year YYYY ou année courante par défaut
const yearArgIdx = process.argv.indexOf('--year')
const year = yearArgIdx >= 0 ? parseInt(process.argv[yearArgIdx + 1], 10) : new Date().getFullYear()
if (!Number.isInteger(year) || year < 2024 || year > 2100) {
  console.error(`✗ Année invalide : ${year}`)
  process.exit(1)
}

// Charge PACK_SIZES depuis le module ESM source. Sur Windows, l'import dynamique
// requiert l'URL `file://` (et non un chemin absolu brut).
const { PACK_SIZES } = await import(pathToFileURL(resolve(ROOT, 'src/shared/static/pack-sizes.js')).href)

const outDir  = resolve(ROOT, 'src/shared/static/pricing')
const outFile = resolve(outDir, `${year}.json`)

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const payload = {
  year,
  lastUpdated: new Date().toISOString().slice(0, 10),
  source: 'référence grande surface FR 2025-2026 (estimations) — généré depuis packSizes.js',
  // Devise par lang (fr/es/de = EUR, en = GBP, ja = JPY).
  currencyByLang: {
    fr: 'EUR',
    en: 'GBP',
    es: 'EUR',
    de: 'EUR',
    ja: 'JPY',
  },
  // prices[ingredientId][lang] = [{ size, unit, price }, ...]
  prices: {},
}

let count = 0
for (const [id, byLang] of Object.entries(PACK_SIZES)) {
  payload.prices[id] = {}
  for (const [lang, packs] of Object.entries(byLang)) {
    payload.prices[id][lang] = packs.map(({ size, unit, price }) => ({ size, unit, price }))
  }
  count++
}

writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(`✓ Généré : ${outFile}`)
console.log(`  Ingrédients : ${count}`)
console.log(`  Année : ${year}`)
console.log(`  Dernière mise à jour : ${payload.lastUpdated}`)
