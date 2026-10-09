/**
 * Niveau A — corrige l'id PRINCIPAL d'un slot quand le label désigne déjà le bon
 * ingrédient mais que `ids[0]` pointe ailleurs. Le nouvel id devient principal ;
 * l'ancien id est CONSERVÉ en alternative (donc l'union d'allergènes ne perd
 * jamais rien — direction sûre). On n'applique que si le label contient le
 * mot-clé ET `ids[0] === oldId`.
 *
 * Affiche les allergènes (catalogue) ancien vs nouveau pour transparence.
 *
 * Usage : node scripts/fix-recipe-id-swaps.mjs [--apply]
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
function loadEnv() {
  const f = join(root, '.env.local'); if (!existsSync(f)) return {}
  const env = {}
  for (const line of readFileSync(f, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}
const env = { ...loadEnv(), ...process.env }
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const fold = (t) => (t ?? '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '')

// [recette, mot-clé label, oldId (=ids[0] actuel), newId]
const SWAPS = [
  ['salade-grecque', 'feta', 'fr-chevre', 'fr-feta'],
  ['salade-quinoa-legumes', 'persil', 'sp-menthe', 'sp-persil'],
  ['tarte-fraises', 'mascarpone', 'fr-creme-liquide', 'fr-mascarpone'],
  ['tarte-poire-chocolat', 'sablee', 'fr-pate-brisee', 'fr-pate-sablee'],
  ['yaourt-grec-miel-noix', 'yaourt grec', 'fr-yaourt', 'fr-yaourt-nature'],
]

const allIds = [...new Set(SWAPS.flatMap(s => [s[2], s[3]]))]
const { data: ing } = await supabase.from('ingredients').select('id, allergens').in('id', allIds)
const allerg = new Map(ing.map(i => [i.id, (i.allergens ?? []).slice().sort()]))

const ids = [...new Set(SWAPS.map(s => s[0]))]
const { data: recipes, error } = await supabase.from('recipes_unified').select('id, ingredients').in('id', ids)
if (error) { console.error('Lecture :', error.message); process.exit(1) }
const byId = new Map(recipes.map(r => [r.id, r]))

const backup = {}
const updates = new Map()
let ok = 0, skip = 0
for (const [rid, kw, oldId, newId] of SWAPS) {
  const r = byId.get(rid); if (!r) { console.warn(`⚠️  ${rid} introuvable — skip`); skip++; continue }
  const ings = updates.get(rid) ?? JSON.parse(JSON.stringify(r.ingredients))
  const kf = fold(kw)
  const matches = ings.map((slot, i) => ({ slot, i })).filter(({ slot }) =>
    fold(slot.labels?.fr).includes(kf) && Array.isArray(slot.ids) && slot.ids[0] === oldId)
  if (matches.length !== 1) { console.warn(`⚠️  ${rid} « ${kw} » ${oldId}→${newId} : ${matches.length} slot(s) — skip`); skip++; continue }
  const { slot, i } = matches[0]
  const aOld = allerg.get(oldId) ?? [], aNew = allerg.get(newId) ?? []
  const newIds = [newId, ...slot.ids.filter(x => x !== newId)] // newId principal, oldId conservé en alt, pas de doublon
  if (!backup[rid]) backup[rid] = JSON.parse(JSON.stringify(r.ingredients))
  ings[i] = { ...slot, ids: newIds }
  updates.set(rid, ings)
  console.log(`  ✎ ${rid} : « ${slot.labels.fr} »  ids ${oldId}→${newId}`)
  console.log(`      allergènes ${oldId}=[${aOld}]  →  ${newId}=[${aNew}]  (ancien conservé en alt ; union ne perd rien)`)
  ok++
}
console.log(`\n${ok} swaps sur ${updates.size} recettes · ${skip} sautés · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
if (!APPLY) { console.log('\n(dry-run — relance avec --apply)'); process.exit(0) }

const dir = join(root, 'backups'); if (!existsSync(dir)) mkdirSync(dir)
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const bpath = join(dir, `recipes-idswaps-backup-${stamp}.json`)
writeFileSync(bpath, JSON.stringify(backup, null, 2)); console.log(`\nBackup → ${bpath}`)
for (const [rid, ings] of updates) {
  const { error: e } = await supabase.from('recipes_unified').update({ ingredients: ings }).eq('id', rid)
  if (e) console.error(`  ✗ ${rid} : ${e.message}`); else console.log(`  ✓ ${rid}`)
}
console.log('\nÉcriture terminée.')
