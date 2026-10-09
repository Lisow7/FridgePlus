/**
 * LECTURE SEULE — Analyse Phase 2 : valide les re-points (audit → 37 nouveaux ids)
 * contre la BDD et classe le delta diet/allergènes (zéro / restrictif / permissif).
 * N'écrit RIEN. Données + helpers : ./phase2-repoints-data.mjs (source unique).
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { CANDIDATES, compute, applyOp, classify, loadClient } from './phase2-repoints-data.mjs'

const s = loadClient(createClient, readFileSync)
const { data: ings } = await s.from('ingredients').select('id, allergens, breaks_diets')
const ING = new Map(ings.map(i => [i.id, i]))

const recipeIds = [...new Set(CANDIDATES.map(c => c[0]))]
const { data: recs } = await s.from('recipes_unified').select('id, ingredients, diet, allergens').in('id', recipeIds).is('deleted_at', null)
const REC = new Map(recs.map(r => [r.id, r]))

const out = []
for (const [rid, op, oldId, newId] of CANDIDATES) {
  const r = REC.get(rid)
  if (!r) { out.push({ rid, op, oldId, newId, status: 'RECETTE INTROUVABLE' }); continue }
  if (!ING.get(newId)) { out.push({ rid, op, oldId, newId, status: 'NOUVEL ID INEXISTANT' }); continue }
  const slots = r.ingredients ?? []
  if (op === 'swap' && !slots.some(sl => (sl.ids ?? []).includes(oldId))) {
    out.push({ rid, op, oldId, newId, status: `ANCIEN ID ABSENT (${oldId})` }); continue
  }
  const before = compute(slots, ING)
  const after = compute(applyOp(slots, rid, op, oldId, newId), ING)
  out.push({ rid, op, oldId, newId, status: 'OK', ...classify(before, after) })
}

// VALIDATION du modèle : union 'before' reproduit-elle le diet/allergènes stockés ?
console.log('\n=== VALIDATION MODÈLE (union before vs stocké) ===')
const seen = new Set()
let dietMatch = 0, dietMiss = 0, alMatch = 0, alMiss = 0
for (const o of out) {
  if (!o.klass || seen.has(o.rid)) continue
  seen.add(o.rid)
  const r = REC.get(o.rid)
  const b = compute(r.ingredients ?? [], ING)
  const dEq = JSON.stringify(b.diet) === JSON.stringify((r.diet ?? []).slice().sort())
  const aEq = JSON.stringify(b.al) === JSON.stringify((r.allergens ?? []).slice().sort())
  dEq ? dietMatch++ : dietMiss++
  aEq ? alMatch++ : alMiss++
}
console.log(`  DIET : match=${dietMatch} miss=${dietMiss}  |  ALLERGÈNES : match=${alMatch} miss=${alMiss}`)

console.log('\n=== PHASE 2 — RE-POINTS (lecture seule) ===\n')
let zero = 0, restr = 0, perm = 0, prob = 0
for (const o of out) {
  if (!o.klass) { prob++; console.log(`⚠️  ${o.rid}  [${o.op}] ${o.oldId ?? ''}→${o.newId}  : ${o.status}`); continue }
  if (o.klass === 'ZERO') zero++; else if (o.klass === 'RESTRICTIF') restr++; else perm++
  const tag = o.klass === 'ZERO' ? '🟢' : o.klass === 'RESTRICTIF' ? '🟡' : '🔴'
  const d = []
  if (o.alAdded.length) d.push(`+al:${o.alAdded.join(',')}`)
  if (o.alRemoved.length) d.push(`-al:${o.alRemoved.join(',')}`)
  if (o.dietRemoved.length) d.push(`-diet:${o.dietRemoved.join(',')}`)
  if (o.dietAdded.length) d.push(`+diet:${o.dietAdded.join(',')}`)
  console.log(`${tag} ${o.klass.padEnd(9)} ${o.rid.padEnd(28)} ${(o.oldId ?? '+').padEnd(20)}→ ${o.newId.padEnd(22)} ${d.join('  ')}`)
}
console.log(`\nTotaux : ZERO=${zero}  RESTRICTIF=${restr}  PERMISSIF=${perm}  PROBLEMES=${prob}  (total ${out.length})`)
