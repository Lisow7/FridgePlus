/**
 * v3.71.0 — Sync ingredients only (idempotent UPSERT).
 *
 * Script ciblé qui pousse uniquement la table `ingredients` depuis les
 * fichiers `src/data/*.js` vers Supabase. À utiliser quand on a modifié les
 * ingrédients (renommage clé, ajout, mise à jour packs/nutrition) et qu'on
 * veut propager à la BDD sans relancer toute la migration historique.
 *
 * Le gros script `migrate-to-db.mjs` est obsolète depuis la migration BDD
 * complète (Vague 1) : il référence encore 6 fichiers data legacy supprimés
 * (`recipeTranslations`, `recipeDiets`, `recipeCountries`, `prices`,
 * `allergens`, `recipeQuantities`). À archiver/refactorer dans une PR future.
 *
 * Usage : `npm run migrate` (alias de ce script)
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
  console.error('❌  Variables manquantes : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
  auth: { persistSession: false },
})

// ─── Imports données ─────────────────────────────────────────────────────────

const { INGREDIENTS }        = await import('../src/shared/static/ingredients.js')
const { NUTRITION }          = await import('./lib/nutrition.js')
const { PACK_SIZES }         = await import('../src/shared/static/pack-sizes.js')
const { DIET_BREAKING_IDS }  = await import('../src/shared/static/diet-breaking-ids.js')
const { getUnitHints }       = await import('../src/shared/static/ingredient-unit-hints.js')

// Pricing 2026 : source de vérité depuis pricing/2026.json (cf. Phase H pricing)
let PRICING_2026 = {}
try {
  const pricingPath = join(root, 'src/shared/static/pricing/2026.json')
  if (existsSync(pricingPath)) {
    PRICING_2026 = JSON.parse(readFileSync(pricingPath, 'utf-8'))
  }
} catch (err) {
  console.warn('⚠️  Impossible de lire pricing/2026.json :', err.message)
}

// ─── Mappings ────────────────────────────────────────────────────────────────

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

import { partitionnerPourUpsert, COLONNES_POSSEDEES_PAR_LA_BASE } from './lib/ingredients-ownership.mjs'

const SKIP_SUBCATEGORIES = new Set(['bof'])

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertBatch(table, rows, label, conflictKey = 'id') {
  if (!rows.length) { console.log(`  ${label} : (aucune ligne)`); return }
  const BATCH = 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictKey })
    if (error) {
      console.error(`❌  ${label} batch ${i}–${i + chunk.length - 1}:`, error.message)
      process.exit(1)
    }
    inserted += chunk.length
    process.stdout.write(`\r  ${label} : ${inserted}/${rows.length}`)
  }
  console.log()
}

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

// CHECK BDD : default_unit IN ('g','ml','piece','tbsp','tsp','cup').
// On normalise les unités riches du front (kg, cl, L, pcs, unité, gousse,
// tete, sachet, botte, branche, feuille, cs, cc, pincée…) vers ces 6 buckets.
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

// Inverse l'index DIET_BREAKING_IDS : id → diets[] (au lieu de diet → ids[])
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

// ─── Build des rows ──────────────────────────────────────────────────────────

console.log('\n🥕  Préparation des ingrédients à pousser…\n')

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

    // Pricing : lire pricing/2026.json via la clé 'prices' (source de vérité Phase H).
    // Bug corrigé v3.111.0 : PRICING_2026 est {year, prices:{...}} donc [item.id] retournait
    // toujours undefined. Désormais on lit PRICING_2026.prices[item.id].
    const pricingPacks = (PRICING_2026.prices ?? {})[item.id] ?? {}
    const price = pricingPacks
    // pack_size : packSizes.js en priorité (structure historique), fallback pricing si absent.
    const pack_size = PACK_SIZES[item.id] ?? pricingPacks

    // 🔴 CE QUE CET UPSERT DÉTRUIRAIT — mesuré le 2026-08-15
    //
    // `price` et `pack_size` sont reconstruits ici à partir des statiques, qui
    // ne portent que **fr et en**. Or la BDD contient **5 langues**
    // (de, en, es, fr, ja) sur **203 ingrédients** : les valeurs fr/en y sont
    // identiques aux statiques, mais de/es/ja n'existent QUE côté base.
    //
    // Lancer ce script écraserait donc silencieusement les prix et
    // conditionnements allemands, espagnols et japonais. Rien ne planterait :
    // l'upsert réussirait, et la perte ne se verrait qu'à l'usage.
    //
    // C'est exactement le même écart que celui déjà documenté pour `labels`
    // dans `ingredients-drift-check.mjs` (« fr+en statique vs 5-langues live »)
    // — le lien n'avait simplement jamais été fait pour ces deux champs-ci.
    //
    // ⇒ C'est LA raison concrète de la consigne « ne jamais lancer
    //   `npm run migrate` » sur cette base. Avant d'y toucher : lancer
    //   `node scripts/ingredients-drift-check.mjs` (lecture seule) et lire la
    //   ligne ANNEXES, qui chiffre précisément ce qui serait perdu.

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

console.log(`  → ${deduplicatedRows.length} ingrédients à pousser (${ingredientRows.length - deduplicatedRows.length} doublons dédupliqués)\n`)

// ── GARDE-FOU anti-clobber (2026-06-28) ───────────────────────────────────────
// ── Qui possede quoi ───────────────────────────────────────────────────────
// `labels`, `price`, `pack_size` et `nutrition` sont EDITABLES DEPUIS L'ADMIN
// EN PRODUCTION, et la BDD les porte en 5 langues quand les statiques s'arretent
// a fr+en. Les statiques les AMORCENT a la creation d'un ingredient, puis n'y
// touchent plus : les reconstruire a chaque migrate effacerait des saisies
// humaines, sans rien casser ni signaler.
// Deux lots SEPARES : PostgREST refuse un lot dont les objets n'ont pas les
// memes cles (« All object keys must match »).
// Dossier : la note interne sur la propriété des données d’ingrédients
let idsExistants = new Set()
let liveById = new Map()
{
  const { data: live, error } = await supabase.from('ingredients').select('id, labels')
  if (error) { console.error('❌  Lecture live KO :', error.message); process.exit(1) }
  liveById = new Map((live ?? []).map(r => [r.id, r]))
  idsExistants = new Set(liveById.keys())
}

const { nouveaux, existants } = partitionnerPourUpsert(deduplicatedRows, idsExistants)
console.log(`
  ${nouveaux.length} nouveau(x) — colonnes completes (amorcage)`)
console.log(`  ${existants.length} existant(s) — SANS ${COLONNES_POSSEDEES_PAR_LA_BASE.join(', ')} (possedes par la base)`)

// Filet de securite, conserve volontairement. Il portait AVANT sur les lignes
// construites depuis les statiques et faisait avorter le migrate sur 522
// lignes — c'est ce qui rendait `npm run migrate` inutilisable. Il porte
// desormais sur ce qui EST REELLEMENT ENVOYE : il ne doit plus jamais se
// declencher. S'il parle, c'est qu'une colonne possedee par la base est
// retombee dans le lot des existants.
{
  const clobbers = []
  for (const row of existants) {
    const cur = liveById.get(row.id)
    if (!cur || !('labels' in row)) continue
    const newLangs = Object.keys(row.labels ?? {})
    const lost = Object.keys(cur.labels ?? {}).filter(l => !newLangs.includes(l))
    if (lost.length) clobbers.push(`${row.id} → perdrait [${lost.join(',')}]`)
  }
  if (clobbers.length) {
    console.error(`
❌  ABANDON : ce migrate ecraserait des labels multilingues sur ${clobbers.length} ligne(s).`)
    console.error('   → REGRESSION : `labels` ne doit plus figurer dans le lot des lignes existantes.')
    clobbers.slice(0, 5).forEach(c => console.error('   - ' + c))
    process.exit(1)
  }
}

await upsertBatch('ingredients', nouveaux, 'Ingrédients (nouveaux)')
await upsertBatch('ingredients', existants, 'Ingrédients (existants)')

console.log('\n✅  Sync ingrédients terminée.')
console.log('\n💡  Note : si une recette en BDD (base_recipes.ingredients JSON) référence encore une ancienne clé renommée, applique une migration SQL ciblée — le sync ingredients ne touche pas les recettes.')
