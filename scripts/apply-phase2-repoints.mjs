/**
 * Phase 2 — applique les re-points d'une CLASSE sur recipes_unified.
 * Usage :
 *   node scripts/apply-phase2-repoints.mjs --class=ZERO            (dry-run)
 *   node scripts/apply-phase2-repoints.mjs --class=RESTRICTIF --apply
 *
 * Règles (spec §3) :
 *   ZERO       → ne change QUE `ingredients` (diet/allergens inchangés).
 *   RESTRICTIF → `ingredients` + allergens := stocké ∪ alAdded ; diet := stocké − dietRemoved.
 *   PERMISSIF  → `ingredients` seulement (diet/allergens laissés tels quels = revue manuelle).
 *
 * Le delta vient de classify(union_avant, union_après) ; il s'applique aux
 * valeurs STOCKÉES (jamais de re-dérivation union). Trigger de dérivation mort
 * (lit `id`, slots = `ids[]`) → les valeurs explicites de l'UPDATE survivent.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { CANDIDATES, compute, applyOp, classify, loadClient } from './phase2-repoints-data.mjs'

const args = process.argv.slice(2)
const klassArg = (args.find(a => a.startsWith('--class=')) || '').split('=')[1]
const doApply = args.includes('--apply')
const VALID = ['ZERO', 'RESTRICTIF', 'PERMISSIF']
if (!VALID.includes(klassArg)) {
  console.error(`❌  --class=${VALID.join('|')} requis`)
  process.exit(1)
}

const s = loadClient(createClient, readFileSync)
const { data: ings } = await s.from('ingredients').select('id, allergens, breaks_diets')
const ING = new Map(ings.map(i => [i.id, i]))

const recipeIds = [...new Set(CANDIDATES.map(c => c[0]))]
const { data: recs } = await s.from('recipes_unified').select('id, ingredients, diet, allergens').in('id', recipeIds).is('deleted_at', null)
const REC = new Map(recs.map(r => [r.id, r]))

const uniq = arr => [...new Set(arr)].sort()

// On agrège par recette (plusieurs ops/recette possibles : mapo, magret, wrap, tom-yum).
// On applique TOUTES les ops de la classe demandée pour cette recette, en chaîne.
const byRecipe = new Map()
for (const [rid, op, oldId, newId] of CANDIDATES) {
  const r = REC.get(rid)
  if (!r) { console.warn(`⚠️  recette introuvable: ${rid}`); continue }
  // calcul du delta de CETTE op (sur l'état courant de la recette)
  const before = compute(r.ingredients ?? [], ING)
  const next = applyOp(r.ingredients ?? [], rid, op, oldId, newId)
  const after = compute(next, ING)
  const cls = classify(before, after)
  if (cls.klass !== klassArg) continue
  if (op === 'swap' && !(r.ingredients ?? []).some(sl => (sl.ids ?? []).includes(oldId))) {
    console.warn(`⚠️  ${rid}: ancien id absent (${oldId}) — déjà re-pointé ? skip`); continue
  }
  if (!byRecipe.has(rid)) byRecipe.set(rid, { slots: r.ingredients ?? [], diet: r.diet ?? [], allergens: r.allergens ?? [], ops: [] })
  const acc = byRecipe.get(rid)
  acc.slots = applyOp(acc.slots, rid, op, oldId, newId)            // chaîne les ops
  if (klassArg === 'RESTRICTIF') {
    acc.allergens = uniq([...acc.allergens, ...cls.alAdded])
    acc.diet = acc.diet.filter(d => !cls.dietRemoved.includes(d))
  }
  acc.ops.push({ op, oldId, newId, ...cls })
}

console.log(`\n=== APPLY Phase 2 — classe ${klassArg} — ${doApply ? 'APPLY' : 'DRY-RUN'} ===\n`)
let n = 0
for (const [rid, acc] of byRecipe) {
  n++
  const r = REC.get(rid)
  const opsStr = acc.ops.map(o => `${o.oldId ?? '+'}→${o.newId}`).join(', ')
  console.log(`• ${rid.padEnd(28)} ${opsStr}`)
  if (klassArg === 'RESTRICTIF') {
    console.log(`    allergens: [${(r.allergens ?? []).join(',')}] → [${acc.allergens.join(',')}]`)
    console.log(`    diet     : [${(r.diet ?? []).join(',')}] → [${acc.diet.join(',')}]`)
  } else if (klassArg === 'PERMISSIF') {
    const hints = acc.ops.flatMap(o => [...o.alRemoved.map(a => `−al:${a}`), ...o.dietAdded.map(d => `+diet:${d}`)])
    console.log(`    ⚠️ revue manuelle requise — gain potentiel: ${hints.join(', ')} (diet/allergens NON modifiés par ce script)`)
  }

  if (doApply) {
    const patch = { ingredients: acc.slots }
    if (klassArg === 'RESTRICTIF') { patch.diet = acc.diet; patch.allergens = acc.allergens }
    const { error } = await s.from('recipes_unified').update(patch).eq('id', rid)
    if (error) { console.error(`    ❌ ${rid}: ${error.message}`); process.exit(1) }
    console.log('    ✅ écrit')
  }
}
console.log(`\n${n} recette(s) ${doApply ? 'mises à jour' : 'en dry-run'} (classe ${klassArg}).`)
if (!doApply) console.log('→ relancer avec --apply pour écrire (après backup + accord).')
