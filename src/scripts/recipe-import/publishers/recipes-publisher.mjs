// Recipes publisher — promeut une row staging vers recipes_unified (origin='official')
// et logue l'événement 'published'. Refonte Recettes Phase 5a.
//
// Flow :
//   1. Fetch staging row (parsed_data + status)
//   2. Guard : status ∈ {pending, valid}
//   3. INSERT recipes_unified (origin=official, status=published)
//      → trigger D22 auto-derive allergens + diet
//   4. UPDATE staging : status=published, published_recipe_id, resolved_at/by
//   5. Log event 'published' (erreur ignorée — ne bloque pas la publication)
//
// Garanties :
//   - Rollback : si INSERT fail, pas d'UPDATE staging
//   - Event log : erreur ignorée par logEvent — ne bloque pas la publication

import { logEvent } from './events-logger.mjs'

const PUBLISHABLE_STATUSES = new Set(['pending', 'valid'])

/**
 * Publie 1 staging row vers recipes_unified.
 *
 * @param {Object} supabase
 * @param {Object} params
 * @param {string} params.stagingId  - UUID staging row
 * @param {string} params.actorId    - UUID admin qui publie (audit trail)
 * @returns {Promise<{recipeId?: string, error?: any}>}
 */
export async function publishStagingToRecipes(supabase, { stagingId, actorId = null }) {
  if (!stagingId) return { error: new Error('publishStagingToRecipes requires stagingId') }

  const { data: staging, error: fetchErr } = await supabase
    .from('recipe_imports_staging')
    .select('id, parsed_data, status')
    .eq('id', stagingId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr }
  if (!staging) return { error: new Error(`Staging row introuvable: ${stagingId}`) }

  if (!PUBLISHABLE_STATUSES.has(staging.status)) {
    return { error: new Error(`Cannot publish staging with status="${staging.status}" (allowed: pending|valid)`) }
  }

  const parsed = staging.parsed_data ?? {}
  const recipeRow = {
    id:              parsed.id,
    origin:          'official',
    status:          'published',
    // 🔴 Absent jusqu'au 2026-08-28 : l'adaptateur récupérait bien la photo,
    // le validateur la transmettait, l'espace de transit la stockait — et
    // cette ligne la jetait. Toute recette publiée par la file d'import
    // arrivait sans image, sans le moindre signal.
    image_url:       parsed.image_url        ?? null,
    name:            parsed.name             ?? null,
    title:           parsed.title            ?? null,
    description:     parsed.description      ?? null,
    emoji:           parsed.emoji            ?? null,
    time_min:        parsed.time_min         ?? null,
    prep_time_min:   parsed.prep_time_min    ?? null,
    cook_time_min:   parsed.cook_time_min    ?? null,
    difficulty:      parsed.difficulty       ?? null,
    type:            parsed.type             ?? null,
    servings:        parsed.servings         ?? null,
    country:         parsed.country          ?? null,
    diet:            parsed.diet             ?? [],
    allergens:       parsed.allergens        ?? [],
    ingredients:     parsed.ingredients      ?? [],
    steps:           parsed.steps            ?? [],
    functional_tags: parsed.functional_tags  ?? [],
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('recipes_unified')
    .insert(recipeRow)
    .select('id')
    .maybeSingle()

  if (insertErr) return { error: insertErr }
  if (!inserted) return { error: new Error('INSERT recipes_unified returned no row') }

  const { error: updateErr } = await supabase
    .from('recipe_imports_staging')
    .update({
      status: 'published',
      published_recipe_id: inserted.id,
      resolved_at: new Date().toISOString(),
      resolved_by: actorId,
    })
    .eq('id', stagingId)

  if (updateErr) return { error: updateErr }

  // Log event (erreur ignorée par logEvent — n'invalide pas la publication)
  await logEvent(supabase, {
    stagingId,
    eventType: 'published',
    actorId,
    payload: { recipeId: inserted.id },
  })

  return { recipeId: inserted.id, error: null }
}

/**
 * Rejette une staging row (status=rejected + admin_notes + event log).
 *
 * @param {Object} supabase
 * @param {Object} params
 * @param {string} params.stagingId  - UUID staging row
 * @param {string} [params.reason]   - Raison du rejet (admin_notes)
 * @param {string} params.actorId    - UUID admin qui rejette
 * @returns {Promise<{error?: any}>}
 */
export async function rejectStaging(supabase, { stagingId, reason, actorId = null }) {
  if (!stagingId) return { error: new Error('rejectStaging requires stagingId') }

  const notes = reason?.trim() || 'no reason'

  const { error } = await supabase
    .from('recipe_imports_staging')
    .update({
      status: 'rejected',
      admin_notes: notes,
      resolved_at: new Date().toISOString(),
      resolved_by: actorId,
    })
    .eq('id', stagingId)

  if (error) return { error }

  await logEvent(supabase, {
    stagingId,
    eventType: 'rejected',
    actorId,
    payload: { reason: notes },
  })

  return { error: null }
}
