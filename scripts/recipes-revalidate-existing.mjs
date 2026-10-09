#!/usr/bin/env node
// CLI — npm run recipes:revalidate-existing -- [--batch=<id>] [--limit=<n>] [--only-issues]
// Refonte Recettes Phase 9 — backfill audit existantes.
//
// Pull all recipes_unified rows (origin='official', not soft-deleted), run the
// 7 validators pipeline on each, and surface recipes with issues in the admin
// import queue (status='invalid' with errors persisted).
//
// Goal : detect quality issues on legacy recipes (missing description.en,
// missing emoji, orphan ingredients, etc.) before launch.
//
// Usage :
//   npm run recipes:revalidate-existing
//   npm run recipes:revalidate-existing -- --limit=10
//   npm run recipes:revalidate-existing -- --batch=audit-2026-05-18
//   npm run recipes:revalidate-existing -- --only-issues=false   (stage all, even clean)
//
// Prérequis env :
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (admin bypass RLS)

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

import { createOrchestrator } from '../src/scripts/recipe-import/pipeline/orchestrator.mjs'
import { completenessValidator } from '../src/scripts/recipe-import/validators/completeness-validator.mjs'
import { ingredientMapper } from '../src/scripts/recipe-import/validators/ingredient-mapper.mjs'
import { nutritionValidator } from '../src/scripts/recipe-import/validators/nutrition-validator.mjs'
import { stepsValidator } from '../src/scripts/recipe-import/validators/steps-validator.mjs'
import { dietConsistencyChecker } from '../src/scripts/recipe-import/validators/diet-consistency-checker.mjs'
import { duplicateDetector } from '../src/scripts/recipe-import/validators/duplicate-detector.mjs'
import { relationsResolver } from '../src/scripts/recipe-import/validators/relations-resolver.mjs'
import { seoSchemaValidator } from '../src/scripts/recipe-import/validators/seo-schema-validator.mjs'
import { schemaVersionDetector } from '../src/scripts/recipe-import/validators/schema-version-detector.mjs'
import { publishToStaging } from '../src/scripts/recipe-import/publishers/staging-publisher.mjs'

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
    seoSchemaValidator,
    schemaVersionDetector,  // P11.d — flag les recettes legacy array format
  ])
}

async function main() {
  const args = parseArgs(process.argv)
  // Pareil que recipes-import.mjs : batch_id est typé UUID en BDD.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const userBatchLabel = args.batch
  const batchId = (userBatchLabel && UUID_RE.test(userBatchLabel)) ? userBatchLabel : randomUUID()
  if (userBatchLabel && !UUID_RE.test(userBatchLabel)) {
    console.log(`ℹ --batch="${userBatchLabel}" n'est pas un UUID — auto-généré : ${batchId}`)
  }
  const limit = args.limit ? Number(args.limit) : null
  // --only-issues defaults to true; pass --only-issues=false to stage clean recipes too
  const onlyIssues = args['only-issues'] !== 'false'

  // Accepte SUPABASE_URL OU VITE_SUPABASE_URL (souvent déjà set dans .env.local pour le front Vite).
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Required env: SUPABASE_URL (ou VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  console.log('→ Loading context...')
  const context = await loadContext(supabase)
  console.log(`  ${context.ingredients.size} ingredients, ${context.existingRecipes.size} existing recipes`)

  console.log('→ Fetching recipes_unified (origin=official, not deleted)...')
  let query = supabase
    .from('recipes_unified')
    .select('id, name, description, emoji, time_min, prep_time_min, cook_time_min, difficulty, type, servings, country, diet, allergens, ingredients, steps, image_url, status, functional_tags, created_at')
    .eq('origin', 'official')
    .is('deleted_at', null)
  if (limit) query = query.limit(limit)

  const { data: recipes, error: fetchErr } = await query
  if (fetchErr) {
    console.error('Fetch failed:', fetchErr.message)
    process.exit(1)
  }
  console.log(`  ${recipes?.length ?? 0} recipes to audit`)

  if (limit) console.log(`  (limited to ${limit} for testing)`)
  if (!onlyIssues) console.log('  (--only-issues=false : staging clean recipes too)')

  const pipeline = makePipeline()
  const counts = { total: 0, clean: 0, withIssues: 0, errors: 0 }

  for (const recipe of recipes ?? []) {
    counts.total++

    // Reconstruct parsedData matching adapter output shape.
    // Tag as 'published' so completenessValidator applies its strictest rules.
    const parsedData = { ...recipe, status: 'published' }

    const validationResult = await pipeline.run(parsedData, context)

    if (validationResult.errors.length === 0) {
      counts.clean++
      if (!onlyIssues) {
        // Stage even clean recipes when requested
        await publishToStaging(supabase, {
          source: 'backfill_audit',
          batchId,
          adapterResult: {
            externalKey: `backfill-${recipe.id}`,
            rawPayload: recipe,
            parsedData,
          },
          validationResult,
          backfillAudit: true,
          existingRecipeId: recipe.id,
        })
      }
      process.stdout.write('.')
      continue
    }

    // Has issues → stage for admin review
    const { error } = await publishToStaging(supabase, {
      source: 'backfill_audit',
      batchId,
      adapterResult: {
        externalKey: `backfill-${recipe.id}`,
        rawPayload: recipe,
        parsedData,
      },
      validationResult,
      backfillAudit: true,
      existingRecipeId: recipe.id,
    })

    if (error) {
      counts.errors++
      console.error(`\n  ✗ ${recipe.id}: ${error.message}`)
      continue
    }

    counts.withIssues++
    process.stdout.write('!')
  }

  console.log('\n')
  console.log(`✓ Done. Total: ${counts.total}, Clean: ${counts.clean}, With issues: ${counts.withIssues}, Insert errors: ${counts.errors}`)
  console.log(`  Batch ID: ${batchId}`)
  console.log(`  Admin queue :`)
  console.log(`    SELECT id, parsed_data->>'id' AS recipe_id, jsonb_array_length(errors) AS error_count, errors`)
  console.log(`    FROM recipe_imports_staging`)
  console.log(`    WHERE batch_id = '${batchId}'`)
  console.log(`    ORDER BY error_count DESC;`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
