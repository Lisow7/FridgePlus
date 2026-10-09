// Events logger — insertion dans recipe_import_events (event sourcing light).
// Refonte Recettes Phase 4 — Sprint 18.
//
// Pattern : fire-and-forget (les erreurs de logging ne doivent jamais
// bloquer le pipeline business). Mais on log un warning si fail.

/**
 * Log un événement dans recipe_import_events.
 *
 * @param {Object} supabase - Supabase client (service_role ou admin authentifié)
 * @param {Object} params
 * @param {string} params.stagingId   - UUID du row staging concerné
 * @param {string} params.eventType   - imported/validated/invalidated/admin_claimed/
 *                                       admin_edited/revalidated/published/rejected/unpublished
 * @param {string} [params.actorId]   - UUID admin (NULL si job auto)
 * @param {Object} [params.payload]   - Contexte (diff, errors count, etc.)
 * @returns {Promise<{id?: string, error?: any}>}
 */
export async function logEvent(supabase, { stagingId, eventType, actorId = null, payload = null }) {
  if (!stagingId || !eventType) {
    return { error: new Error('logEvent requires stagingId + eventType') }
  }
  const { data, error } = await supabase
    .from('recipe_import_events')
    .insert({
      staging_id: stagingId,
      event_type: eventType,
      actor_id: actorId,
      payload,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    // Fire-and-forget : log warning, ne throw pas
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn(`[events-logger] failed to log ${eventType}:`, error.message)
    }
    return { error }
  }
  return { id: data?.id }
}

/**
 * Batch log events (utile pour les bulk operations admin).
 */
export async function logEventsBatch(supabase, events) {
  if (!events?.length) return { count: 0 }
  const rows = events.map(e => ({
    staging_id: e.stagingId,
    event_type: e.eventType,
    actor_id: e.actorId ?? null,
    payload: e.payload ?? null,
  }))
  const { data, error } = await supabase
    .from('recipe_import_events')
    .insert(rows)
    .select('id')

  if (error) return { error, count: 0 }
  return { count: data?.length ?? 0 }
}
