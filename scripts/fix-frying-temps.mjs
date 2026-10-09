/**
 * Vague 1 — ajoute la température d'huile (≈170-180 °C, sourcé) aux recettes
 * frites qui n'en indiquaient aucune. Édition CIBLÉE : on remplace une ancre
 * courte dans la SEULE étape de friture (fr + en), le reste est inchangé.
 *
 * Sûreté :
 *   - dry-run par DÉFAUT (affiche les diffs). `--apply` pour écrire en BDD.
 *   - backup systématique des étapes des recettes touchées → backups/...json.
 *   - vérifie que l'ancre existe encore (sinon skip + warn) → pas d'écriture aveugle.
 *
 * Usage : node scripts/fix-frying-temps.mjs            (dry-run)
 *         node scripts/fix-frying-temps.mjs --apply    (écrit en BDD)
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')

function loadEnv() {
  const f = join(root, '.env.local')
  if (!existsSync(f)) return {}
  const env = {}
  for (const line of readFileSync(f, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}
const env = { ...loadEnv(), ...process.env }
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const FR = 'à 170-180 °C'
const FR180 = 'à 180 °C'
const FR175 = 'à 175 °C'
const FR170 = 'à 170 °C'
const EN = 'at 170-180°C (340-355°F)'
const EN180 = 'at 180°C (355°F)'
const EN175 = 'at 175°C (350°F)'
const EN170 = 'at 170°C (340°F)'

// id → { idx, frFind, frRepl, enFind, enRepl }
const CORR = [
  { id: 'agedashi-tofu', idx: 2, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR}`, enFind: 'hot oil', enRepl: `hot oil ${EN}` },
  { id: 'arancini', idx: 3, frFind: 'Frire jusqu', frRepl: `Frire dans l'huile ${FR180} jusqu`, enFind: 'Fry until', enRepl: `Fry in oil ${EN180} until` },
  { id: 'beignets-banane-sesame', idx: 2, frFind: 'Frire jusqu', frRepl: `Frire dans l'huile ${FR} jusqu`, enFind: 'Fry until', enRepl: `Fry in oil ${EN} until` },
  { id: 'calamares-romana', idx: 3, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR180}`, enFind: 'hot oil', enRepl: `hot oil ${EN180}` },
  { id: 'cannoli', idx: 1, frFind: 'les frire jusqu', frRepl: `les frire dans l'huile ${FR180} jusqu`, enFind: 'fry until', enRepl: `fry in oil ${EN180} until` },
  { id: 'churros', idx: 2, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR180}`, enFind: 'hot oil', enRepl: `hot oil ${EN180}` },
  { id: 'crevettes-sel-poivre', idx: 1, frFind: 'Les frire 2-3', frRepl: `Les frire dans l'huile ${FR180} 2-3`, enFind: 'Fry them 2-3', enRepl: `Fry them in oil ${EN180} 2-3` },
  { id: 'croquetas-jambon', idx: 3, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR180}`, enFind: 'hot oil', enRepl: `hot oil ${EN180}` },
  { id: 'karaage', idx: 2, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR}`, enFind: 'hot oil', enRepl: `hot oil ${EN}` },
  { id: 'katsudon', idx: 0, frFind: 'faites-les frire jusqu', frRepl: `faites-les frire dans l'huile ${FR} jusqu`, enFind: 'fry until', enRepl: `fry in oil ${EN} until` },
  { id: 'kibbeh', idx: 3, frFind: 'Faites frire jusqu', frRepl: `Faites frire dans l'huile ${FR175} jusqu`, enFind: 'Fry until', enRepl: `Fry in oil ${EN175} until` },
  { id: 'loukoumades', idx: 1, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR}`, enFind: 'hot oil', enRepl: `hot oil ${EN}` },
  { id: 'nems', idx: 3, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR170}`, enFind: 'hot oil', enRepl: `hot oil ${EN170}` },
  { id: 'onion-rings', idx: 3, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR180}`, enFind: 'hot oil', enRepl: `hot oil ${EN180}` },
  { id: 'pakoras', idx: 2, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR}`, enFind: 'hot oil', enRepl: `hot oil ${EN}` },
  { id: 'poulet-aigre-doux', idx: 0, frFind: 'les frire jusqu', frRepl: `les frire dans l'huile ${FR} jusqu`, enFind: 'fry until', enRepl: `fry in oil ${EN} until` },
  { id: 'poulet-sesame', idx: 0, frFind: 'frire jusqu', frRepl: `frire dans l'huile ${FR} jusqu`, enFind: 'fry until', enRepl: `fry in oil ${EN} until` },
  { id: 'poulet-general-tso', idx: 1, frFind: 'Frire en deux fournées', frRepl: `Frire dans l'huile ${FR} en deux fournées`, enFind: 'Fry in two batches', enRepl: `Fry in oil ${EN} in two batches` },
  { id: 'poulet-coreen-frit', idx: 1, frFind: 'Frire deux fois', frRepl: `Frire deux fois dans l'huile ${FR}`, enFind: 'Fry them twice', enRepl: `Fry them twice in oil ${EN}` },
  { id: 'poulet-katsu-curry', idx: 1, frFind: 'les frire jusqu', frRepl: `les frire dans l'huile ${FR} jusqu`, enFind: 'fry until', enRepl: `fry in oil ${EN} until` },
  { id: 'sopa-azteca', idx: 2, frFind: 'les frire dans l\'huile jusqu', frRepl: `les frire dans l'huile ${FR180} jusqu`, enFind: 'fry in oil until', enRepl: `fry in oil ${EN180} until` },
  { id: 'tonkatsu', idx: 2, frFind: "l'huile chaude", frRepl: `l'huile chaude ${FR}`, enFind: 'hot oil', enRepl: `hot oil ${EN}` },
]

const ids = CORR.map(c => c.id)
const { data: recipes, error } = await supabase
  .from('recipes_unified').select('id, name, steps').in('id', ids)
if (error) { console.error('Lecture :', error.message); process.exit(1) }
const byId = new Map(recipes.map(r => [r.id, r]))

const backup = {}
const updates = []
let skipped = 0

for (const c of CORR) {
  const r = byId.get(c.id)
  if (!r) { console.warn(`⚠️  ${c.id} introuvable — skip`); skipped++; continue }
  const fr = Array.isArray(r.steps?.fr) ? [...r.steps.fr] : null
  const en = Array.isArray(r.steps?.en) ? [...r.steps.en] : null
  if (!fr || !en) { console.warn(`⚠️  ${c.id} steps fr/en absents — skip`); skipped++; continue }
  const frStep = fr[c.idx], enStep = en[c.idx]
  if (!frStep?.includes(c.frFind) || !enStep?.includes(c.enFind)) {
    console.warn(`⚠️  ${c.id} ancre introuvable (déjà corrigé ou texte changé) — skip`)
    skipped++; continue
  }
  if (frStep.includes('°') || enStep.includes('°C')) { console.warn(`⚠️  ${c.id} a déjà une température — skip`); skipped++; continue }
  backup[c.id] = { fr: r.steps.fr, en: r.steps.en }
  fr[c.idx] = frStep.replace(c.frFind, c.frRepl)
  en[c.idx] = enStep.replace(c.enFind, c.enRepl)
  updates.push({ id: c.id, steps: { ...r.steps, fr, en } })
  console.log(`\n── ${c.id} (étape ${c.idx})`)
  console.log(`  FR  ${frStep}`)
  console.log(`   →  ${fr[c.idx]}`)
  console.log(`  EN  ${enStep}`)
  console.log(`   →  ${en[c.idx]}`)
}

console.log(`\n${updates.length} à corriger · ${skipped} sautées · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)

if (!APPLY) { console.log('\n(dry-run — relance avec --apply pour écrire)'); process.exit(0) }

// backup avant écriture
const dir = join(root, 'backups')
if (!existsSync(dir)) mkdirSync(dir)
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const bpath = join(dir, `recipes-frying-temp-backup-${stamp}.json`)
writeFileSync(bpath, JSON.stringify(backup, null, 2))
console.log(`\nBackup → ${bpath}`)

for (const u of updates) {
  const { error: e } = await supabase.from('recipes_unified').update({ steps: u.steps }).eq('id', u.id)
  if (e) console.error(`  ✗ ${u.id} : ${e.message}`)
  else console.log(`  ✓ ${u.id}`)
}
console.log('\nÉcriture terminée.')
