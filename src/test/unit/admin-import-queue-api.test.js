// L'API admin de la file d'import de recettes (Refonte Recettes, phase 5a),
// réécrite au lot 12l de l'audit du 2026-10-04 (ADM-17 (1, 2, 3, +), ARCH-13 (5)) :
// publier, rejeter et publier un lot sont des fonctions de la base, en une
// transaction, qui posent elles-mêmes l'acteur et écrivent le journal. Avant,
// le navigateur enchaînait trois écritures sans transaction en important le
// publisher du pipeline (un module Node de src/scripts/ dans le paquet).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@shared/lib/supabase/client', () => {
  function builder(result = { data: [], count: 0, error: null }) {
    const b = {
      _result: result,
      select: vi.fn(function () { return this }),
      eq:     vi.fn(function () { return this }),
      neq:    vi.fn(function () { return this }),
      gte:    vi.fn(function () { return this }),
      or:     vi.fn(function () { return this }),
      order:  vi.fn(function () { return this }),
      range:  vi.fn(function () { return this }),
      then(resolve) { return Promise.resolve(this._result).then(resolve) },
    }
    return b
  }
  const staging = builder({ data: [{ id: 'staging-1', status: 'pending' }], count: 1, error: null })
  const events  = builder({ data: [], count: 0, error: null })
  return {
    supabase: {
      rpc: vi.fn(async () => ({ data: null, error: null })),
      from: vi.fn((table) => (table === 'recipe_imports_staging' ? staging : table === 'recipe_import_events' ? events : builder())),
      _staging: staging,
    },
  }
})

import {
  adminGetImportQueue, adminPublishStaged, adminRejectStaged, adminBatchPublishValid, adminReRunValidators, adminGetImportMetrics,
} from '@features/admin/api/admin'
import { supabase } from '@shared/lib/supabase/client'

beforeEach(() => { vi.clearAllMocks() })

describe('adminGetImportQueue', () => {
  it('retourne {data, count, error: null} par défaut', async () => {
    const result = await adminGetImportQueue()
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
    expect(result).toHaveProperty('count')
  })

  it('accepte tous les filtres sans throw', async () => {
    const result = await adminGetImportQueue({ status: 'invalid', batchId: 'b1', search: 'pates' })
    expect(result.error).toBeNull()
  })
})

describe('adminPublishStaged — une fonction de la base, en une transaction', () => {
  it('appelle admin_publier_import avec la ligne, et rend l’identifiant de la recette', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: 'recette-xyz', error: null })
    const result = await adminPublishStaged('staging-1')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_publier_import', { p_staging_id: 'staging-1' })
    expect(result).toEqual({ recipeId: 'recette-xyz', error: null })
  })

  it('rend l’erreur de la base telle quelle', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'ligne de transit non publiable (statut published)' } })
    const result = await adminPublishStaged('staging-1')
    expect(result.recipeId).toBeUndefined()
    expect(result.error.code).toBe('22023')
  })
})

describe('adminRejectStaged', () => {
  it('appelle admin_rejeter_import avec la ligne et le motif', async () => {
    const result = await adminRejectStaged('staging-1', 'doublon')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_rejeter_import', { p_staging_id: 'staging-1', p_motif: 'doublon' })
    expect(result).toEqual({ error: null })
  })
})

describe('adminBatchPublishValid', () => {
  it('appelle admin_publier_lot_import et rend son bilan', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { published: 2, failed: [{ stagingId: 's-3', error: 'sans identifiant' }] }, error: null })
    const result = await adminBatchPublishValid('batch-1')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_publier_lot_import', { p_batch_id: 'batch-1' })
    expect(result).toEqual({ error: null, published: 2, failed: [{ stagingId: 's-3', error: 'sans identifiant' }] })
  })

  it('une erreur de la base : 0 publiée, rien dans failed, l’erreur rendue', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'forbidden: admin only' } })
    const result = await adminBatchPublishValid('batch-1')
    expect(result.error.code).toBe('42501')
    expect(result.published).toBe(0)
    expect(result.failed).toEqual([])
  })
})

describe('le paquet du navigateur ne contient plus le publisher du pipeline (ARCH-13 (5))', () => {
  it('import-queue.js n’importe rien de src/scripts/', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/admin/api/import-queue.js'), 'utf8')
    expect(source).not.toMatch(/scripts\/recipe-import/)
  })
})

describe('adminReRunValidators', () => {
  it('retourne {error: null, message: string mentionnant CLI}', async () => {
    const result = await adminReRunValidators('staging-1')
    expect(result.error).toBeNull()
    expect(result.message.toLowerCase()).toMatch(/cli|npm|revalidate/)
  })
})

describe('adminGetImportMetrics', () => {
  it('agrège byStatus et topErrorCodes depuis les lignes', async () => {
    supabase._staging._result = {
      data: [{ status: 'pending', errors: [{ code: 'X' }, { code: 'X' }] }, { status: 'valid', errors: [{ code: 'Y' }] }, { status: 'pending', errors: [] }],
      count: 3, error: null,
    }
    const { error, metrics } = await adminGetImportMetrics()
    expect(error).toBeNull()
    expect(metrics.byStatus.pending).toBe(2)
    expect(metrics.byStatus.valid).toBe(1)
    expect(metrics.topErrorCodes[0]).toEqual({ code: 'X', count: 2 })
    expect(metrics).toHaveProperty('bySource')
    expect(metrics).toHaveProperty('eventsLast7d')
  })
})
