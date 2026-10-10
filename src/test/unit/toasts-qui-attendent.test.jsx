import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { UIProvider } from '@shared/contexts/ui-provider'
import { ToastProvider, useToast } from '@shared/ui/toast/toast-provider'

// Audit du 2026-10-04, lot 9g-1 (A11Y-12 (1)) : un message qui part tout seul doit attendre
// qui le lit (WCAG 2.2.1). Sous la souris ou avec le focus dedans, son minuteur se met en
// pause ; il repart avec le temps restant quand on s'en va. Avant : 5 s, point final.

function Harnais({ onShow }) {
  const { show } = useToast()
  // eslint-disable-next-line react-hooks/immutability
  onShow.current = show
  return null
}

function monter() {
  const showRef = { current: null }
  render(<UIProvider><ToastProvider><Harnais onShow={showRef} /></ToastProvider></UIProvider>)
  return showRef
}

describe('les toasts attendent qui les lit', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sous la souris, le toast ne part pas ; il repart avec le temps restant quand elle s’en va', () => {
    const showRef = monter()
    act(() => { showRef.current(<span>Pas enregistré</span>, { duration: 3000 }) })
    act(() => { vi.advanceTimersByTime(1000) })
    const enveloppe = screen.getByText('Pas enregistré').parentElement

    fireEvent.mouseEnter(enveloppe)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText('Pas enregistré')).toBeInTheDocument()

    fireEvent.mouseLeave(enveloppe)
    act(() => { vi.advanceTimersByTime(1999) })
    expect(screen.getByText('Pas enregistré')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2) })
    expect(screen.queryByText('Pas enregistré')).not.toBeInTheDocument()
  })

  it('au clavier aussi : le focus dans le toast le retient, le quitter le relance', () => {
    const showRef = monter()
    act(() => { showRef.current(<span>Ajouté <button>Annuler</button></span>, { duration: 3000 }) })
    const bouton = screen.getByRole('button', { name: 'Annuler' })

    act(() => { bouton.focus() })
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()

    act(() => { bouton.blur() })
    act(() => { vi.advanceTimersByTime(3001) })
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
  })

  it('un toast sans minuteur (duration 0) reste après un survol', () => {
    const showRef = monter()
    act(() => { showRef.current(<span>Permanent</span>, { duration: 0 }) })
    const enveloppe = screen.getByText('Permanent').parentElement
    fireEvent.mouseEnter(enveloppe)
    fireEvent.mouseLeave(enveloppe)
    act(() => { vi.advanceTimersByTime(60000) })
    expect(screen.getByText('Permanent')).toBeInTheDocument()
  })

  it('un toast qu’on lâche à la dernière seconde garde au moins une seconde', () => {
    const showRef = monter()
    act(() => { showRef.current(<span>Court</span>, { duration: 3000 }) })
    act(() => { vi.advanceTimersByTime(2950) })
    const enveloppe = screen.getByText('Court').parentElement
    fireEvent.mouseEnter(enveloppe)
    fireEvent.mouseLeave(enveloppe)
    act(() => { vi.advanceTimersByTime(900) })
    expect(screen.getByText('Court')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(101) })
    expect(screen.queryByText('Court')).not.toBeInTheDocument()
  })
})
