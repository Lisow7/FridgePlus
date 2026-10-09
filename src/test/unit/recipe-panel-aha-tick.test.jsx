import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAhaTick } from '@features/recipes/hooks/use-aha-tick'

describe('useAhaTick (Fix C)', () => {
  it('coche quand panneau ouvert + stock + readyCount>0 + recherche vide', () => {
    const onSuggestionOpen = vi.fn()
    renderHook(() => useAhaTick({ open: true, stockSize: 3, readyCount: 1, searchQuery: '', onSuggestionOpen }))
    expect(onSuggestionOpen).toHaveBeenCalledOnce()
  })
  it('NE coche PAS si readyCount=0 (ALMOST seulement)', () => {
    const onSuggestionOpen = vi.fn()
    renderHook(() => useAhaTick({ open: true, stockSize: 3, readyCount: 0, searchQuery: '', onSuggestionOpen }))
    expect(onSuggestionOpen).not.toHaveBeenCalled()
  })
  it('NE coche PAS si recherche active', () => {
    const onSuggestionOpen = vi.fn()
    renderHook(() => useAhaTick({ open: true, stockSize: 3, readyCount: 5, searchQuery: 'pâtes', onSuggestionOpen }))
    expect(onSuggestionOpen).not.toHaveBeenCalled()
  })
  it('NE coche PAS si stock vide', () => {
    const onSuggestionOpen = vi.fn()
    renderHook(() => useAhaTick({ open: true, stockSize: 0, readyCount: 5, searchQuery: '', onSuggestionOpen }))
    expect(onSuggestionOpen).not.toHaveBeenCalled()
  })
})
