import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// useSmartBack — Sprint 11 S11.c.1.
//
// Comportement attendu :
//   - Si location.key !== 'default' (history non vide) → navigate(-1)
//   - Sinon (history vide, deep-link froid) → navigate(fallback, replace)

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import { useSmartBack } from '@shared/hooks/use-smart-back'

function wrapper({ children, entries = ['/'] }) {
  return <MemoryRouter initialEntries={entries}>{children}</MemoryRouter>
}

describe('useSmartBack', () => {
  beforeEach(() => {
    navigateMock.mockReset()
  })

  it('navigate(-1) si history non vide (key !== "default")', () => {
    // MemoryRouter avec 2 entrées → la seconde a une key générée
    const { result } = renderHook(() => useSmartBack('/'), {
      wrapper: ({ children }) => wrapper({ children, entries: ['/', '/recipe/r-pasta-pesto'] }),
    })
    act(() => result.current())
    expect(navigateMock).toHaveBeenCalledWith(-1)
  })

  it('navigate(fallback, replace) si history vide (key = "default")', () => {
    // MemoryRouter avec une seule entrée → location.key === 'default'
    const { result } = renderHook(() => useSmartBack('/'), {
      wrapper: ({ children }) => wrapper({ children, entries: ['/recipe/r-pasta-pesto'] }),
    })
    act(() => result.current())
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
  })

  it('respecte le fallback custom passé en argument', () => {
    const { result } = renderHook(() => useSmartBack('/profile'), {
      wrapper: ({ children }) => wrapper({ children, entries: ['/recipe/r-pasta-pesto'] }),
    })
    act(() => result.current())
    expect(navigateMock).toHaveBeenCalledWith('/profile', { replace: true })
  })
})
