import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WhatsNextBudgetCard from '@features/cart/components/whats-next-budget-card'

describe('WhatsNextBudgetCard', () => {
  it('affiche le total et la clause prix indicatifs', () => {
    render(<WhatsNextBudgetCard snapshot={{ totalSpent: 12.5, addedCount: 4 }} lang="fr" />)
    expect(screen.getByText(/12,50/)).toBeInTheDocument()
    expect(screen.getByText(/indicatif/i)).toBeInTheDocument()
  })
  it('affiche — si total nul', () => {
    render(<WhatsNextBudgetCard snapshot={{ totalSpent: 0, addedCount: 0 }} lang="fr" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
  it('CTA détail rendu seulement si onShowDetail fourni', () => {
    const { rerender } = render(<WhatsNextBudgetCard snapshot={{ totalSpent: 5, addedCount: 1 }} lang="fr" />)
    expect(screen.queryByRole('button', { name: /détail/i })).not.toBeInTheDocument()
    const onShowDetail = vi.fn()
    rerender(<WhatsNextBudgetCard snapshot={{ totalSpent: 5, addedCount: 1 }} lang="fr" onShowDetail={onShowDetail} />)
    fireEvent.click(screen.getByRole('button', { name: /détail/i }))
    expect(onShowDetail).toHaveBeenCalled()
  })
})
