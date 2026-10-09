// Tests unit — useRecipeCost, état de l'onglet Coût extrait de recipe-modal.jsx
// (audit front §2). État persistant + auto-refresh (à l'ouverture) + refresh manuel.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@shared/lib/pricing/open-prices', () => ({
  refreshPrices: vi.fn().mockResolvedValue({ a: 5 }),
  clearPriceCache: vi.fn(),
}))
vi.mock('@shared/lib/recipes/recipe-ingredients', () => ({
  getIngredientItemsFlat: () => [{ ids: ['a'], labels: { fr: 'Beurre' } }],
  getIngredientId: (ing) => ing.ids[0],
}))

import { useRecipeCost } from '@features/recipes/hooks/use-recipe-cost'
import { refreshPrices, clearPriceCache } from '@shared/lib/pricing/open-prices'
import { COST_MODES } from '@shared/lib/recipes/recipe-utils'

beforeEach(() => vi.clearAllMocks())

describe('useRecipeCost', () => {
  it('état initial : costMode TOTAL, aucun prix live, pas de chargement', () => {
    const { result } = renderHook(() => useRecipeCost({ active: false, recipe: {}, lang: 'fr' }))
    expect(result.current.costMode).toBe(COST_MODES.TOTAL)
    expect(result.current.livePrices).toEqual({})
    expect(result.current.liveLoading).toBe(false)
    expect(result.current.liveUpdatedAt).toBeNull()
  })

  it('refresh manuel : vide le cache, appelle refreshPrices, stocke les prix, coupe le loading', async () => {
    const { result } = renderHook(() => useRecipeCost({ active: false, recipe: {}, lang: 'fr' }))
    act(() => { result.current.refresh() })
    expect(clearPriceCache).toHaveBeenCalled()
    expect(refreshPrices).toHaveBeenCalled()
    await waitFor(() => expect(result.current.livePrices).toEqual({ a: 5 }))
    expect(result.current.liveLoading).toBe(false)
    expect(result.current.liveUpdatedAt).not.toBeNull()
  })

  it('auto-refresh quand active=true (sans vider le cache)', async () => {
    const { result } = renderHook(() => useRecipeCost({ active: true, recipe: {}, lang: 'fr' }))
    await waitFor(() => expect(result.current.livePrices).toEqual({ a: 5 }))
    expect(refreshPrices).toHaveBeenCalled()
    expect(clearPriceCache).not.toHaveBeenCalled() // le chemin auto ne vide pas le cache
  })

  it('pas d\'auto-refresh quand active=false', () => {
    renderHook(() => useRecipeCost({ active: false, recipe: {}, lang: 'fr' }))
    expect(refreshPrices).not.toHaveBeenCalled()
  })
})
