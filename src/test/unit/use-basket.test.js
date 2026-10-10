import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockLoadBasketFromDB = vi.fn()
const mockAddBasketItems = vi.fn().mockResolvedValue({ error: null })
const mockUpdateBasketItem = vi.fn().mockResolvedValue({ error: null })
const mockRemoveBasketItem = vi.fn().mockResolvedValue({ error: null })
const mockRemoveBasketByRecipe = vi.fn().mockResolvedValue({ error: null })
const mockClearBasket = vi.fn().mockResolvedValue({ error: null })

vi.mock('@features/cart/api/basket', () => ({
  loadBasketFromDB: (...args) => mockLoadBasketFromDB(...args),
  addBasketItems: (...args) => mockAddBasketItems(...args),
  updateBasketItem: (...args) => mockUpdateBasketItem(...args),
  removeBasketItem: (...args) => mockRemoveBasketItem(...args),
  removeBasketByRecipe: (...args) => mockRemoveBasketByRecipe(...args),
  clearBasket: (...args) => mockClearBasket(...args),
}))

vi.mock('@shared/lib/observability/sentry', () => ({ logError: vi.fn() }))

import { useBasket } from '@features/cart/hooks/use-basket'

const FAKE_ITEM = { id: 'b1', recipe_id: 'r1', label: 'tomate', amount: 100, unit: 'g' }

describe('useBasket (v3.234.0)', () => {
  beforeEach(() => {
    mockLoadBasketFromDB.mockReset()
    mockAddBasketItems.mockClear()
    mockUpdateBasketItem.mockClear()
    mockRemoveBasketItem.mockClear()
    mockRemoveBasketByRecipe.mockClear()
    mockClearBasket.mockClear()
  })

  describe('initial state', () => {
    it('basket vide + pas de fetch si user null', () => {
      const { result } = renderHook(() => useBasket(null))
      expect(result.current.basket).toEqual([])
      expect(mockLoadBasketFromDB).not.toHaveBeenCalled()
    })

    it('charge depuis DB au mount si user présent', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      expect(mockLoadBasketFromDB).toHaveBeenCalledWith('u')
      expect(result.current.basket[0]).toEqual(FAKE_ITEM)
    })

    it('basket reset à [] si user passe à null', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
      const { result, rerender } = renderHook(({ user }) => useBasket(user), {
        initialProps: { user: { id: 'u' } },
      })
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      rerender({ user: null })
      expect(result.current.basket).toEqual([])
    })
  })

  describe('basketRecipeIds memo', () => {
    it('retourne Set des recipe_id non-null', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [
        { id: 'b1', recipe_id: 'r1' },
        { id: 'b2', recipe_id: 'r2' },
        { id: 'b3', recipe_id: null }, // manual item, ignoré
      ], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(3))
      expect(result.current.basketRecipeIds.has('r1')).toBe(true)
      expect(result.current.basketRecipeIds.has('r2')).toBe(true)
      expect(result.current.basketRecipeIds.size).toBe(2)
    })
  })

  describe('toggleItem', () => {
    it('update local optimistic + appel DB', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [{ ...FAKE_ITEM, checked: false }], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => { await result.current.toggleItem('b1', true) })
      expect(result.current.basket[0].checked).toBe(true)
      expect(mockUpdateBasketItem).toHaveBeenCalledWith('b1', { checked: true })
    })
  })

  describe('changeItemPack', () => {
    it('update amount/unit/price + appel DB', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => {
        await result.current.changeItemPack('b1', { size: 500, unit: 'g', price: 2.99 })
      })
      expect(result.current.basket[0]).toMatchObject({ amount: 500, unit: 'g', price: 2.99 })
    })

    it('no-op si params invalides', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => { await result.current.changeItemPack('b1', { size: null, unit: 'g' }) })
      expect(mockUpdateBasketItem).not.toHaveBeenCalled()
    })
  })

  describe('addBatch', () => {
    it('appelle addBasketItems puis refresh', async () => {
      mockLoadBasketFromDB
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(mockLoadBasketFromDB).toHaveBeenCalledTimes(1))
      await act(async () => { await result.current.addBatch([FAKE_ITEM]) })
      expect(mockAddBasketItems).toHaveBeenCalledWith('u', [FAKE_ITEM])
      expect(result.current.basket).toEqual([FAKE_ITEM])
    })

    it('no-op si user null', async () => {
      const { result } = renderHook(() => useBasket(null))
      await act(async () => { await result.current.addBatch([FAKE_ITEM]) })
      expect(mockAddBasketItems).not.toHaveBeenCalled()
    })

    it('no-op si items vide', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(mockLoadBasketFromDB).toHaveBeenCalledTimes(1))
      await act(async () => { await result.current.addBatch([]) })
      expect(mockAddBasketItems).not.toHaveBeenCalled()
    })
  })

  describe('removeItem / removeRecipe / clear', () => {
    it('removeItem appelle removeBasketItem + refresh', async () => {
      mockLoadBasketFromDB
        .mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => { await result.current.removeItem('b1') })
      expect(mockRemoveBasketItem).toHaveBeenCalledWith('b1')
      expect(result.current.basket).toEqual([])
    })

    it('removeRecipe appelle removeBasketByRecipe + refresh', async () => {
      mockLoadBasketFromDB
        .mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => { await result.current.removeRecipe('r1') })
      expect(mockRemoveBasketByRecipe).toHaveBeenCalledWith('u', 'r1')
    })

    it('clear appelle clearBasket + refresh', async () => {
      mockLoadBasketFromDB
        .mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => { await result.current.clear() })
      expect(mockClearBasket).toHaveBeenCalledWith('u')
      expect(result.current.basket).toEqual([])
    })
  })

  // Audit du 2026-10-04, lot « le panier dit son échec » : un chargement raté
  // rendait une liste vide — le même piège que le frigo avant le 28/08. Depuis
  // un panier qui paraît vide, « Reprendre une liste » ne demande rien et
  // vidait en base un panier que personne n'avait vu.
  describe('chargement raté', () => {
    it('au montage : le panier reste vide, et basketLoadError le dit', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [], error: { message: 'réseau' } })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basketLoadError).toEqual({ message: 'réseau' }))
      expect(result.current.basket).toEqual([])
    })

    it('un rafraîchissement raté garde le panier affiché, et le dit', async () => {
      mockLoadBasketFromDB
        .mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
        .mockResolvedValueOnce({ data: [], error: { message: 'réseau' } })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => { await result.current.refresh() })
      expect(result.current.basket).toEqual([FAKE_ITEM])
      expect(result.current.basketLoadError).toEqual({ message: 'réseau' })
    })

    it('une relecture réussie efface l’erreur', async () => {
      mockLoadBasketFromDB
        .mockResolvedValueOnce({ data: [], error: { message: 'réseau' } })
        .mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basketLoadError).not.toBeNull())
      await act(async () => { await result.current.refresh() })
      expect(result.current.basketLoadError).toBeNull()
      expect(result.current.basket).toEqual([FAKE_ITEM])
    })

    it('« vider » refuse tant que le panier n’a pas été lu', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [], error: { message: 'réseau' } })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basketLoadError).not.toBeNull())
      let res
      await act(async () => { res = await result.current.clear() })
      expect(mockClearBasket).not.toHaveBeenCalled()
      expect(res).toEqual({ error: { message: 'panier_non_charge' } })
    })

    it('un panier ancien encore affiché se vide : l’utilisateur voit ce qu’il vide', async () => {
      mockLoadBasketFromDB
        .mockResolvedValueOnce({ data: [FAKE_ITEM], error: null })
        .mockResolvedValueOnce({ data: [], error: { message: 'réseau' } })
        .mockResolvedValueOnce({ data: [], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(result.current.basket.length).toBe(1))
      await act(async () => { await result.current.refresh() })
      expect(result.current.basketLoadError).not.toBeNull()
      await act(async () => { await result.current.clear() })
      expect(mockClearBasket).toHaveBeenCalledWith('u')
    })
  })

  describe('setBasket raw setter', () => {
    it('expose setBasket pour orchestration externe', async () => {
      mockLoadBasketFromDB.mockResolvedValueOnce({ data: [], error: null })
      const { result } = renderHook(() => useBasket({ id: 'u' }))
      await waitFor(() => expect(mockLoadBasketFromDB).toHaveBeenCalledTimes(1))
      act(() => { result.current.setBasket([FAKE_ITEM]) })
      expect(result.current.basket).toEqual([FAKE_ITEM])
    })
  })
})
