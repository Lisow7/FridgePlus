/**
 * Niveau A (suite) — mentionne dans une étape un ingrédient DÉJÀ listé mais
 * inutilisé (défaut sûr = on garde l'ingrédient). Pur texte. Même garde-fou
 * ancre que fix-recipe-mentions.mjs.
 *
 * Usage : node scripts/fix-recipe-mentions-2.mjs [--apply]
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

const EDITS = [
  { id: 'champignons-toast', idx: 2, frFind: "Ajouter l'ail, le persil, sel et poivre", frRepl: "Ajouter l'ail, le persil, la crème fraîche, sel et poivre", enFind: 'Add the garlic, parsley, salt and pepper', enRepl: 'Add the garlic, parsley, crème fraîche, salt and pepper' },
  { id: 'mousse-citron', idx: 2, frFind: 'Monter les blancs en neige ferme et les incorporer délicatement.', frRepl: 'Monter la crème en chantilly et les blancs en neige ferme, puis les incorporer délicatement.', enFind: 'Whisk the egg whites to stiff peaks and fold in gently.', enRepl: 'Whip the cream to soft peaks, whisk the egg whites to stiff peaks, and fold in gently.' },
  { id: 'oeufs-cocotte', idx: 1, frFind: 'Verser 1 c. à soupe de crème fraîche dans chaque ramequin.', frRepl: 'Répartir les lardons au fond des ramequins, verser 1 c. à soupe de crème fraîche et parsemer de fromage râpé.', enFind: 'Spoon 1 tbsp crème fraîche into each ramekin.', enRepl: 'Place the lardons in the ramekins, spoon in 1 tbsp crème fraîche and scatter with grated cheese.' },
  { id: 'oeufs-cocotte', idx: 3, frFind: 'le jaune coulant.', frRepl: 'le jaune coulant. Parsemer de ciboulette ciselée avant de servir.', enFind: 'the yolk still runny.', enRepl: 'the yolk still runny. Scatter with snipped chives before serving.' },
  { id: 'oeufs-brouilles', idx: 3, frFind: 'ajouter 2 c. à soupe de crème.', frRepl: 'ajouter 2 c. à soupe de crème et le fromage râpé.', enFind: 'stir in 2 tbsp cream.', enRepl: 'stir in 2 tbsp cream and the grated cheese.' },
  { id: 'salade-melon-jambon', idx: 2, frFind: "Assaisonner d'un filet d'huile d'olive et de poivre.", frRepl: "Dresser sur un lit de salade verte, assaisonner d'un filet d'huile d'olive, de vinaigre balsamique et de poivre.", enFind: 'Season with a drizzle of olive oil and pepper.', enRepl: 'Arrange on a bed of green salad, season with a drizzle of olive oil, balsamic vinegar and pepper.' },
  { id: 'salade-radis-concombre', idx: 2, frFind: 'Préparer la vinaigrette : jus de citron, huile', frRepl: 'Préparer la sauce : yaourt, jus de citron, huile', enFind: 'Make the dressing: lemon juice, oil', enRepl: 'Make the dressing: yogurt, lemon juice, oil' },
  { id: 'pommes-terre-sautees', idx: 3, frFind: 'Retourner et cuire encore 5 min.', frRepl: "Ajouter l'oignon émincé, retourner et cuire encore 5 min.", enFind: 'Flip and cook another 5 min.', enRepl: 'Add the sliced onion, flip and cook another 5 min.' },
  { id: 'gratin-courgettes', idx: 1, frFind: "Faites sauter les rondelles avec l'ail et 2 c. à soupe d'huile d'olive", frRepl: "Faites sauter les rondelles avec l'oignon émincé, l'ail et 2 c. à soupe d'huile d'olive", enFind: 'Sauté the rounds with the garlic and 2 tbsp olive oil', enRepl: 'Sauté the rounds with the sliced onion, garlic and 2 tbsp olive oil' },
  { id: 'compote-pommes', idx: 0, frFind: 'couper les pommes en morceaux.', frRepl: 'couper les pommes et les poires en morceaux.', enFind: 'cut the apples into chunks.', enRepl: 'cut the apples and pears into chunks.' },
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
  console.log(`  ✎ ${e.id}[${e.idx}]`)
  ok++
}
console.log(`\n${ok} mentions sur ${updates.size} recettes · ${skip} sautées · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
if (!APPLY) { console.log('\n(dry-run — relance avec --apply)'); process.exit(0) }

const dir = join(root, 'backups'); if (!existsSync(dir)) mkdirSync(dir)
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const bpath = join(dir, `recipes-mentions2-backup-${stamp}.json`)
writeFileSync(bpath, JSON.stringify(backup, null, 2)); console.log(`\nBackup → ${bpath}`)
for (const [rid, cur] of updates) {
  const steps = { ...byId.get(rid).steps, fr: cur.fr, en: cur.en }
  const { error: er } = await supabase.from('recipes_unified').update({ steps }).eq('id', rid)
  if (er) console.error(`  ✗ ${rid} : ${er.message}`); else console.log(`  ✓ ${rid}`)
}
console.log('\nÉcriture terminée.')
