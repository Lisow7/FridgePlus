/**
 * Outil de drift-check (lecture seule) — v0.91
 *
 * Calcule ce que `npm run migrate` produirait et le compare aux lignes live
 * de la table `ingredients` en BDD, SANS faire d'écrit.
 *
 * Affiche pour chaque id :
 *   NEW     → absent en base (serait inséré par le migrate)
 *   CHANGED → champs dérivés différents (détail des champs concernés)
 *   SAME    → identique à la BDD
 *
 * Usage : node scripts/ingredients-drift-check.mjs
 * Code de sortie 0 (sert au jugement humain).
 */

import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
  auth: { persistSession: false },
})

// --- Imports donnees --------------------------------------------------------

const { INGREDIENTS }        = await import('../src/shared/static/ingredients.js')
const { NUTRITION }          = await import('./lib/nutrition.js')
const { PACK_SIZES }         = await import('../src/shared/static/pack-sizes.js')
const { DIET_BREAKING_IDS }  = await import('../src/shared/static/diet-breaking-ids.js')
const { getUnitHints }       = await import('../src/shared/static/ingredient-unit-hints.js')

// Pricing 2026 : source de verite depuis pricing/2026.json
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

// --- Build des rows (identique a sync-ingredients.mjs) ---------------------

console.log('\nPreparation des ingredients depuis les statiques...\n')

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

console.log(`  -> ${deduplicatedRows.length} ingredients calcules depuis les statiques (${ingredientRows.length - deduplicatedRows.length} doublons dedupliques)\n`)

// --- Fetch live BDD ---------------------------------------------------------

console.log('Lecture de la BDD (SELECT ingredients)...\n')

const { data: live, error: fetchError } = await supabase
  .from('ingredients')
  .select('id, subcategory, storage, group_id, allergens, breaks_diets, default_unit, nutrition, price, pack_size, labels, emoji')

if (fetchError) {
  console.error('Erreur SELECT :', fetchError.message)
  process.exit(1)
}

const liveById = new Map((live ?? []).map(r => [r.id, r]))

// --- Diff -------------------------------------------------------------------

// Champs derives structurels (la garde porte sur ceux-ci)
// `labels` EXCLU : drift connu fr+en (statique) vs 5-langues (live) = CHANGED=612 benin.
const FIELDS = ['subcategory', 'storage', 'group_id', 'allergens', 'breaks_diets', 'default_unit', 'emoji']

// Champs annexes (peuvent differer de facon benigne — affiches a part)
const FIELDS_ANNEXES = ['nutrition', 'price', 'pack_size']

let neuf = 0, changed = 0, same = 0
const changedRows = []
const newRows = []
// 🔴 Les dérives ANNEXES étaient calculées puis JETÉES (2026-08-15) : le
// commentaire ci-dessus promettait « affichés à part », et ils ne l'étaient
// nulle part. Une dérive sur `nutrition`, `price` ou `pack_size` entre les
// fichiers statiques et la base passait donc inaperçue — dans le script même
// dont c'est le seul rôle. Rendu visible ici, en résumé plutôt qu'en liste,
// pour ne pas noyer les CHANGED qui, eux, appellent une action.
const annexesParChamp = new Map()
let annexesTotal = 0

// `JSON.stringify` est sensible à l'ORDRE DES CLÉS : `{a:1,b:2}` et `{b:2,a:1}`
// décrivent la même donnée et produisent deux chaînes différentes. Comparer des
// objets nutrition/prix ainsi signalait 651 ingrédients sur 653 — un garde-fou
// qui hurle en permanence est aussi inutile qu'un garde-fou muet.
// D'où cette forme canonique : clés triées récursivement avant comparaison.
function canonique(v) {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return `[${v.map(canonique).join(',')}]`
  if (typeof v === 'object') {
    return `{${Object.keys(v).sort().map(k => `${k}:${canonique(v[k])}`).join(',')}}`
  }
  return String(v)
}

for (const row of deduplicatedRows) {
  const cur = liveById.get(row.id)
  if (!cur) {
    neuf++
    newRows.push(row.id)
    console.log(`NEW      ${row.id}`)
    continue
  }
  const diffs = FIELDS.filter(f => JSON.stringify(cur[f]) !== JSON.stringify(row[f]))
  const diffsAnnexes = FIELDS_ANNEXES.filter(f => canonique(cur[f]) !== canonique(row[f]))
  if (diffsAnnexes.length) {
    annexesTotal++
    for (const f of diffsAnnexes) annexesParChamp.set(f, (annexesParChamp.get(f) ?? 0) + 1)
  }
  if (diffs.length) {
    changed++
    changedRows.push({ id: row.id, diffs })
    console.log(`CHANGED  ${row.id} -> ${diffs.join(', ')}`)
  } else {
    same++
    // SAME : pas de log pour eviter le bruit (~600 lignes)
  }
}

// Ingredients presents en BDD mais absents des statiques (orphelins)
const orphans = []
for (const id of liveById.keys()) {
  if (!rowsById.has(id)) orphans.push(id)
}

console.log(`\nNEW=${neuf}  CHANGED=${changed}  SAME=${same}  (live total=${liveById.size})`)

// Dérives annexes : signalées, mais séparément — elles n'appellent pas la même
// action qu'un CHANGED (un prix qui bouge est normal, une allergène non).
if (annexesTotal) {
  const detail = [...annexesParChamp.entries()].map(([f, n]) => `${f}=${n}`).join('  ')
  console.log(`ANNEXES  ${annexesTotal} ingrédient(s) diffèrent sur ${detail}`)
  console.log(`         (${FIELDS_ANNEXES.join(', ')} — la BASE en est propriétaire depuis le 2026-08-15 :`)
  console.log('          `sync-ingredients` ne les envoie plus pour une ligne existante, donc cet écart')
  console.log('          n\'est PLUS un risque avant un migrate. Affiché pour ne pas dériver en silence.)')
}

// ⚠️ « ORPHELIN » NE VEUT PAS DIRE « À SUPPRIMER » — mesuré le 2026-08-15.
// Les deux lignes concernées ce jour-là étaient au contraire ACTIVEMENT
// utilisées : `vg-tomate-ronde` est cité par 8 recettes et présent dans
// 5 frigos, `vg-oignon-jaune` dans 4 frigos. Les supprimer aurait casse le
// matching de ces recettes et vidé des frigos d'utilisateurs.
// Ce ne sont donc pas des déchets en base : ce sont les STATIQUES qui sont en
// retard. Le mot « orphelin » suggère l'inverse — d'où cette précision, à
// l'endroit même où il s'affiche.
if (orphans.length) {
  console.log(`\nEN BASE MAIS ABSENTS DES STATIQUES : ${orphans.length}`)
  console.log('  ⚠️  NE PAS supprimer sans vérifier l\'usage réel : ces lignes')
  console.log('      peuvent être citées par des recettes et présentes dans des frigos.')
  console.log('      Contrôle : recipes_unified.ingredients + user_stock.ingredient_id')
  for (const id of orphans) console.log(`  ABSENT DES STATIQUES   ${id}`)
}

if (changed > 0) {
  console.log('\n[ATTENTION] Des CHANGED existent. Ces drifts sont PREEXISTANTS (baseline).')
  console.log('Ne pas les imputer aux PR en cours. Verifier avant chaque migrate.')
}
