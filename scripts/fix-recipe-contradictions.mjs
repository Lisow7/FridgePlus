/**
 * Niveau A — corrige les CONTRADICTIONS étapes↔ingrédients (étapes décrivant
 * un autre plat). Pur texte d'étape, aucun impact ingrédient/allergène.
 *
 *   - clafoutis : étapes « cerises » alors que l'ingrédient est l'abricot
 *     (+ alts framboise/fraise) → « les fruits ».
 *   - potage-saint-germain : étapes « pois cassés / lard / carottes » alors que
 *     les ingrédients listés sont petits pois, oignon, beurre, bouillon, crème,
 *     menthe → réécriture alignée sur les ingrédients réels.
 *
 * Sûreté : dry-run par défaut ; --apply écrit ; backup d'abord ; garde-fou =
 * on ne réécrit QUE si la chaîne « guard » (preuve du bug) est encore présente.
 *
 * Usage : node scripts/fix-recipe-contradictions.mjs [--apply]
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

// id → { guard (doit être présent dans steps.fr joint), fr:[...], en:[...] }
const FIX = {
  'clafoutis': {
    guard: 'cerises',
    fr: [
      'Préchauffer le four à 180°C. Beurrer un plat et saupoudrer de sucre.',
      "Battre les œufs avec le sucre. Ajouter la farine tamisée, le lait et la vanille ; fouetter jusqu'à obtenir un appareil lisse comme une pâte à crêpes.",
      "Disposer les fruits dans le plat, verser l'appareil par-dessus.",
      "Cuire 35-40 min sans ouvrir le four (le clafoutis gonfle puis s'affaisse en refroidissant, c'est normal).",
      'Saupoudrer de sucre glace et servir tiède ou à température ambiante.',
    ],
    en: [
      'Preheat the oven to 180°C. Butter a dish and dust with sugar.',
      'Beat the eggs with the sugar. Add the sifted flour, milk and vanilla; whisk to a smooth batter, about the consistency of crêpe batter.',
      'Arrange the fruit in the dish and pour the batter over.',
      'Bake 35-40 min without opening the oven (the clafoutis puffs then deflates on cooling — this is normal).',
      'Dust with icing sugar and serve warm or at room temperature.',
    ],
  },
  'potage-saint-germain': {
    guard: 'pois cassés',
    fr: [
      "Faire fondre les 30g de beurre dans une casserole et faire revenir l'oignon émincé.",
      'Ajouter les 500g de petits pois et 75 cl de bouillon de légumes ; porter à ébullition.',
      'Cuire 15 min à feu doux jusqu\'à ce que les petits pois soient tendres.',
      'Retirer du feu, mixer, incorporer 10 cl de crème et quelques feuilles de menthe ; rectifier l\'assaisonnement.',
    ],
    en: [
      'Melt the 30g butter in a saucepan and sauté the sliced onion.',
      'Add the 500g peas and 750ml vegetable stock; bring to the boil.',
      'Cook 15 min over low heat until the peas are tender.',
      'Off the heat, blend, stir in 100ml cream and a few mint leaves; adjust seasoning.',
    ],
  },
}

const ids = Object.keys(FIX)
const { data: recipes, error } = await supabase.from('recipes_unified').select('id, steps').in('id', ids)
if (error) { console.error('Lecture :', error.message); process.exit(1) }
const byId = new Map(recipes.map(r => [r.id, r]))

const backup = {}
const updates = []
for (const id of ids) {
  const r = byId.get(id); const f = FIX[id]
  if (!r) { console.warn(`⚠️  ${id} introuvable — skip`); continue }
  const curFr = (r.steps?.fr ?? []).join(' ')
  if (!curFr.includes(f.guard)) { console.warn(`⚠️  ${id} : garde-fou « ${f.guard} » absent (déjà corrigé ?) — skip`); continue }
  backup[id] = r.steps
  updates.push({ id, steps: { ...r.steps, fr: f.fr, en: f.en } })
  console.log(`\n── ${id}`)
  ;(r.steps.fr ?? []).forEach((s, i) => { if (s !== f.fr[i]) console.log(`  FR[${i}] AVANT: ${s}\n  FR[${i}] APRÈS: ${f.fr[i]}`) })
}

console.log(`\n${updates.length} recette(s) à corriger · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
if (!APPLY) { console.log('\n(dry-run — relance avec --apply)'); process.exit(0) }

const dir = join(root, 'backups'); if (!existsSync(dir)) mkdirSync(dir)
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const bpath = join(dir, `recipes-contradictions-backup-${stamp}.json`)
writeFileSync(bpath, JSON.stringify(backup, null, 2)); console.log(`\nBackup → ${bpath}`)
for (const u of updates) {
  const { error: e } = await supabase.from('recipes_unified').update({ steps: u.steps }).eq('id', u.id)
  if (e) console.error(`  ✗ ${u.id} : ${e.message}`); else console.log(`  ✓ ${u.id}`)
}
console.log('\nÉcriture terminée.')
