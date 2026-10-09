import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNewRelease } from '@features/changelog/hooks/use-new-release'

// Mock de la version. Le journal n'est plus lu : le nom de la version vit
// dans version.js (audit du 2026-10-04, PERF-04 — voir nom-de-la-version.test.js).
vi.mock('@shared/lib/version', () => ({ CURRENT_VERSION: '1.1' }))

describe('useNewRelease', () => {
  beforeEach(() => localStorage.clear())

  // Audit du 2026-10-04, UX-11 : sans version vue, un visiteur qui découvrait
  // l'app lisait « Nouveautés disponibles » et le nom de la dernière version.
  // Premier passage sur un appareil : rien d'annoncé, mais la version du jour
  // est notée en silence — la SUIVANTE sera annoncée (comme `badges-seen`).
  it('premier passage (aucune version vue) : rien d’annoncé, la version du jour est notée', () => {
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(false)
    expect(localStorage.getItem('fridge-last-seen-version')).toBe('1.1')
  })

  it('la version suivante est annoncée à qui est passé sans rien ouvrir', () => {
    renderHook(() => useNewRelease()).unmount()
    // Une version plus tard : ce qui a été noté au premier passage est l'ancienne.
    localStorage.setItem('fridge-last-seen-version', '1.0')
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(true)
  })

  it('stockage indisponible : rien d’annoncé, pas d’erreur', () => {
    const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué') })
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqué') })
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(false)
    lire.mockRestore()
    ecrire.mockRestore()
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
    localStorage.setItem('fridge-last-seen-version', '1.0')
    const { result } = renderHook(() => useNewRelease())
    expect(result.current.hasNew).toBe(true)
    act(() => result.current.markSeen())
    expect(result.current.hasNew).toBe(false)
    expect(localStorage.getItem('fridge-last-seen-version')).toBe('1.1')
  })

})
