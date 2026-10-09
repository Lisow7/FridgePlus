import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const show = vi.fn()
vi.mock('@shared/ui/toast/toast-provider', () => ({ useToast: () => ({ show, dismiss: vi.fn() }) }))

const { mockListAll } = vi.hoisted(() => ({ mockListAll: vi.fn() }))
vi.mock('@shared/api/cooking-logs', () => ({ listAllCookingLogs: mockListAll }))

import { useBadgeCelebration } from '@shared/hooks/use-badge-celebration'

const cook = (recipe_id) => ({ recipe_id, recipe_source: 'base', servings: 2, cooked_at: new Date().toISOString() })

beforeEach(() => {
  show.mockReset()
  mockListAll.mockReset()
  localStorage.clear()
})

describe('useBadgeCelebration', () => {
  it('1er appel (seen absent) → seed silencieux, 0 toast', async () => {
    mockListAll.mockResolvedValue([cook('a')]) // volume-1 débloqué
    const { result } = renderHook(() => useBadgeCelebration())
    await result.current('user1', { lang: 'fr' })
    expect(show).not.toHaveBeenCalled()
  })

  it('après baseline, franchir un palier → 1 toast', async () => {
    const { result } = renderHook(() => useBadgeCelebration())
    mockListAll.mockResolvedValueOnce([]) // baseline : 0 débloqué → seed []
    await result.current('user1', { lang: 'fr' })
    expect(show).not.toHaveBeenCalled()

    mockListAll.mockResolvedValueOnce([cook('a')]) // volume-1 franchi
    await result.current('user1', { lang: 'fr' })
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('userId absent → no-op', async () => {
    const { result } = renderHook(() => useBadgeCelebration())
    await result.current(null, { lang: 'fr' })
    expect(mockListAll).not.toHaveBeenCalled()
  })
})
