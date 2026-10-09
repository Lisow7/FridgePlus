import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockGetLeftovers = vi.fn()
const mockAddLeftover = vi.fn()
const mockDeleteLeftover = vi.fn().mockResolvedValue({ error: null })
const mockIsLeftoverExpired = vi.fn()

vi.mock('@features/fridge/api/leftovers', () => ({
  getLeftovers: (...args) => mockGetLeftovers(...args),
  addLeftover: (...args) => mockAddLeftover(...args),
  deleteLeftover: (...args) => mockDeleteLeftover(...args),
  isLeftoverExpired: (...args) => mockIsLeftoverExpired(...args),
  countSavedLeftovers: () => Promise.resolve(0),
}))

vi.mock('@shared/lib/observability/sentry', () => ({ logError: vi.fn() }))

import { useLeftovers } from '@features/fridge/hooks/use-leftovers'

const FAKE_LEFTOVER = { id: 'l1', name: 'tomate', emoji: '🍅', ingredient_id: 'fr-tomate', expires_at: '2026-05-20' }
const EXPIRED_LEFTOVER = { id: 'l2', name: 'lait', emoji: '🥛', expires_at: '2026-05-01' }

describe('useLeftovers (v3.236.0)', () => {
  beforeEach(() => {
    mockGetLeftovers.mockReset()
    mockAddLeftover.mockReset()
    mockDeleteLeftover.mockClear()
    mockIsLeftoverExpired.mockReset()
    // Par défaut, isLeftoverExpired retourne true pour la DLC du 1er mai
    mockIsLeftoverExpired.mockImplementation((date) => date === '2026-05-01')
  })

  describe('initial state', () => {
    it('vide + pas de fetch si user null', () => {
      const { result } = renderHook(() => useLeftovers(null))
      expect(result.current.leftovers).toEqual([])
      expect(mockGetLeftovers).not.toHaveBeenCalled()
    })

    it('charge depuis DB au mount si user présent', async () => {
      mockGetLeftovers.mockResolvedValueOnce([FAKE_LEFTOVER])
      const { result } = renderHook(() => useLeftovers({ id: 'u' }))
      await waitFor(() => expect(result.current.leftovers.length).toBe(1))
      expect(mockGetLeftovers).toHaveBeenCalledWith('u')
    })

    it('reset à [] si user passe à null', async () => {
      mockGetLeftovers.mockResolvedValueOnce([FAKE_LEFTOVER])
      const { result, rerender } = renderHook(({ user }) => useLeftovers(user), {
        initialProps: { user: { id: 'u' } },
      })
      await waitFor(() => expect(result.current.leftovers.length).toBe(1))
      rerender({ user: null })
      expect(result.current.leftovers).toEqual([])
    })
  })

  describe('addLeftover', () => {
    it('ajoute en tête de liste + appelle DB', async () => {
      mockGetLeftovers.mockResolvedValueOnce([FAKE_LEFTOVER])
      const newItem = { id: 'l3', name: 'oeuf', emoji: '🥚', expires_at: '2026-05-25' }
      mockAddLeftover.mockResolvedValueOnce({ data: newItem, error: null })
      const { result } = renderHook(() => useLeftovers({ id: 'u' }))
      await waitFor(() => expect(result.current.leftovers.length).toBe(1))
      await act(async () => {
        await result.current.addLeftover({ name: 'oeuf', emoji: '🥚' })
      })
      expect(result.current.leftovers[0]).toEqual(newItem)
      expect(result.current.leftovers.length).toBe(2)
    })

    it('no-op si user null', async () => {
      const { result } = renderHook(() => useLeftovers(null))
      const r = await act(async () => await result.current.addLeftover({ name: 'x' }))
      expect(r.error).toEqual({ message: 'no_user' })
      expect(mockAddLeftover).not.toHaveBeenCalled()
    })
  })

  describe('deleteLeftover', () => {
    it('retire de la liste + appelle DB', async () => {
      mockGetLeftovers.mockResolvedValueOnce([FAKE_LEFTOVER, EXPIRED_LEFTOVER])
      const { result } = renderHook(() => useLeftovers({ id: 'u' }))
      await waitFor(() => expect(result.current.leftovers.length).toBe(2))
      await act(async () => { await result.current.deleteLeftover('l1') })
      expect(mockDeleteLeftover).toHaveBeenCalledWith('l1', 'u')
      expect(result.current.leftovers).toEqual([EXPIRED_LEFTOVER])
    })

    it('no-op si user null ou id null', async () => {
      const { result } = renderHook(() => useLeftovers(null))
      await act(async () => { await result.current.deleteLeftover('l1') })
      expect(mockDeleteLeftover).not.toHaveBeenCalled()
    })
  })

  describe('expiredLeftoversCount', () => {
    it('compte uniquement les expirés', async () => {
      mockGetLeftovers.mockResolvedValueOnce([FAKE_LEFTOVER, EXPIRED_LEFTOVER])
      const { result } = renderHook(() => useLeftovers({ id: 'u' }))
      await waitFor(() => expect(result.current.leftovers.length).toBe(2))
      expect(result.current.expiredLeftoversCount).toBe(1)
    })

    it('zéro si aucun expiré', async () => {
      mockGetLeftovers.mockResolvedValueOnce([FAKE_LEFTOVER])
      const { result } = renderHook(() => useLeftovers({ id: 'u' }))
      await waitFor(() => expect(result.current.leftovers.length).toBe(1))
      expect(result.current.expiredLeftoversCount).toBe(0)
    })
  })

  describe('setLeftovers raw setter', () => {
    it('expose setLeftovers pour orchestration', async () => {
      mockGetLeftovers.mockResolvedValueOnce([])
      const { result } = renderHook(() => useLeftovers({ id: 'u' }))
      await waitFor(() => expect(mockGetLeftovers).toHaveBeenCalled())
      act(() => { result.current.setLeftovers([FAKE_LEFTOVER]) })
      expect(result.current.leftovers).toEqual([FAKE_LEFTOVER])
    })
  })
})
