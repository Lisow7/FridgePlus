// Tests unit pour recipes-publisher (publish staging → recipes_unified).
// Refonte Recettes Phase 5a.

import { describe, it, expect, vi } from 'vitest'
import { publishStagingToRecipes } from '../../scripts/recipe-import/publishers/recipes-publisher.mjs'

function mockSupabase({
  stagingRow,
  insertResult = { data: { id: 'recipe-123' }, error: null },
  eventInsertResult = { data: { id: 'event-1' }, error: null },
  updateResult = { error: null },
} = {}) {
  const calls = { staging: [], unified: [], events: [], updates: [] }

  const stagingBuilder = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: stagingRow, error: null })),
      })),
    })),
    update: vi.fn((patch) => {
      calls.updates.push(patch)
      return { eq: vi.fn(async () => updateResult) }
    }),
  }

  const unifiedBuilder = {
    insert: vi.fn((row) => {
      calls.unified.push(row)
      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => insertResult),
        })),
      }
    }),
  }

  const eventsBuilder = {
    insert: vi.fn((row) => {
      calls.events.push(row)
      return {
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => eventInsertResult),
        })),
      }
    }),
  }

  const from = vi.fn((table) => {
    if (table === 'recipe_imports_staging') return stagingBuilder
    if (table === 'recipes_unified')        return unifiedBuilder
    if (table === 'recipe_import_events')   return eventsBuilder
    return null
  })
  return { from, calls }
}

describe('publishStagingToRecipes', () => {
  it('INSERT recipe + UPDATE staging.status=published + log event', async () => {
    const stagingRow = {
      id: 'staging-1',
      parsed_data: {
        id: 'pates-carbonara',
        name: { fr: 'Pâtes carbonara' },
        emoji: '🍝',
        time_min: 25,
        difficulty: 'easy',
        type: 'main',
        servings: 4,
        country: 'IT',
        description: { fr: 'Classique italien' },
        steps: [{ fr: 'Cuire les pâtes' }, { fr: 'Mélanger' }],
        ingredients: [{ id: 'gp-pates', qty: 400, unit: 'g', required: true }],
      },
      status: 'pending',
    }
    const supabase = mockSupabase({ stagingRow, insertResult: { data: { id: 'pates-carbonara' }, error: null } })

    const result = await publishStagingToRecipes(supabase, {
      stagingId: 'staging-1',
      actorId: 'admin-uuid',
    })

    expect(result.error).toBeNull()
    expect(result.recipeId).toBe('pates-carbonara')
    expect(supabase.calls.unified[0].origin).toBe('official')
    expect(supabase.calls.unified[0].status).toBe('published')
    expect(supabase.calls.unified[0].id).toBe('pates-carbonara')
    expect(supabase.calls.updates[0].status).toBe('published')
    expect(supabase.calls.updates[0].published_recipe_id).toBe('pates-carbonara')
    expect(supabase.calls.updates[0].resolved_by).toBe('admin-uuid')
    expect(supabase.calls.events[0].event_type).toBe('published')
    expect(supabase.calls.events[0].actor_id).toBe('admin-uuid')
    expect(supabase.calls.events[0].staging_id).toBe('staging-1')
  })

  it('persiste diet et allergens depuis parsed_data', async () => {
    const stagingRow = {
      id: 'staging-2',
      parsed_data: {
        id: 'croque-monsieur',
        name: { fr: 'Croque-monsieur' },
        emoji: '🥪',
        type: 'main',
        diet: ['vegetarian'],
        allergens: ['gluten', 'milk'],
        ingredients: [{ ids: ['gp-pain-mie'], required: true }],
      },
      status: 'pending',
    }
    const supabase = mockSupabase({ stagingRow, insertResult: { data: { id: 'croque-monsieur' }, error: null } })

    const result = await publishStagingToRecipes(supabase, { stagingId: 'staging-2', actorId: 'admin-uuid' })

    expect(result.error).toBeNull()
    expect(supabase.calls.unified[0].diet).toEqual(['vegetarian'])
    expect(supabase.calls.unified[0].allergens).toEqual(['gluten', 'milk'])
  })

  it('refuse de publier si status != pending|valid', async () => {
    const stagingRow = { id: 's1', parsed_data: {}, status: 'rejected' }
    const supabase = mockSupabase({ stagingRow })
    const result = await publishStagingToRecipes(supabase, { stagingId: 's1', actorId: 'a' })
    expect(result.error).toBeDefined()
    expect(result.error.message).toMatch(/status/i)
  })

  it('retourne error si staging introuvable', async () => {
    const supabase = mockSupabase({ stagingRow: null })
    const result = await publishStagingToRecipes(supabase, { stagingId: 'ghost', actorId: 'a' })
    expect(result.error).toBeDefined()
    expect(result.error.message).toMatch(/introuvable/i)
  })

  it('rollback (pas update staging) si INSERT recipes_unified fail', async () => {
    const stagingRow = { id: 's1', parsed_data: { id: 'r1', name: { fr: 'X' } }, status: 'pending' }
    const supabase = mockSupabase({
      stagingRow,
      insertResult: { data: null, error: { message: 'duplicate id' } },
    })
    const result = await publishStagingToRecipes(supabase, { stagingId: 's1', actorId: 'a' })
    expect(result.error).toBeDefined()
    expect(supabase.calls.updates.length).toBe(0)
    expect(supabase.calls.events.length).toBe(0)
  })

  it('rejectStaging UPDATE status=rejected + admin_notes + event rejected', async () => {
    const { rejectStaging } = await import('../../scripts/recipe-import/publishers/recipes-publisher.mjs')
    const supabase = mockSupabase()
    const result = await rejectStaging(supabase, {
      stagingId: 's1',
      reason: 'duplicate of pates-carbonara',
      actorId: 'admin-uuid',
    })
    expect(result.error).toBeNull()
    expect(supabase.calls.updates[0].status).toBe('rejected')
    expect(supabase.calls.updates[0].admin_notes).toBe('duplicate of pates-carbonara')
    expect(supabase.calls.events[0].event_type).toBe('rejected')
  })

  it('rejectStaging accepte reason vide → fallback "no reason"', async () => {
    const { rejectStaging } = await import('../../scripts/recipe-import/publishers/recipes-publisher.mjs')
    const supabase = mockSupabase()
    await rejectStaging(supabase, { stagingId: 's1', reason: '', actorId: 'a' })
    expect(supabase.calls.updates[0].admin_notes).toBe('no reason')
  })

  it('publishStagingToRecipes propage parsed_data complet vers recipes_unified', async () => {
    const stagingRow = {
      id: 's1',
      parsed_data: {
        id: 'r1',
        name: { fr: 'R1' },
        description: { fr: 'D' },
        emoji: '🥗',
        time_min: 30, prep_time_min: 10, cook_time_min: 20,
        difficulty: 'easy', type: 'main', servings: 2, country: 'FR',
        ingredients: [{ id: 'fr-tomate', qty: 200, unit: 'g', required: true }],
        steps: [{ fr: 'Step 1' }],
        functional_tags: ['quick', 'no_cook'],
      },
      status: 'pending',
    }
    const supabase = mockSupabase({ stagingRow, insertResult: { data: { id: 'r1' }, error: null } })
    await publishStagingToRecipes(supabase, { stagingId: 's1', actorId: 'a' })
    const inserted = supabase.calls.unified[0]
    expect(inserted.id).toBe('r1')
    expect(inserted.emoji).toBe('🥗')
    expect(inserted.country).toBe('FR')
    expect(inserted.functional_tags).toEqual(['quick', 'no_cook'])
    expect(inserted.ingredients).toEqual([{ id: 'fr-tomate', qty: 200, unit: 'g', required: true }])
  })

  it('event log fail = warning (pas blocking) → publication réussit', async () => {
    const stagingRow = { id: 's1', parsed_data: { id: 'r1', name: { fr: 'X' } }, status: 'pending' }
    const supabase = mockSupabase({
      stagingRow,
      insertResult: { data: { id: 'r1' }, error: null },
      eventInsertResult: { data: null, error: { message: 'event boom' } },
    })
    const result = await publishStagingToRecipes(supabase, { stagingId: 's1', actorId: 'a' })
    expect(result.error).toBeNull()
    expect(supabase.calls.updates[0].status).toBe('published')
  })
})
