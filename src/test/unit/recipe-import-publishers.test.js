// Tests unit pour les publishers du pipeline d'import recettes.
// Refonte Recettes Phase 4 — Sprint 18.

import { describe, it, expect, vi } from 'vitest'
import { logEvent, logEventsBatch } from '../../scripts/recipe-import/publishers/events-logger.mjs'
import { publishToStaging, revalidateStaging } from '../../scripts/recipe-import/publishers/staging-publisher.mjs'

// ─── Helpers : mock supabase client ──────────────────────────────────────────
function mockSupabase({ stagingInsertResult, eventInsertResult, updateResult } = {}) {
  const calls = { events: [], staging: [], updates: [] }

  const eventsBuilder = {
    insert: vi.fn((rows) => {
      calls.events.push(rows)
      const finalResult = eventInsertResult ?? { data: { id: 'event-1' }, error: null }
      const selectChain = {
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => finalResult),
          then: (cb) => Promise.resolve(Array.isArray(rows) ? { data: rows.map((_, i) => ({ id: `event-${i}` })), error: null } : finalResult).then(cb),
        })),
        then: (cb) => Promise.resolve(Array.isArray(rows) ? { data: rows.map((_, i) => ({ id: `event-${i}` })), error: null } : finalResult).then(cb),
      }
      return selectChain
    }),
  }

  const stagingBuilder = {
    upsert: vi.fn((row) => {
      calls.staging.push(row)
      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => stagingInsertResult ?? { data: { id: 'staging-1' }, error: null }),
        })),
      }
    }),
    update: vi.fn((patch) => {
      calls.updates.push(patch)
      return {
        eq: vi.fn(async () => updateResult ?? { error: null }),
      }
    }),
  }

  const from = vi.fn((table) => {
    if (table === 'recipe_import_events') return eventsBuilder
    if (table === 'recipe_imports_staging') return stagingBuilder
    return null
  })

  return { from, calls }
}

// ─── events-logger ──────────────────────────────────────────────────────────
describe('events-logger', () => {
  it('logEvent insert dans recipe_import_events', async () => {
    const supabase = mockSupabase()
    const { id } = await logEvent(supabase, {
      stagingId: 'staging-1',
      eventType: 'validated',
      payload: { errorsCount: 0 },
    })
    expect(id).toBe('event-1')
    expect(supabase.from).toHaveBeenCalledWith('recipe_import_events')
    expect(supabase.calls.events[0].staging_id).toBe('staging-1')
    expect(supabase.calls.events[0].event_type).toBe('validated')
  })

  it('logEvent retourne error si stagingId manquant', async () => {
    const supabase = mockSupabase()
    const { error } = await logEvent(supabase, { eventType: 'imported' })
    expect(error).toBeDefined()
    expect(error.message).toMatch(/stagingId/)
  })

  it('logEvent retourne error si eventType manquant', async () => {
    const supabase = mockSupabase()
    const { error } = await logEvent(supabase, { stagingId: 'x' })
    expect(error).toBeDefined()
  })

  it('logEvent fire-and-forget si Supabase erreur (ne throw pas)', async () => {
    const supabase = mockSupabase({
      eventInsertResult: { data: null, error: { message: 'boom' } },
    })
    const result = await logEvent(supabase, { stagingId: 's1', eventType: 'imported' })
    expect(result.error).toBeDefined()
    // Pas de throw — pipeline continue
  })

  it('logEventsBatch insert plusieurs events', async () => {
    const supabase = mockSupabase()
    const { count } = await logEventsBatch(supabase, [
      { stagingId: 's1', eventType: 'imported' },
      { stagingId: 's2', eventType: 'validated' },
    ])
    expect(count).toBe(2)
  })

  it('logEventsBatch skip si array vide', async () => {
    const supabase = mockSupabase()
    const { count } = await logEventsBatch(supabase, [])
    expect(count).toBe(0)
  })
})

// ─── staging-publisher ──────────────────────────────────────────────────────
describe('staging-publisher', () => {
  const baseInput = {
    source: 'themealdb',
    batchId: 'batch-uuid-1',
    adapterResult: {
      externalKey: 'themealdb-123',
      rawPayload: { idMeal: '123', strMeal: 'Test' },
      parsedData: { name: { en: 'Test' }, status: 'draft' },
    },
    validationResult: {
      status: 'valid',
      errors: [],
      parsedData: { name: { en: 'Test' }, status: 'draft' },
    },
  }

  it('publishToStaging upsert + log events', async () => {
    const supabase = mockSupabase()
    const { id } = await publishToStaging(supabase, baseInput)
    expect(id).toBe('staging-1')

    // Upsert appelé avec bon shape
    expect(supabase.calls.staging[0].source).toBe('themealdb')
    expect(supabase.calls.staging[0].external_key).toBe('themealdb-123')
    expect(supabase.calls.staging[0].status).toBe('pending')

    // 2 events loggés : imported + validated
    expect(supabase.calls.events.length).toBe(2)
  })

  it('publishToStaging marque status=invalid si validation invalid', async () => {
    const supabase = mockSupabase()
    await publishToStaging(supabase, {
      ...baseInput,
      validationResult: { status: 'invalid', errors: [{ code: 'STEPS_MISSING' }], parsedData: {} },
    })
    expect(supabase.calls.staging[0].status).toBe('invalid')
    // Event 'invalidated' (pas 'validated')
    const eventTypes = supabase.calls.events.map(e => e.event_type)
    expect(eventTypes).toContain('imported')
    expect(eventTypes).toContain('invalidated')
  })

  it('publishToStaging retourne error si params manquants', async () => {
    const supabase = mockSupabase()
    const { error } = await publishToStaging(supabase, { source: 'x' })
    expect(error).toBeDefined()
  })

  it('publishToStaging passe backfill_audit + existing_recipe_id', async () => {
    const supabase = mockSupabase()
    await publishToStaging(supabase, {
      ...baseInput,
      backfillAudit: true,
      existingRecipeId: 'pates-tomate',
    })
    expect(supabase.calls.staging[0].backfill_audit).toBe(true)
    expect(supabase.calls.staging[0].existing_recipe_id).toBe('pates-tomate')
  })

  it('revalidateStaging update + log revalidated event', async () => {
    const supabase = mockSupabase()
    const result = await revalidateStaging(
      supabase,
      'staging-1',
      { status: 'valid', errors: [], parsedData: { x: 1 } },
      'admin-uuid',
    )
    expect(result.ok).toBe(true)
    expect(supabase.calls.updates[0].status).toBe('pending')
    expect(supabase.calls.events[0].event_type).toBe('revalidated')
    expect(supabase.calls.events[0].actor_id).toBe('admin-uuid')
  })
})
