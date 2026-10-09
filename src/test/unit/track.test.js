import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHasConsented = vi.hoisted(() => vi.fn())
const mockGetSession   = vi.hoisted(() => vi.fn())
const mockInsert       = vi.hoisted(() => vi.fn())
const mockGetAnonId    = vi.hoisted(() => vi.fn())

vi.mock('@shared/hooks/use-consent', () => ({ hasConsentedSync: mockHasConsented }))
vi.mock('@shared/lib/observability/anon-id', () => ({ getAnonId: mockGetAnonId }))
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: () => ({ insert: mockInsert }),
  },
}))

import { track, trackOnce } from '@shared/lib/observability/track'

const flush = () => new Promise(r => setTimeout(r, 0))

describe('track', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockInsert.mockResolvedValue({ error: null })
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockGetAnonId.mockReturnValue('anon-1')
  })

  it('no-op si pas de consentement (0 insert, 0 getSession)', async () => {
    mockHasConsented.mockReturnValue(false)
    track('ingredient_added', { ingredientId: 'fr-oeuf' })
    await flush()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('invité : insert avec anon_id, user_id null', async () => {
    mockHasConsented.mockReturnValue(true)
    track('recipe_opened', { recipeId: 'carbonara' })
    await flush()
    expect(mockInsert).toHaveBeenCalledWith({
      event: 'recipe_opened', props: { recipeId: 'carbonara' },
      user_id: null, anon_id: 'anon-1',
    })
  })

  it('connecté : insert avec user_id, anon_id null', async () => {
    mockHasConsented.mockReturnValue(true)
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } })
    track('cook_completed', { recipeId: 'carbonara' })
    await flush()
    expect(mockInsert).toHaveBeenCalledWith({
      event: 'cook_completed', props: { recipeId: 'carbonara' },
      user_id: 'u-1', anon_id: null,
    })
  })

  it('ne throw jamais si l\'insert échoue', async () => {
    mockHasConsented.mockReturnValue(true)
    mockInsert.mockRejectedValue(new Error('boom'))
    expect(() => track('recipe_opened', { recipeId: 'x' })).not.toThrow()
    await flush()
  })

  it('trackOnce : 2ᵉ appel même session = pas de 2ᵉ insert', async () => {
    mockHasConsented.mockReturnValue(true)
    trackOnce('k1', 'cookable_recipe_viewed', { count: 2 })
    await flush()
    trackOnce('k1', 'cookable_recipe_viewed', { count: 3 })
    await flush()
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })
})
