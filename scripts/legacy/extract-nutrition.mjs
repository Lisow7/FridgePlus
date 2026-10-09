/**
 * scripts/extract-nutrition.mjs
 * Étape 1 — Extraction des données nutritionnelles depuis Open Food Facts
 *
 * Usage : node scripts/extract-nutrition.mjs
 *
 * Sorties :
 *   scripts/nutrition-raw.json      — tous les résultats (234 ingrédients)
 *   scripts/nutrition-review.json   — ingrédients à vérifier manuellement
 *   scripts/nutrition-summary.txt   — rapport lisible
 */

import { writeFile } from 'fs/promises'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Import des données ──────────────────────────────────────
const { INGREDIENTS } = await import(pathToFileURL(join(ROOT, 'src/shared/static/ingredients.js')).href)
const { OFF_ALLERGEN_MAP } = await import(pathToFileURL(join(ROOT, 'src/data/allergens.js')).href)

// Seuls les ingrédients principaux (sans group_id) ont besoin de données propres
// Les variantes héritent de leur parent group_id en UI
const MAIN_INGREDIENTS = Object.values(INGREDIENTS).flat().filter(i => !i.group_id)

console.log(`\n🔍 ${MAIN_INGREDIENTS.length} ingrédients principaux à analyser\n`)

// ── Helpers ─────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2
}

function round1(n) {
  return n !== null && n !== undefined ? Math.round(n * 10) / 10 : null
}

function isPlausible(val, min, max) {
  return val != null && val >= min && val <= max
}

// ── Requête OFF ──────────────────────────────────────────────
async function searchOFF(query, lang = 'en') {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    fields: 'product_name,nutriments,allergens_tags,categories_tags',
    page_size: '20',
    sort_by: 'unique_scans_n',  // produits les plus scannés = les plus fiables
    lc: lang,
  })
  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params}`
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'FridgePlus-NutritionExtractor/1.0 (support@fridgeplus.app)' },
  })
  if (!resp.ok) throw new Error(`OFF API ${resp.status}`)
  const data = await resp.json()
  return data.products ?? []
}

// ── Extraction pour un ingrédient ───────────────────────────
async function extractOne(ingredient) {
  const query = ingredient.labels.en

  let products = await searchOFF(query, 'en')

  // Si trop peu de résultats, réessayer en français
  if (products.length < 3) {
    const frProducts = await searchOFF(ingredient.labels.fr, 'fr')
    products = [...products, ...frProducts]
  }

  // Filtrer les produits avec au moins calories présentes
  const valid = products.filter(p =>
    p.nutriments?.['energy-kcal_100g'] != null ||
    p.nutriments?.['energy_100g'] != null
  )

  // Extraire chaque macro avec plage de plausibilité
  const cal  = valid.map(p => p.nutriments['energy-kcal_100g'] ?? (p.nutriments['energy_100g'] ?? 0) / 4.184).filter(v => isPlausible(v, 0, 950))
  const prot = valid.map(p => p.nutriments['proteins_100g']).filter(v => isPlausible(v, 0, 100))
  const carb = valid.map(p => p.nutriments['carbohydrates_100g']).filter(v => isPlausible(v, 0, 100))
  const fat  = valid.map(p => p.nutriments['fat_100g']).filter(v => isPlausible(v, 0, 100))
  const fib  = valid.map(p => p.nutriments['fiber_100g']).filter(v => isPlausible(v, 0, 80))

  // Allergènes : union de tous les produits valides
  const allergenSet = new Set()
  valid.forEach(p => {
    ;(p.allergens_tags ?? []).forEach(tag => {
      const mapped = OFF_ALLERGEN_MAP[tag]
      if (mapped) allergenSet.add(mapped)
    })
  })

  // Score qualité : % de produits valides ayant les 4 macros principales
  const complete = valid.filter(p =>
    ['energy-kcal_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g']
      .every(k => p.nutriments?.[k] != null)
  ).length
  const qualityScore = valid.length > 0 ? Math.round((complete / valid.length) * 100) : 0

  // Besoin de révision si : score bas, peu de résultats, ou toutes les macros nulles
  const needsReview =
    qualityScore < 40 ||
    valid.length < 3 ||
    (cal.length === 0 && prot.length === 0)

  return {
    ingredient_id:  ingredient.id,
    label_fr:       ingredient.labels.fr,
    label_en:       ingredient.labels.en,
    calories_100g:  round1(median(cal)),
    proteins_100g:  round1(median(prot)),
    carbs_100g:     round1(median(carb)),
    fat_100g:       round1(median(fat)),
    fiber_100g:     round1(median(fib)),
    allergens:      [...allergenSet].sort(),
    source:         'openfoodfacts',
    verified:       false,
    quality_score:  qualityScore,
    results_found:  valid.length,
    needs_review:   needsReview,
  }
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const results = []
  const startTime = Date.now()

  for (let i = 0; i < MAIN_INGREDIENTS.length; i++) {
    const ing = MAIN_INGREDIENTS[i]
    const prefix = `[${String(i + 1).padStart(3)}/${MAIN_INGREDIENTS.length}]`
    process.stdout.write(`${prefix} ${ing.labels.en.padEnd(35)} `)

    try {
      const result = await extractOne(ing)
      results.push(result)

      const flag = result.needs_review ? ' ⚠️  REVIEW' : ''
      const cal = result.calories_100g != null ? `${result.calories_100g} kcal` : 'no data'
      console.log(`✓  ${cal.padEnd(10)}  Q:${String(result.quality_score).padStart(3)}%  n=${result.results_found}${flag}`)
    } catch (err) {
      console.log(`✗  ERROR: ${err.message}`)
      results.push({
        ingredient_id: ing.id,
        label_fr: ing.labels.fr,
        label_en: ing.labels.en,
        calories_100g: null, proteins_100g: null,
        carbs_100g: null, fat_100g: null, fiber_100g: null,
        allergens: [], source: 'openfoodfacts', verified: false,
        quality_score: 0, results_found: 0, needs_review: true,
        error: err.message,
      })
    }

    // Rate limiting : 1,2 s entre chaque requête (respect OFF API)
    if (i < MAIN_INGREDIENTS.length - 1) {
      await new Promise(r => setTimeout(r, 1200))
    }
  }

  // ── Rapport final ─────────────────────────────────────────
  const ok = results.filter(r => !r.needs_review)
  const review = results.filter(r => r.needs_review)
  const elapsed = Math.round((Date.now() - startTime) / 1000)

  console.log('\n' + '═'.repeat(60))
  console.log(`✅ Terminé en ${elapsed}s`)
  console.log(`   OK          : ${ok.length} ingrédients`)
  console.log(`   À réviser   : ${review.length} ingrédients`)
  console.log('═'.repeat(60))

  if (review.length > 0) {
    console.log('\n⚠️  Ingrédients à vérifier manuellement :')
    review.forEach(r => console.log(`   - ${r.label_fr} (${r.label_en})  Q:${r.quality_score}%  n=${r.results_found}`))
  }

  // ── Fichiers de sortie ────────────────────────────────────
  await writeFile(
    join(__dirname, 'nutrition-raw.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  )

  await writeFile(
    join(__dirname, 'nutrition-review.json'),
    JSON.stringify(review, null, 2),
    'utf8'
  )

  // Résumé texte
  const summary = [
    `Extraction OFF — ${new Date().toISOString()}`,
    `Ingrédients analysés : ${results.length}`,
    `OK (Q≥40%, n≥3)     : ${ok.length}`,
    `À réviser           : ${review.length}`,
    '',
    'Liste à réviser :',
    ...review.map(r => `  - [${r.ingredient_id}] ${r.label_fr} / ${r.label_en}  Q:${r.quality_score}%  n:${r.results_found}${r.error ? '  ERR:' + r.error : ''}`),
  ].join('\n')

  await writeFile(join(__dirname, 'nutrition-summary.txt'), summary, 'utf8')

  console.log('\n📁 Fichiers générés :')
  console.log('   scripts/nutrition-raw.json     (tous les résultats)')
  console.log('   scripts/nutrition-review.json  (à compléter manuellement)')
  console.log('   scripts/nutrition-summary.txt  (rapport lisible)')
}

main().catch(err => {
  console.error('\n💥 Erreur fatale :', err)
  process.exit(1)
})
