import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase (utilisé par admin.js + recipes-repository pour fetch base/ingrédients)
const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))

import { adminGetBaseRecipeById, adminGetIngredientById } from '@features/admin/api/admin'

// Builder chainable + awaitable, résout une liste fixe (le filtre id exact est
// appliqué côté helper, pas côté requête — c'est ce qu'on teste).
function makeBuilder(resolvedValue) {
  const builder = {
    select: vi.fn(() => builder),
    order:  vi.fn(() => builder),
    range:  vi.fn(() => builder),
    eq:     vi.fn(() => builder),
    lte:    vi.fn(() => builder),
    gte:    vi.fn(() => builder),
    is:     vi.fn(() => builder),
    or:     vi.fn(() => builder),
    then:   (resolve) => resolve(resolvedValue),
  }
  return builder
}

beforeEach(() => vi.clearAllMocks())

describe('adminGetBaseRecipeById', () => {
  it('retourne la recette dont l’id correspond exactement', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [{ id: 'r-soupe' }, { id: 'r-curry' }], count: 2, error: null }))
    const { data } = await adminGetBaseRecipeById('r-curry')
    expect(data).toEqual({ id: 'r-curry' })
  })

  it('retourne null si aucun id ne correspond', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [{ id: 'r-soupe' }], count: 1, error: null }))
    const { data } = await adminGetBaseRecipeById('r-introuvable')
    expect(data).toBeNull()
  })

  it('retourne null si id vide (pas d’appel inutile)', async () => {
    const { data } = await adminGetBaseRecipeById('')
    expect(data).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('adminGetIngredientById', () => {
  it('retourne l’ingrédient dont l’id correspond exactement', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [{ id: 'fr-lait' }, { id: 'fr-oeuf' }], count: 2, error: null }))
    const { data } = await adminGetIngredientById('fr-oeuf')
    expect(data).toEqual({ id: 'fr-oeuf' })
  })

  it('retourne null si aucun id ne correspond', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [{ id: 'fr-lait' }], count: 1, error: null }))
    const { data } = await adminGetIngredientById('fr-introuvable')
    expect(data).toBeNull()
  })
})
