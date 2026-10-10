// Tests unit pour les 6 fonctions admin API du pipeline d'import recettes.
// Refonte Recettes Phase 5a.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks hoistés ──────────────────────────────────────────────────────────

vi.mock('../../scripts/recipe-import/publishers/recipes-publisher.mjs', () => ({
  publishStagingToRecipes: vi.fn(async () => ({ recipeId: 'r1', error: null })),
  rejectStaging:           vi.fn(async () => ({ error: null })),
}))

// Supabase client mock — chemin exact utilisé par admin.js
vi.mock('@shared/lib/supabase/client', () => {
  // Builder chainable pour les requêtes .from(...).select(...).eq(...).range(...)
  // et .update(...).eq(...)
  function makeQueryBuilder(result = { data: [], count: 0, error: null }) {
    const builder = {
      _result: result,
      select:  vi.fn(function () { return this }),
      eq:      vi.fn(function () { return this }),
      or:      vi.fn(function () { return this }),
      order:   vi.fn(function () { return this }),
      range:   vi.fn(function () { return this }),
      update:  vi.fn(function () { return this }),
      insert:  vi.fn(function () { return this }),
      delete:  vi.fn(function () { return this }),
      // Quand la chaîne est awaited, renvoie _result
      then(resolve) { return Promise.resolve(this._result).then(resolve) },
    }
    return builder
  }

  // Builder pour .from('recipe_imports_staging').select(...).eq('batch_id',...).eq('status','valid')
  // → retourne des candidats pour adminBatchPublishValid (2 rows)
  const batchCandidates = [{ id: 'staging-a' }, { id: 'staging-b' }]

  const stagingBuilder = {
    _defaultResult: { data: [{ id: 'staging-1', status: 'pending' }], count: 1, error: null },
    _batchResult:   { data: batchCandidates, error: null },
    _callMode:      'default',
    select: vi.fn(function () { return this }),
    eq:     vi.fn(function (col, val) {
      if (col === 'status' && val === 'valid') this._callMode = 'batch'
      return this
    }),
    neq:    vi.fn(function () { return this }),
    or:     vi.fn(function () { return this }),
    order:  vi.fn(function () { return this }),
    range:  vi.fn(function () { return this }),
    update: vi.fn(function () { return this }),
    then(resolve) {
      const result = this._callMode === 'batch' ? this._batchResult : this._defaultResult
      return Promise.resolve(result).then(resolve)
    },
  }

  const eventsBuilder = makeQueryBuilder({ data: [], count: 0, error: null })
  eventsBuilder.gte = vi.fn(function () { return this })

  const supabaseMock = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'admin-uuid' } }, error: null })),
    },
    from: vi.fn((table) => {
      if (table === 'recipe_imports_staging') return stagingBuilder
      if (table === 'recipe_import_events') return eventsBuilder
      return makeQueryBuilder({ data: null, count: 0, error: null })
    }),
    _stagingBuilder: stagingBuilder,
    _eventsBuilder: eventsBuilder,
  }

  return { supabase: supabaseMock }
})

// ─── Imports sous test ───────────────────────────────────────────────────────

import {
  adminGetImportQueue,
  adminPublishStaged,
  adminRejectStaged,
  adminBatchPublishValid,
  adminGetImportMetrics,
} from '@features/admin/api/admin'
import {
  publishStagingToRecipes,
  rejectStaging,
} from '../../scripts/recipe-import/publishers/recipes-publisher.mjs'
import { supabase } from '@shared/lib/supabase/client'

// ─── Utils ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Réinitialise _callMode entre les tests pour éviter les effets de bord
  supabase._stagingBuilder._callMode = 'default'
})

// ─── adminGetImportQueue ─────────────────────────────────────────────────────

describe('adminGetImportQueue', () => {
  it('retourne {data, count, error: null} par défaut', async () => {
    const result = await adminGetImportQueue()
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('count')
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('accepte tous les filtres sans throw', async () => {
    const result = await adminGetImportQueue({ status: 'invalid', batchId: 'b1', search: 'pates' })
    expect(result.error).toBeNull()
  })

  it('accepte status=all (pas de filtre eq)', async () => {
    const result = await adminGetImportQueue({ status: 'all' })
    expect(result.error).toBeNull()
  })
})

// ─── adminPublishStaged ──────────────────────────────────────────────────────

describe('adminPublishStaged', () => {
  it('délègue à publishStagingToRecipes avec stagingId + actorId', async () => {
    await adminPublishStaged('staging-1')
    expect(publishStagingToRecipes).toHaveBeenCalledOnce()
    const [_sb, params] = publishStagingToRecipes.mock.calls[0]
    expect(params.stagingId).toBe('staging-1')
    expect(params.actorId).toBe('admin-uuid')
  })

  it('retourne le résultat du publisher', async () => {
    publishStagingToRecipes.mockResolvedValueOnce({ recipeId: 'recipe-xyz', error: null })
    const result = await adminPublishStaged('staging-1')
    expect(result.recipeId).toBe('recipe-xyz')
    expect(result.error).toBeNull()
  })
})

// ─── adminRejectStaged ───────────────────────────────────────────────────────

describe('adminRejectStaged', () => {
  it('délègue à rejectStaging avec stagingId + reason + actorId', async () => {
    await adminRejectStaged('staging-1', 'doublon')
    expect(rejectStaging).toHaveBeenCalledOnce()
    const [_sb, params] = rejectStaging.mock.calls[0]
    expect(params.stagingId).toBe('staging-1')
    expect(params.reason).toBe('doublon')
    expect(params.actorId).toBe('admin-uuid')
  })

  it('retourne {error: null} sur succès', async () => {
    const result = await adminRejectStaged('staging-1', 'test')
    expect(result.error).toBeNull()
  })
})

// ─── adminBatchPublishValid ──────────────────────────────────────────────────

describe('adminBatchPublishValid', () => {
  it('retourne {error: null, published: number, failed: Array}', async () => {
    const result = await adminBatchPublishValid('batch-1')
    expect(result.error).toBeNull()
    expect(typeof result.published).toBe('number')
    expect(Array.isArray(result.failed)).toBe(true)
  })

  it('publie chaque row valid (appelle publishStagingToRecipes par row)', async () => {
    const result = await adminBatchPublishValid('batch-1')
    // stagingBuilder renvoie 2 candidats (staging-a, staging-b)
    expect(publishStagingToRecipes).toHaveBeenCalledTimes(2)
    expect(result.published).toBe(2)
    expect(result.failed).toHaveLength(0)
  })

  it('compte les échecs dans failed si publisher retourne error', async () => {
    publishStagingToRecipes
      .mockResolvedValueOnce({ error: null, recipeId: 'r-ok' })
      .mockResolvedValueOnce({ error: { message: 'boom' } })
    const result = await adminBatchPublishValid('batch-1')
    expect(result.published).toBe(1)
    expect(result.failed).toHaveLength(1)
  })
})

// ─── adminGetImportMetrics ───────────────────────────────────────────────────

describe('adminGetImportMetrics', () => {
  it('agrège byStatus correctement depuis les rows', async () => {
    // Surcharge du résultat du stagingBuilder pour ce test
    const originalResult = supabase._stagingBuilder._defaultResult
    supabase._stagingBuilder._defaultResult = {
      data: [{ status: 'pending' }, { status: 'valid' }, { status: 'pending' }],
      count: 3,
      error: null,
    }
    const { error, metrics } = await adminGetImportMetrics()
    expect(error).toBeNull()
    expect(metrics).toHaveProperty('byStatus')
    expect(metrics).toHaveProperty('bySource')
    expect(metrics).toHaveProperty('topErrorCodes')
    expect(metrics).toHaveProperty('eventsLast7d')
    expect(metrics.byStatus.pending).toBe(2)
    expect(metrics.byStatus.valid).toBe(1)
    // Restaure
    supabase._stagingBuilder._defaultResult = originalResult
  })

  it('agrège topErrorCodes depuis errors jsonb', async () => {
    const originalResult = supabase._stagingBuilder._defaultResult
    supabase._stagingBuilder._defaultResult = {
      data: [
        { status: 'invalid', errors: [{ code: 'X' }, { code: 'X' }, { code: 'Y' }] },
      ],
      count: 1,
      error: null,
    }
    const { error, metrics } = await adminGetImportMetrics()
    expect(error).toBeNull()
    expect(metrics.topErrorCodes[0]).toEqual({ code: 'X', count: 2 })
    // Restaure
    supabase._stagingBuilder._defaultResult = originalResult
  })
})
