import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockAddFavorite = vi.fn().mockResolvedValue({ error: null })
const mockRemoveFavorite = vi.fn().mockResolvedValue({ error: null })

vi.mock('@features/recipes/api/favorites', () => ({
  addFavorite: (...args) => mockAddFavorite(...args),
  removeFavorite: (...args) => mockRemoveFavorite(...args),
  loadFavoritesFromDB: vi.fn(),
}))

import { useFavorites } from '@features/recipes/hooks/use-favorites'

describe('useFavorites (v3.235.0)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockAddFavorite.mockClear()
    mockRemoveFavorite.mockClear()
  })
  afterEach(() => { localStorage.clear() })

  describe('initial state', () => {
    it('lit le localStorage au mount', () => {
      localStorage.setItem('fridge-favorites', JSON.stringify(['r1', 'r2']))
      const { result } = renderHook(() => useFavorites(null))
      expect(result.current.favorites.has('r1')).toBe(true)
      expect(result.current.favorites.size).toBe(2)
    })

    it('Set vide si localStorage absent', () => {
      const { result } = renderHook(() => useFavorites(null))
      expect(result.current.favorites.size).toBe(0)
    })

    it('Set vide si localStorage corrompu', () => {
      localStorage.setItem('fridge-favorites', '{not-json}')
      const { result } = renderHook(() => useFavorites(null))
      expect(result.current.favorites.size).toBe(0)
    })
  })

  describe('toggleFavorite (guest)', () => {
    it('ajoute si absent → persist localStorage', () => {
      const { result } = renderHook(() => useFavorites(null))
      act(() => { result.current.toggleFavorite('r1') })
      expect(result.current.favorites.has('r1')).toBe(true)
      expect(JSON.parse(localStorage.getItem('fridge-favorites'))).toEqual(['r1'])
    })

    it('retire si présent → persist localStorage', () => {
      const { result } = renderHook(() => useFavorites(null))
      act(() => { result.current.toggleFavorite('r1') })
      act(() => { result.current.toggleFavorite('r1') })
      expect(result.current.favorites.has('r1')).toBe(false)
    })

    it('n\'appelle pas l\'API DB en mode guest', () => {
      const { result } = renderHook(() => useFavorites(null))
      act(() => { result.current.toggleFavorite('r1') })
      expect(mockAddFavorite).not.toHaveBeenCalled()
    })
  })

  describe('toggleFavorite (user connecté)', () => {
    const user = { id: 'u' }

    it('ajoute → addFavorite DB', () => {
      const { result } = renderHook(() => useFavorites(user))
      act(() => { result.current.toggleFavorite('r1') })
      expect(mockAddFavorite).toHaveBeenCalledWith('u', 'r1')
    })

    it('retire → removeFavorite DB', () => {
      const { result } = renderHook(() => useFavorites(user))
      act(() => { result.current.toggleFavorite('r1') })
      act(() => { result.current.toggleFavorite('r1') })
      expect(mockRemoveFavorite).toHaveBeenCalledWith('u', 'r1')
    })

    it('n\'écrit pas dans localStorage en mode connecté', () => {
      const { result } = renderHook(() => useFavorites(user))
      act(() => { result.current.toggleFavorite('r1') })
      expect(localStorage.getItem('fridge-favorites')).toBe(null)
    })
  })

  describe('setFavorites raw setter', () => {
    it('expose setFavorites pour orchestration externe', () => {
      const { result } = renderHook(() => useFavorites(null))
      act(() => { result.current.setFavorites(new Set(['r1', 'r2'])) })
      expect(result.current.favorites.size).toBe(2)
    })
  })
})
