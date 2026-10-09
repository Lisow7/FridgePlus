import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { rpc: (...args) => rpcMock(...args) },
}))

import { findSimilarRecipes } from '@features/recipes/api/recipes'

describe('findSimilarRecipes', () => {
  beforeEach(() => rpcMock.mockReset())

  it('passe les bons paramètres et renvoie la liste', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'r-1', title: 'Carbonara', score: 0.9 }], error: null })
    const res = await findSimilarRecipes('carbonara', ['gp-pates'], 'custom-x')
    expect(rpcMock).toHaveBeenCalledWith('find_similar_recipes', {
      p_name: 'carbonara', p_ingredient_ids: ['gp-pates'], p_exclude_id: 'custom-x',
    })
    expect(res).toEqual([{ id: 'r-1', title: 'Carbonara', score: 0.9 }])
  })

  it('fail-open : renvoie [] sur erreur (RPC absente avant migration, etc.)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    expect(await findSimilarRecipes('x', ['a'], null)).toEqual([])
  })

  it('renvoie [] si data est null sans erreur', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await findSimilarRecipes('x', ['a'], null)).toEqual([])
  })
  // NB : un reject réel de supabase.rpc est couvert défensivement par le
  // try/catch de findSimilarRecipes (filet) ; supabase.rpc résout toujours
  // { data, error } en pratique → le fail-open réaliste est le champ `error`.
})
