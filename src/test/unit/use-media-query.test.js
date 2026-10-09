import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from '@shared/hooks/use-media-query'

function faussePileMedia(matches) {
  const listeners = new Set()
  const mq = {
    matches,
    addEventListener: (_t, fn) => listeners.add(fn),
    removeEventListener: (_t, fn) => listeners.delete(fn),
  }
  window.matchMedia = vi.fn(() => mq)
  return { mq, emettre: (m) => { mq.matches = m; listeners.forEach(fn => fn({ matches: m })) } }
}

afterEach(() => { delete window.matchMedia })

describe('useMediaQuery', () => {
  it('lit la correspondance initiale et suit ses changements', () => {
    const { emettre } = faussePileMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-height: 600px)'))
    expect(result.current).toBe(false)
    act(() => emettre(true))
    expect(result.current).toBe(true)
  })

  it('rend false sans matchMedia (jsdom nu, pré-rendu)', () => {
    delete window.matchMedia
    const { result } = renderHook(() => useMediaQuery('(max-height: 600px)'))
    expect(result.current).toBe(false)
  })
})
