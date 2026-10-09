import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNewRelease } from '@features/changelog/hooks/use-new-release'

// Mock version et changelog
vi.mock('@shared/lib/version', () => ({ CURRENT_VERSION: '1.1' }))
vi.mock('@features/changelog/data/changelog', () => ({
  CHANGELOG: [{ version: '1.1', name: 'La Mise à jour Test', date: 'mai 2026', changes: [] }],
}))

describe('useNewRelease', () => {
  beforeEach(() => localStorage.clear())

  it('hasNew = true quand aucune version vue en localStorage', () => {
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(true)
  })

  it('hasNew = false quand la version courante est déjà vue', () => {
    localStorage.setItem('fridge-last-seen-version', '1.1')
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(false)
  })

  it('hasNew = true quand une ancienne version est vue', () => {
    localStorage.setItem('fridge-last-seen-version', '1.0')
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(true)
  })

  it('markSeen écrit la version courante et passe hasNew à false', () => {
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(true)
    act(() => result.current.markSeen())
    expect(result.current.hasNew).toBe(false)
    expect(localStorage.getItem('fridge-last-seen-version')).toBe('1.1')
  })

  it('latestRelease = première entrée CHANGELOG (entrée complète)', () => {
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.latestRelease).toEqual({
      version: '1.1', name: 'La Mise à jour Test', date: 'mai 2026', changes: [],
    })
  })
})
