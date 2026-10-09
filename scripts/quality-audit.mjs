/**
 * Diagnostic qualité — lit les 2 vues health_check Supabase et affiche
 * un résumé des problèmes par catégorie.
 * Usage : node scripts/quality-audit.mjs
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
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── Recettes ──────────────────────────────────────────────────────────────────
const { data: recipes } = await supabase
  .from('recipe_health_check')
  .select('id, name_fr, status, country, issues, updated_at')

const recipeIssues = (recipes ?? []).filter(r => r.issues?.length)

console.log(`\n🍳  RECETTES — ${recipeIssues.length} avec problèmes\n`)

const recipeByIssue = {}
for (const r of recipeIssues) {
  for (const issue of r.issues) {
    if (!recipeByIssue[issue]) recipeByIssue[issue] = []
    recipeByIssue[issue].push(r.id + ' (' + (r.name_fr ?? '—') + ')')
  }
}

for (const [issue, ids] of Object.entries(recipeByIssue).sort()) {
  console.log(`  [${ids.length}] ${issue}`)
  for (const id of ids) console.log(`        • ${id}`)
}

// ── Ingrédients ───────────────────────────────────────────────────────────────
const { data: ingredients } = await supabase
  .from('ingredient_health_check')
  .select('id, label_fr, subcategory, issues, updated_at')

const ingIssues = (ingredients ?? []).filter(i => i.issues?.length)

console.log(`\n🥕  INGRÉDIENTS — ${ingIssues.length} avec problèmes\n`)

const ingByIssue = {}
for (const i of ingIssues) {
  for (const issue of i.issues) {
    if (!ingByIssue[issue]) ingByIssue[issue] = []
    ingByIssue[issue].push({ id: i.id, label: i.label_fr ?? '—', subcategory: i.subcategory })
  }
}

for (const [issue, items] of Object.entries(ingByIssue).sort()) {
  console.log(`  [${items.length}] ${issue}`)
  if (items.length <= 30) {
    for (const it of items) console.log(`        • ${it.id} (${it.label}) [${it.subcategory}]`)
  } else {
    for (const it of items.slice(0, 10)) console.log(`        • ${it.id} (${it.label}) [${it.subcategory}]`)
    console.log(`        … et ${items.length - 10} autres`)
  }
}

console.log('\n✅  Audit terminé.')
