// Staging publisher — insertion AdapterResult dans recipe_imports_staging.
// Refonte Recettes Phase 4 — Sprint 18.
//
// Pattern :
//   1. Run pipeline validators sur parsedData
//   2. Insert staging avec raw_payload + parsed_data + errors + status
//   3. Log événement 'imported' + 'validated'/'invalidated' selon résultat
//
// Idempotency via UNIQUE(source, external_key) du schema P1 :
//   - Si external_key existe déjà → ON CONFLICT DO UPDATE (re-import safe)

import { logEvent } from './events-logger.mjs'

/**
 * Insert ou update 1 AdapterResult dans staging + log event.
 *
 * @param {Object} supabase
 * @param {Object} params
 * @param {string} params.source        - SOURCE_NAME de l'adapter
 * @param {string} params.batchId       - UUID batch
 * @param {Object} params.adapterResult - { externalKey, rawPayload, parsedData }
 * @param {Object} params.validationResult - { status, errors, parsedData } depuis orchestrator.run()
 * @param {string} [params.actorId]     - UUID admin si applicable
 * @param {boolean} [params.backfillAudit] - true si re-validation d'une recette existante
 * @param {string} [params.existingRecipeId] - id recipes_unified si backfill
 * @returns {Promise<{id?: string, error?: any, isNew?: boolean}>}
 */
export async function publishToStaging(supabase, {
  source,
  batchId,
  adapterResult,
  validationResult,
  actorId = null,
  backfillAudit = false,
  existingRecipeId = null,
}) {
  if (!source || !batchId || !adapterResult || !validationResult) {
    return { error: new Error('publishToStaging requires source, batchId, adapterResult, validationResult') }
  }

  const row = {
    batch_id: batchId,
    source,
    external_key: adapterResult.externalKey,
    raw_payload: adapterResult.rawPayload,
    parsed_data: validationResult.parsedData ?? adapterResult.parsedData,
    errors: validationResult.errors ?? [],
    status: validationResult.status === 'invalid' ? 'invalid' : 'pending',
    backfill_audit: backfillAudit,
    existing_recipe_id: existingRecipeId,
  }

  // Upsert via Postgres ON CONFLICT (source, external_key)
  const { data, error } = await supabase
    .from('recipe_imports_staging')
    .upsert(row, { onConflict: 'source,external_key' })
    .select('id')
    .maybeSingle()

  if (error) return { error }

  // Log événement 'imported' puis 'validated' ou 'invalidated'
  await logEvent(supabase, {
    stagingId: data.id,
    eventType: 'imported',
    actorId,
    payload: { source, externalKey: adapterResult.externalKey, errorsCount: validationResult.errors?.length ?? 0 },
  })
  await logEvent(supabase, {
    stagingId: data.id,
    eventType: validationResult.status === 'invalid' ? 'invalidated' : 'validated',
    actorId,
    payload: { errorsCount: validationResult.errors?.length ?? 0 },
  })

  return { id: data.id }
}

/**
 * Re-validate un row staging existant après modification admin.
 *
 * @param {Object} supabase
 * @param {string} stagingId
 * @param {Object} validationResult - Nouveau résultat du pipeline
 * @param {string} actorId - UUID admin qui a déclenché la revalidation
 */
export async function revalidateStaging(supabase, stagingId, validationResult, actorId = null) {
  const { error } = await supabase
    .from('recipe_imports_staging')
    .update({
      parsed_data: validationResult.parsedData,
      errors: validationResult.errors ?? [],
      status: validationResult.status === 'invalid' ? 'invalid' : 'pending',
    })
    .eq('id', stagingId)

  if (error) return { error }

  await logEvent(supabase, {
    stagingId,
    eventType: 'revalidated',
    actorId,
    payload: { errorsCount: validationResult.errors?.length ?? 0 },
  })
  return { ok: true }
}
