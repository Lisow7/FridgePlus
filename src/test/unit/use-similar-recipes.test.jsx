import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const findMock = vi.fn()
vi.mock('@features/recipes/api/recipes', () => ({
  findSimilarRecipes: (...a) => findMock(...a),
}))

import { useSimilarRecipes } from '@features/recipes/hooks/use-similar-recipes'

describe('useSimilarRecipes', () => {
  beforeEach(() => { findMock.mockReset(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('n\'appelle pas sous le seuil (nom < 3 / 0 ingrédient / désactivé)', () => {
    renderHook(() => useSimilarRecipes('ab', ['x'], null, true))
    act(() => vi.advanceTimersByTime(800))
    expect(findMock).not.toHaveBeenCalled()

    renderHook(() => useSimilarRecipes('abc', [], null, true))
    act(() => vi.advanceTimersByTime(800))
    expect(findMock).not.toHaveBeenCalled()

    renderHook(() => useSimilarRecipes('abc', ['x'], null, false))
    act(() => vi.advanceTimersByTime(800))
    expect(findMock).not.toHaveBeenCalled()
  })

  it('appelle (debouncé) au-dessus du seuil et expose le résultat', async () => {
    findMock.mockResolvedValue([{ id: 'r-1', title: 'Carbonara', score: 0.9 }])
    const { result } = renderHook(() => useSimilarRecipes('carbonara', ['gp-pates'], 'custom-x', true))
    expect(findMock).not.toHaveBeenCalled() // pas encore (debounce)
    // advanceTimersByTimeAsync avance les timers ET flush les microtasks (résolution async).
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(findMock).toHaveBeenCalledWith('carbonara', ['gp-pates'], 'custom-x')
    expect(result.current.similar).toHaveLength(1)
  })
})
