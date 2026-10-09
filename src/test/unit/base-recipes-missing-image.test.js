import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock ─────────────────────────────────────────────────────────────
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

import {
  adminFindOfficialRecipesPaginated,
  countMissingImageBaseRecipes,
} from '@shared/lib/recipes/recipes-repository'

// ─── Builder chainable + awaitable ───────────────────────────────────────────
// Le builder enregistre tous les appels .or() pour les assertions de test A/B.
// Il est awaitable via `then` (simulant `await query`).
function makeBuilder(resolvedValue = { data: [], count: 0, error: null }) {
  const orCalls = []
  const builder = {
    select:  vi.fn(() => builder),
    order:   vi.fn(() => builder),
    range:   vi.fn(() => builder),
    eq:      vi.fn(() => builder),
    lte:     vi.fn(() => builder),
    gte:     vi.fn(() => builder),
    is:      vi.fn(() => builder),
    or:      vi.fn((...args) => { orCalls.push(...args); return builder }),
    // Rend le builder awaitable — permet `const { data, error, count } = await query`
    then:    (resolve) => resolve(resolvedValue),
    // Expose les appels .or() enregistrés pour les assertions
    _orCalls: orCalls,
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Test A : missingImage: true → .or() avec le filtre image_url ────────────
describe('adminFindOfficialRecipesPaginated({ missingImage: true })', () => {
  it('transmet le filtre image manquante via .or()', async () => {
    const builder = makeBuilder()
    mockFrom.mockReturnValue(builder)

    await adminFindOfficialRecipesPaginated({ missingImage: true })

    expect(builder._orCalls).toContain('image_url.is.null,image_url.eq.')
  })

  it('sélectionne image_url dans les colonnes', async () => {
    const builder = makeBuilder()
    mockFrom.mockReturnValue(builder)

    await adminFindOfficialRecipesPaginated({ missingImage: true })

    const selectArg = builder.select.mock.calls[0][0]
    expect(selectArg).toContain('image_url')
  })
})

// ─── Test B : missingImage absent/false → pas de filtre image_url ────────────
describe('adminFindOfficialRecipesPaginated({}) — sans missingImage', () => {
  it('ne transmet PAS le filtre image_url dans .or()', async () => {
    const builder = makeBuilder()
    mockFrom.mockReturnValue(builder)

    await adminFindOfficialRecipesPaginated({})

    expect(builder._orCalls).not.toContain('image_url.is.null,image_url.eq.')
  })

  it('inclut quand même image_url dans le select', async () => {
    const builder = makeBuilder()
    mockFrom.mockReturnValue(builder)

    await adminFindOfficialRecipesPaginated({})

    const selectArg = builder.select.mock.calls[0][0]
    expect(selectArg).toContain('image_url')
  })
})

// ─── countMissingImageBaseRecipes ────────────────────────────────────────────
describe('countMissingImageBaseRecipes()', () => {
  it('appelle from("base_recipes") avec filtre image_url', async () => {
    const builder = makeBuilder({ count: 5, error: null })
    mockFrom.mockReturnValue(builder)

    const result = await countMissingImageBaseRecipes()

    expect(mockFrom).toHaveBeenCalledWith('base_recipes')
    expect(builder._orCalls).toContain('image_url.is.null,image_url.eq.')
    expect(result).toBe(5)
  })

  it('retourne 0 si count est null', async () => {
    const builder = makeBuilder({ count: null, error: null })
    mockFrom.mockReturnValue(builder)

    const result = await countMissingImageBaseRecipes()
    expect(result).toBe(0)
  })
})
