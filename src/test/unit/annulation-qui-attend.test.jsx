import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { UndoProvider, useUndo } from '@shared/contexts/undo-provider'
import UndoToastStack from '@shared/ui/undo-toast-stack'

// Audit du 2026-10-04, lot 9g-1 (A11Y-12 (2)) : les 10 s d'« Annuler » ont leur propre
// minuteur, hors du fournisseur de toasts. Même règle : sous la souris ou avec le focus
// dedans, la suppression attend ; la barre de compte à rebours suit la durée demandée
// (elle était calée sur 10 000 en dur) et se fige pendant la pause.

function Harnais({ onTrigger }) {
  const { trigger } = useUndo()
  // eslint-disable-next-line react-hooks/immutability
  onTrigger.current = trigger
  return null
}

describe('l’annulation attend qui la lit', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sous la souris, la suppression n’est pas confirmée ; elle l’est après, avec le temps restant', async () => {
    const triggerRef = { current: null }
    const onConfirm = vi.fn()
    render(<UndoProvider lang="fr"><Harnais onTrigger={triggerRef} /></UndoProvider>)
    act(() => { triggerRef.current({ label: 'Recette retirée', onConfirm, onUndo: vi.fn() }) })
    act(() => { vi.advanceTimersByTime(4000) })
    const toast = screen.getByText('Recette retirée').closest('[role="status"]')

    fireEvent.mouseEnter(toast)
    await act(async () => { vi.advanceTimersByTime(30000) })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Recette retirée')).toBeInTheDocument()

    fireEvent.mouseLeave(toast)
    await act(async () => { vi.advanceTimersByTime(5999) })
    expect(onConfirm).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(2) })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Recette retirée')).not.toBeInTheDocument()
  })

  it('le focus sur « Annuler » retient la suppression ; « Annuler » reste possible pendant la pause', async () => {
    const triggerRef = { current: null }
    const onConfirm = vi.fn()
    const onUndo = vi.fn()
    render(<UndoProvider lang="fr"><Harnais onTrigger={triggerRef} /></UndoProvider>)
    act(() => { triggerRef.current({ label: 'Liste supprimée', onConfirm, onUndo }) })
    const bouton = screen.getByRole('button', { name: 'Annuler la suppression' })

    act(() => { bouton.focus() })
    await act(async () => { vi.advanceTimersByTime(30000) })
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.click(bouton)
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('la barre de compte à rebours', () => {
  it('suit la durée demandée, pas 10 000 en dur', async () => {
    const now = Date.now()
    render(<UndoToastStack stack={[{ id: 'u1', label: 'Retiré', expireAt: now + 2000, durationMs: 4000 }]} onUndo={() => {}} lang="fr" />)
    const barre = screen.getByText('Retiré').closest('[role="status"]').querySelector('[data-barre]')
    await waitFor(() => expect(barre.style.width).toMatch(/^(4[5-9]|5[0-5])%$/))
  })

  it('se fige pendant la pause', async () => {
    const now = Date.now()
    render(<UndoToastStack stack={[{ id: 'u1', label: 'Retiré', expireAt: now + 5000, durationMs: 10000, pauseAt: now }]} onUndo={() => {}} lang="fr" />)
    const barre = screen.getByText('Retiré').closest('[role="status"]').querySelector('[data-barre]')
    await waitFor(() => expect(barre.style.width).toBe('50%'))
    await new Promise((r) => setTimeout(r, 120))
    expect(barre.style.width).toBe('50%')
  })
})
