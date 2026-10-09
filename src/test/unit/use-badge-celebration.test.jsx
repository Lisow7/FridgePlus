import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const show = vi.fn()
vi.mock('@shared/ui/toast/toast-provider', () => ({ useToast: () => ({ show, dismiss: vi.fn() }) }))

const { mockListAll } = vi.hoisted(() => ({ mockListAll: vi.fn() }))
// Le crochet lit le journal par `loadAllCookingLogs`, qui DIT l'échec : `{ logs, error }`.
vi.mock('@shared/api/cooking-logs', () => ({ loadAllCookingLogs: mockListAll }))
const charge = (logs) => ({ logs, error: null })

import { useBadgeCelebration } from '@shared/hooks/use-badge-celebration'

const cook = (recipe_id) => ({ recipe_id, recipe_source: 'base', servings: 2, cooked_at: new Date().toISOString() })

beforeEach(() => {
  show.mockReset()
  mockListAll.mockReset()
  localStorage.clear()
})

describe('useBadgeCelebration', () => {
  it('1er appel (seen absent) → seed silencieux, 0 toast', async () => {
    mockListAll.mockResolvedValue(charge([cook('a')])) // volume-1 débloqué
    const { result } = renderHook(() => useBadgeCelebration())
    await result.current('user1', { lang: 'fr' })
    expect(show).not.toHaveBeenCalled()
  })

  it('après baseline, franchir un palier → 1 toast', async () => {
    const { result } = renderHook(() => useBadgeCelebration())
    mockListAll.mockResolvedValueOnce(charge([])) // baseline : 0 débloqué → seed []
    await result.current('user1', { lang: 'fr' })
    expect(show).not.toHaveBeenCalled()

    mockListAll.mockResolvedValueOnce(charge([cook('a')])) // volume-1 franchi
    await result.current('user1', { lang: 'fr' })
    expect(show).toHaveBeenCalledTimes(1)
  })

  // Audit du 2026-10-04 : le journal rendait une liste VIDE quand il n'avait pas
  // chargé. Le premier appel « semait » alors zéro badge — et le chargement
  // réussi suivant fêtait d'un coup tous les badges que la personne avait déjà.
  it('journal pas chargé : rien n\'est semé — le chargement suivant ne fête pas tout d\'un coup', async () => {
    const { result } = renderHook(() => useBadgeCelebration())
    mockListAll.mockResolvedValueOnce({ logs: [], error: { message: 'Failed to fetch' } })
    await result.current('user1', { lang: 'fr' })
    mockListAll.mockResolvedValueOnce(charge([cook('a')])) // elle AVAIT déjà ce palier
    await result.current('user1', { lang: 'fr' })
    expect(show).not.toHaveBeenCalled()
  })

  it('userId absent → no-op', async () => {
    const { result } = renderHook(() => useBadgeCelebration())
    await result.current(null, { lang: 'fr' })
    expect(mockListAll).not.toHaveBeenCalled()
  })
})
