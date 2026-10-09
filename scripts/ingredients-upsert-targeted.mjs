/**
 * Upsert ciblé d'ingrédients — ÉCRITURE PROD.
 *
 * Reconstruit exactement les mêmes rows que `npm run migrate` (sync-ingredients.mjs),
 * filtre sur les IDs passés en argument CLI, et fait un UPSERT ciblé.
 * Contrairement au migrate complet, ne touche PAS les 612 lignes existantes
 * (labels 5-langues, etc.).
 *
 * ⚠️  JAMAIS lancer sans :
 *   1. Backup de la table `ingredients` → `backups/ingredients-YYYYMMDD-pre-xxx.json`
 *   2. Drift-check vert (`node scripts/ingredients-drift-check.mjs`)
 *   3. Accord explicite du controller/user
 *
 * Usage : node scripts/ingredients-upsert-targeted.mjs sp-gochujang,sp-doubanjiang,...
 *   ou   : node scripts/ingredients-upsert-targeted.mjs sp-gochujang sp-doubanjiang ...
 */

import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- Env --------------------------------------------------------------------

function loadEnv() {
  const envFile = join(root, '.env.local')
  if (!existsSync(envFile)) return {}
  const env = {}
  for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const SUPABASE_URL     = env.VITE_SUPABASE_URL
const SUPABASE_SVC_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SVC_KEY) {
  console.error('Variables manquantes : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local')
  process.exit(1)
}

// --- IDs cibles -------------------------------------------------------------

const IDS = process.argv.slice(2).join(',').split(',').map(s => s.trim()).filter(Boolean)

if (IDS.length === 0) {
  console.error('Usage: node scripts/ingredients-upsert-targeted.mjs <id1>,<id2>,...')
  console.error('Aucun ID fourni — arrêt (protection contre un upsert pleine-table).')
  process.exit(1)
}

console.log(`\nIDs cibles (${IDS.length}) : ${IDS.join(', ')}\n`)

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
  auth: { persistSession: false },
})

// --- Imports données --------------------------------------------------------

const { INGREDIENTS }        = await import('../src/shared/static/ingredients.js')
const { NUTRITION }          = await import('../src/shared/static/nutrition.js')
const { PACK_SIZES }         = await import('../src/shared/static/pack-sizes.js')
const { DIET_BREAKING_IDS }  = await import('../src/shared/static/diet-breaking-ids.js')
const { getUnitHints }       = await import('../src/shared/static/ingredient-unit-hints.js')

let PRICING_2026 = {}
try {
  const pricingPath = join(root, 'src/shared/static/pricing/2026.json')
  if (existsSync(pricingPath)) {
    PRICING_2026 = JSON.parse(readFileSync(pricingPath, 'utf-8'))
  }
} catch (err) {
  console.warn('Impossible de lire pricing/2026.json :', err.message)
}

// --- Mappings ---------------------------------------------------------------

const SUBCATEGORY_TO_STORAGE = {
  'frozen-meat':     'frz', 'frozen-fish':     'frz', 'frozen-veg':      'frz',
  'ready-meals':     'frz', 'ice-cream':       'frz', 'frozen-bread':    'frz',
  'meat':            'fr',  'fish':            'fr',  'dairy':           'fr',
  'cheese':          'fr',  'eggs':            'fr',  'deli':            'fr',
  'today':           'fr',  'thisweek':        'fr',
  'vegetables':      'vg',  'fruits':          'vg',
  'tropical-fruits': 'vg',  'vegan-proteins':  'vg',
  'pasta-rice':      'gp',  'canned':          'gp',  'cereals':         'gp',
  'bread':           'gp',  'sweet':           'gp',  'nuts-dried':      'gp',
  'salt-spices':     'sp',  'herbs':           'sp',  'sauces':          'sp',
  'oils':            'sp',  'tofu':            'fr',  'rice':            'gp',
  'dry':             'gp',  'basic':           'sp',
}

const SKIP_SUBCATEGORIES = new Set(['bof'])

// --- Helpers ----------------------------------------------------------------

function mapNutrition(n) {
  if (!n) return {}
  return {
    cal:  n.cal  ?? null,
    prot: n.prot ?? null,
    carb: n.carb ?? null,
    fat:  n.fat  ?? null,
    fib:  n.fib  ?? null,
    al:   n.al   ?? [],
  }
}

function normalizeUnit(u) {
  if (!u) return 'g'
  switch (u) {
    case 'g': case 'kg': case 'pincée': case 'PM':
      return 'g'
    case 'ml': case 'cl': case 'L': case 'mL':
      return 'ml'
    case 'pcs': case 'unité': case 'tranche': case 'gousse': case 'tete':
    case 'sachet': case 'botte': case 'branche': case 'feuille':
      return 'piece'
    case 'cs':
      return 'tbsp'
    case 'cc':
      return 'tsp'
    default:
      return 'g'
  }
}

function buildIdToBreakingDiets() {
  const map = new Map()
  for (const [diet, ids] of Object.entries(DIET_BREAKING_IDS ?? {})) {
    for (const id of ids ?? []) {
      if (!map.has(id)) map.set(id, [])
      map.get(id).push(diet)
    }
  }
  return map
}

// --- Build des rows (identique à sync-ingredients.mjs) ---------------------

console.log('Préparation des ingrédients depuis les statiques...\n')

const idToBreakingDiets = buildIdToBreakingDiets()
const ingredientRows = []

for (const [subcategory, items] of Object.entries(INGREDIENTS)) {
  if (SKIP_SUBCATEGORIES.has(subcategory)) continue
  const storage = SUBCATEGORY_TO_STORAGE[subcategory] ?? 'gp'

  items.forEach((item, index) => {
    const nutrition = NUTRITION[item.id]
    const allergens = nutrition?.al ?? []

    const hints = getUnitHints(item.id)
    const default_unit = normalizeUnit(hints.defaultUnit)

    const pricingPacks = (PRICING_2026.prices ?? {})[item.id] ?? {}
    const price = pricingPacks
    const pack_size = PACK_SIZES[item.id] ?? pricingPacks

    ingredientRows.push({
      id:           item.id,
      labels:       item.labels,
      emoji:        item.emoji,
      subcategory,
      storage,
      sort_order:   index,
      group_id:     item.group_id ?? null,
      price,
      nutrition:    mapNutrition(nutrition),
      pack_size,
      allergens,
      breaks_diets: idToBreakingDiets.get(item.id) ?? [],
      default_unit,
    })
  })
}

const rowsById = new Map()
for (const row of ingredientRows) rowsById.set(row.id, row)
const deduplicatedRows = Array.from(rowsById.values())

console.log(`  -> ${deduplicatedRows.length} ingrédients calculés depuis les statiques\n`)

// --- Filtre sur IDS cibles --------------------------------------------------

const targetedRows = deduplicatedRows.filter(r => IDS.includes(r.id))

const missing = IDS.filter(id => !deduplicatedRows.some(r => r.id === id))
if (missing.length > 0) {
  console.error(`ERREUR : IDs introuvables dans les statiques : ${missing.join(', ')}`)
  console.error('Vérifier que ces IDs sont bien dans src/shared/static/ingredients.js.')
  process.exit(1)
}

console.log(`  -> ${targetedRows.length} ingrédients ciblés pour l'upsert :\n`)
for (const r of targetedRows) {
  console.log(`     ${r.id}  allergens=[${r.allergens.join(',')}]  breaks=[${r.breaks_diets.join(',')}]  unit=${r.default_unit}`)
}
console.log()

// --- Confirmation manuelle --------------------------------------------------

console.log('⚠️  UPSERT CIBLÉ EN PROD — les lignes ci-dessus vont être insérées/mises à jour.')
console.log('   Vérifier : backup ingredients OK + drift-check vert + accord user.')
console.log()

// --- Upsert -----------------------------------------------------------------

const { error } = await supabase
  .from('ingredients')
  .upsert(targetedRows, { onConflict: 'id' })

if (error) {
  console.error('Erreur UPSERT :', error.message)
  process.exit(1)
}

console.log(`✅  Upsert terminé — ${targetedRows.length} ingrédients insérés/mis à jour.`)
