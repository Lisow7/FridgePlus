import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { getRecipesUsingBase } from '@features/recipes/api/recipes'

function makeBuilder(resolvedValue) {
  const builder = {
    select: vi.fn(() => builder),
    eq:     vi.fn(() => builder),
    then:   (resolve) => resolve(resolvedValue),
  }
  return builder
}

describe('getRecipesUsingBase', () => {
  beforeEach(() => mockFrom.mockReset())

  it('retourne les recipe_a_id référençant cette recette de base', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [{ recipe_a_id: 'lasagnes' }, { recipe_a_id: 'gratin-dauphinois' }], error: null }))
    const res = await getRecipesUsingBase('bechamel-maison')
    expect(mockFrom).toHaveBeenCalledWith('recipe_relations')
    expect(res).toEqual(['lasagnes', 'gratin-dauphinois'])
  })

  it('fail-open : renvoie [] sur erreur', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }))
    expect(await getRecipesUsingBase('bechamel-maison')).toEqual([])
  })

  it('renvoie [] si data est null sans erreur', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }))
    expect(await getRecipesUsingBase('bechamel-maison')).toEqual([])
  })
})
