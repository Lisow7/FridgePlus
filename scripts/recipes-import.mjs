#!/usr/bin/env node
// CLI — npm run recipes:import -- --source=<name> [--batch=<id>] [...adapter options]
// Refonte Recettes Phase 4 — Sprint 18.
//
// Usage :
//   npm run recipes:import -- --source=themealdb --batch=launch-1
//   npm run recipes:import -- --source=json_file --path=./recipes.json
//
// Prérequis env :
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (admin bypass RLS pour batch import)
//
// Flow :
//   1. Init Supabase client + load context (catalogue ingredients, existing recipes)
//   2. Run adapter.fetch() puis adapter.normalize() pour chaque item
//   3. Run pipeline orchestrator (7 validators)
//   4. Insert staging via publishToStaging + log events
//   5. Print summary (total / valid / invalid)

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

import { createOrchestrator } from '../src/scripts/recipe-import/pipeline/orchestrator.mjs'
import { themealdbAdapter } from '../src/scripts/recipe-import/adapters/themealdb-adapter.mjs'
import { jsonFileAdapter } from '../src/scripts/recipe-import/adapters/json-file-adapter.mjs'
import { adminUiAdapter } from '../src/scripts/recipe-import/adapters/admin-ui-adapter.mjs'
import { ingredientMapper } from '../src/scripts/recipe-import/validators/ingredient-mapper.mjs'
import { nutritionValidator } from '../src/scripts/recipe-import/validators/nutrition-validator.mjs'
import { stepsValidator } from '../src/scripts/recipe-import/validators/steps-validator.mjs'
import { dietConsistencyChecker } from '../src/scripts/recipe-import/validators/diet-consistency-checker.mjs'
import { duplicateDetector } from '../src/scripts/recipe-import/validators/duplicate-detector.mjs'
import { completenessValidator } from '../src/scripts/recipe-import/validators/completeness-validator.mjs'
import { relationsResolver } from '../src/scripts/recipe-import/validators/relations-resolver.mjs'
import { publishToStaging } from '../src/scripts/recipe-import/publishers/staging-publisher.mjs'

const ADAPTERS = {
  themealdb: themealdbAdapter,
  json_file: jsonFileAdapter,
  admin_ui: adminUiAdapter,
}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=')
      const value = valueParts.length ? valueParts.join('=') : true
      args[key] = value
    }
  }
  return args
}

async function loadContext(supabase) {
  const [{ data: ingredients }, { data: recipes }] = await Promise.all([
    supabase.from('ingredients').select('id, labels, allergens, breaks_diets'),
    supabase.from('recipes_unified').select('id, name').is('deleted_at', null),
  ])

  const ingredientsMap = new Map((ingredients ?? []).map(i => [i.id, i]))
  const existingRecipes = new Map()
  const recipesByNameAndId = new Map()
  for (const r of recipes ?? []) {
    recipesByNameAndId.set(r.id, r.id)
    const frName = r.name?.fr
    if (frName) {
      const norm = frName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
      existingRecipes.set(norm, r.id)
      recipesByNameAndId.set(norm, r.id)
    }
  }
  return { ingredients: ingredientsMap, existingRecipes, recipesByNameAndId }
}

function makePipeline() {
  return createOrchestrator([
    completenessValidator,
    ingredientMapper,
    nutritionValidator,
    stepsValidator,
    dietConsistencyChecker,
    duplicateDetector,
    relationsResolver,
  ])
}

async function main() {
  const args = parseArgs(process.argv)
  const source = args.source
  // recipe_imports_staging.batch_id est typé UUID. Si l'user passe une string
  // non-UUID (ex: --batch=test-mini), on auto-génère et on log un mapping clair.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const userBatchLabel = args.batch
  const batchId = (userBatchLabel && UUID_RE.test(userBatchLabel)) ? userBatchLabel : randomUUID()
  if (userBatchLabel && !UUID_RE.test(userBatchLabel)) {
    console.log(`ℹ --batch="${userBatchLabel}" n'est pas un UUID — auto-généré : ${batchId}`)
  }

  if (!source || !ADAPTERS[source]) {
    console.error('Usage: npm run recipes:import -- --source=<themealdb|json_file|ia|admin_ui> [--batch=<id>] [...options]')
    console.error(`Available adapters: ${Object.keys(ADAPTERS).join(', ')}`)
    process.exit(1)
  }

  // Accepte SUPABASE_URL OU VITE_SUPABASE_URL (souvent déjà set dans .env.local pour le front Vite).
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Required env: SUPABASE_URL (ou VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  console.log(`→ Loading context...`)
  const context = await loadContext(supabase)
  console.log(`  ${context.ingredients.size} ingredients, ${context.existingRecipes.size} existing recipes`)

  console.log(`→ Running adapter "${source}" with batch "${batchId}"...`)
  const adapter = ADAPTERS[source]

  // Adapter options : passe tous les args restants à fetch()
  const adapterOptions = { ...args }
  delete adapterOptions.source
  delete adapterOptions.batch
  // remap snake_case args si nécessaire
  if (adapterOptions['api-key']) adapterOptions.apiKey = adapterOptions['api-key']

  const adapterResults = await adapter.run(adapterOptions, context)
  console.log(`  ${adapterResults.length} items fetched`)

  const pipeline = makePipeline()
  let counts = { total: 0, valid: 0, invalid: 0, errors: 0 }

  for (const adapterResult of adapterResults) {
    counts.total++
    const validationResult = await pipeline.run(adapterResult.parsedData, context)
    const { error } = await publishToStaging(supabase, {
      source,
      batchId,
      adapterResult,
      validationResult,
    })
    if (error) {
      counts.errors++
      console.error(`  ✗ ${adapterResult.externalKey}: ${error.message}`)
      continue
    }
    if (validationResult.status === 'invalid') counts.invalid++
    else counts.valid++
    process.stdout.write('.')
  }

  console.log('\n')
  console.log(`✓ Done. Total: ${counts.total}, Valid: ${counts.valid}, Invalid: ${counts.invalid}, Errors: ${counts.errors}`)
  console.log(`  Batch ID: ${batchId}`)
  console.log(`  Admin queue : SELECT * FROM recipe_imports_staging WHERE batch_id = '${batchId}' AND status = 'invalid';`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
