/**
 * Niveau A — corrige les quantités `qty.amount` incohérentes avec le label (le
 * label et les étapes concordent ; c'est la qty numérique qui est fausse).
 *
 * Sûreté maximale :
 *   - dry-run par DÉFAUT ; `--apply` pour écrire.
 *   - backup systématique avant écriture.
 *   - pour chaque correction : on ne modifie QUE si exactement UN slot du label
 *     contient le mot-clé ET a `qty.amount === from`. Sinon skip + warn.
 *   - changements d'unité exclus (→ niveau B catalogue).
 *
 * Usage : node scripts/fix-recipe-qty.mjs           (dry-run)
 *         node scripts/fix-recipe-qty.mjs --apply    (écrit en BDD)
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

// { id recette, key (mot-clé label), from, to }  — from/to = qty.amount
const CORR = [
  ['carbonara', 'spaghetti', 160, 200], ['carbonara', 'lardon', 100, 150], ['carbonara', 'oeuf', 2, 3],
  ['pates-jambon', 'pate', 160, 200], ['pates-jambon', 'creme', 20, 15], ['pates-jambon', 'fromage', 50, 30],
  ['pates-tomate', 'pate', 160, 200],
  ['gratin-dauphinois', 'terre', 800, 1000], ['gratin-dauphinois', 'creme', 30, 40], ['gratin-dauphinois', 'ail', 2, 1], ['gratin-dauphinois', 'gruyere', 100, 80],
  ['hachis-parmentier', 'boeuf', 400, 600], ['hachis-parmentier', 'terre', 800, 1000], ['hachis-parmentier', 'beurre', 50, 60],
  ['mousse-chocolat', 'chocolat', 200, 150], ['mousse-chocolat', 'beurre', 30, 20],
  ['tiramisu', 'mascarpone', 500, 250],
  ['quiche-lorraine', 'oeuf', 3, 4],
  ['ratatouille', 'ail', 2, 3],
  ['risotto-champignons', 'champignon', 200, 250], ['risotto-champignons', 'beurre', 30, 50],
  ['tajine-poulet', 'poulet', 800, 1000], ['tajine-poulet', 'ail', 2, 3],
  ['soupe-oignon', 'oignon', 600, 1200], ['soupe-oignon', 'bouillon', 100, 150], ['soupe-oignon', 'baguette', 4, 8], ['soupe-oignon', 'beurre', 50, 40],
  ['veloute-butternut', 'bouillon', 80, 75], ['veloute-butternut', 'creme', 20, 15],
  ['mug-cake-chocolat', 'levure', 1, 0.5],
  ['steak-beurre-thym', 'ail', 1, 2],
  ['smoothie-fraise', 'fraise', 200, 300],
  ['gratin-courgettes', 'courgette', 800, 1000],
  ['blanquette-veau', 'beurre', 50, 40],
]

const ids = [...new Set(CORR.map(c => c[0]))]
const { data: recipes, error } = await supabase.from('recipes_unified').select('id, ingredients').in('id', ids)
if (error) { console.error('Lecture :', error.message); process.exit(1) }
const byId = new Map(recipes.map(r => [r.id, r]))

const backup = {}
const updates = new Map() // id -> ingredients (muté)
let ok = 0, skip = 0

for (const [rid, key, from, to] of CORR) {
  const r = byId.get(rid)
  if (!r) { console.warn(`⚠️  ${rid} introuvable — skip`); skip++; continue }
  const ings = updates.get(rid) ?? JSON.parse(JSON.stringify(r.ingredients))
  const kf = fold(key)
  const matches = ings
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => fold(slot.labels?.fr).includes(kf) && Number(slot.qty?.amount) === from)
  if (matches.length !== 1) {
    console.warn(`⚠️  ${rid} « ${key} » ${from}→${to} : ${matches.length} slot(s) correspondant(s) — skip`)
    skip++; continue
  }
  const { slot, i } = matches[0]
  if (!backup[rid]) backup[rid] = JSON.parse(JSON.stringify(r.ingredients))
  console.log(`  ✎ ${rid} : « ${slot.labels.fr} » qty ${from} ${slot.qty.unit ?? ''} → ${to} ${slot.qty.unit ?? ''}`)
  ings[i] = { ...slot, qty: { ...slot.qty, amount: to } }
  updates.set(rid, ings)
  ok++
}

console.log(`\n${ok} corrections sur ${updates.size} recettes · ${skip} sautées · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
if (!APPLY) { console.log('\n(dry-run — relance avec --apply pour écrire)'); process.exit(0) }

const dir = join(root, 'backups'); if (!existsSync(dir)) mkdirSync(dir)
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const bpath = join(dir, `recipes-qty-backup-${stamp}.json`)
writeFileSync(bpath, JSON.stringify(backup, null, 2))
console.log(`\nBackup → ${bpath}`)
for (const [rid, ings] of updates) {
  const { error: e } = await supabase.from('recipes_unified').update({ ingredients: ings }).eq('id', rid)
  if (e) console.error(`  ✗ ${rid} : ${e.message}`); else console.log(`  ✓ ${rid}`)
}
console.log('\nÉcriture terminée.')
