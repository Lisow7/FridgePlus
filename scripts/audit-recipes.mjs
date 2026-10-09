/**
 * Audit qualité des recettes officielles : signale les recettes incomplètes ou
 * aux ids d'ingrédients orphelins (ni nutrition ni coût calculables).
 * CONSTAT en lecture seule (aucune correction de données).
 *
 * Réutilise le validateur pur getRecipeIssues (import-safe Node, sans alias @).
 * Usage : node scripts/audit-recipes.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getRecipeIssues } from '../src/shared/lib/recipes/recipe-completeness.js'

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
const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Env Supabase manquantes (.env.local : VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// Ensemble des ids d'ingrédients connus au catalogue.
const { data: ingredients, error: ingErr } = await supabase.from('ingredients').select('id')
if (ingErr) { console.error('Lecture ingredients :', ingErr.message); process.exit(1) }
const known = new Set((ingredients ?? []).map(r => r.id))
const resolveId = (id) => known.has(id)

// Recettes officielles à auditer.
const { data: recipes, error: recErr } = await supabase
  .from('recipes_unified').select('id, data').eq('origin', 'official')
if (recErr) { console.error('Lecture recipes_unified :', recErr.message); process.exit(1) }

let flagged = 0
for (const r of recipes ?? []) {
  const issues = getRecipeIssues(r.data ?? {}, resolveId)
  if (issues.length) { flagged++; console.log(`⚠️  ${r.id} : ${issues.join(', ')}`) }
}
console.log(`\n${flagged}/${(recipes ?? []).length} recette(s) à examiner.`)
