/**
 * Niveau A — mentionne dans une étape un ingrédient DÉJÀ listé mais oublié des
 * étapes. Pur texte (l'ingrédient est déjà dans la liste → aucun impact sur le
 * % match / produit). Remplacement ciblé par ancre dans la seule étape visée.
 *
 * Sûreté : dry-run par défaut ; --apply écrit ; backup d'abord ; ne modifie que
 * si l'ancre est présente dans l'étape ciblée (sinon skip).
 *
 * Usage : node scripts/fix-recipe-mentions.mjs [--apply]
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

// { id, idx, frFind, frRepl, enFind, enRepl }
const EDITS = [
  { id: 'brocoli-citron', idx: 3, frFind: "d'huile d'olive et servir sans attendre", frRepl: "d'huile d'olive, parsemer d'amandes effilées et servir sans attendre", enFind: 'with olive oil and serve straight away', enRepl: 'with olive oil, scatter flaked almonds and serve straight away' },
  { id: 'bruschetta-tomate', idx: 0, frFind: "d'huile, sel et basilic", frRepl: "d'huile, d'un trait de vinaigre balsamique, sel et basilic", enFind: 'with oil, salt and shredded basil', enRepl: 'with oil, a drizzle of balsamic, salt and shredded basil' },
  { id: 'bruschetta-tomate', idx: 3, frFind: 'Répartir la tomate sur les tranches', frRepl: 'Répartir la tomate et la mozzarella en lamelles sur les tranches', enFind: 'Spoon the tomato mixture over the slices and serve', enRepl: 'Spoon the tomato mixture and sliced mozzarella over the slices and serve' },
  { id: 'champignons-persillade', idx: 3, frFind: 'Assaisonner et servir chaud', frRepl: "Assaisonner d'un filet de jus de citron et servir chaud", enFind: 'Season and serve hot', enRepl: 'Season with a squeeze of lemon juice and serve hot' },
  { id: 'compote-poire-vanille', idx: 1, frFind: "un peu d'eau et la vanille", frRepl: "un peu d'eau, la vanille, la cannelle et un trait de jus de citron", enFind: 'a little water and the vanilla', enRepl: 'a little water, the vanilla, the cinnamon and a squeeze of lemon' },
  { id: 'riz-pilaf', idx: 2, frFind: 'assaisonner avec le laurier', frRepl: 'assaisonner avec le laurier et le thym', enFind: 'add the bay leaf', enRepl: 'add the bay leaf and thyme' },
  { id: 'salade-caprese', idx: 3, frFind: "Arroser d'huile d'olive, saler et poivrer", frRepl: "Arroser d'huile d'olive et d'un filet de vinaigre balsamique, saler et poivrer", enFind: 'Drizzle with olive oil, salt and pepper', enRepl: 'Drizzle with olive oil and a little balsamic, season with salt and pepper' },
]

const ids = [...new Set(EDITS.map(e => e.id))]
const { data: recipes, error } = await supabase.from('recipes_unified').select('id, steps').in('id', ids)
if (error) { console.error('Lecture :', error.message); process.exit(1) }
const byId = new Map(recipes.map(r => [r.id, r]))

const backup = {}
const updates = new Map()
let ok = 0, skip = 0
for (const e of EDITS) {
  const r = byId.get(e.id); if (!r) { console.warn(`⚠️  ${e.id} introuvable — skip`); skip++; continue }
  const cur = updates.get(e.id) ?? { fr: [...(r.steps?.fr ?? [])], en: [...(r.steps?.en ?? [])] }
  const fr = cur.fr[e.idx], en = cur.en[e.idx]
  if (!fr?.includes(e.frFind) || !en?.includes(e.enFind)) { console.warn(`⚠️  ${e.id}[${e.idx}] ancre absente — skip`); skip++; continue }
  if (!backup[e.id]) backup[e.id] = r.steps
  cur.fr[e.idx] = fr.replace(e.frFind, e.frRepl)
  cur.en[e.idx] = en.replace(e.enFind, e.enRepl)
  updates.set(e.id, cur)
  console.log(`  ✎ ${e.id}[${e.idx}] : …${e.frRepl}…`)
  ok++
}
console.log(`\n${ok} mentions sur ${updates.size} recettes · ${skip} sautées · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
if (!APPLY) { console.log('\n(dry-run — relance avec --apply)'); process.exit(0) }

const dir = join(root, 'backups'); if (!existsSync(dir)) mkdirSync(dir)
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const bpath = join(dir, `recipes-mentions-backup-${stamp}.json`)
writeFileSync(bpath, JSON.stringify(backup, null, 2)); console.log(`\nBackup → ${bpath}`)
for (const [rid, cur] of updates) {
  const steps = { ...byId.get(rid).steps, fr: cur.fr, en: cur.en }
  const { error: er } = await supabase.from('recipes_unified').update({ steps }).eq('id', rid)
  if (er) console.error(`  ✗ ${rid} : ${er.message}`); else console.log(`  ✓ ${rid}`)
}
console.log('\nÉcriture terminée.')
