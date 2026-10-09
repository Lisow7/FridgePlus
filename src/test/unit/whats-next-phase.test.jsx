import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WhatsNextPhase from '@features/cart/components/whats-next-phase'

vi.mock('@features/cart/components/whats-next-recipes-card', () => ({ default: () => <div>recipes-card</div> }))
vi.mock('@features/cart/components/whats-next-budget-card', () => ({ default: () => <div>budget-card</div> }))

describe('WhatsNextPhase', () => {
  it('empty-state sans snapshot', () => {
    render(<WhatsNextPhase snapshot={null} lang="fr" />)
    expect(screen.getByText(/termine tes courses/i)).toBeInTheDocument()
  })
  it('rend les 2 cartes + CTA nouveau panier avec snapshot', () => {
    render(<WhatsNextPhase snapshot={{ totalSpent: 5, addedCount: 2 }} recipes={[]} lang="fr" favorites={new Set()} />)
    expect(screen.getByText('recipes-card')).toBeInTheDocument()
    expect(screen.getByText('budget-card')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nouveau panier/i })).toBeInTheDocument()
  })
  it('CTA nouveau panier appelle onStartNewBasket', () => {
    const onStartNewBasket = vi.fn()
    render(<WhatsNextPhase snapshot={{ totalSpent: 5, addedCount: 2 }} recipes={[]} lang="fr" favorites={new Set()} onStartNewBasket={onStartNewBasket} />)
    fireEvent.click(screen.getByRole('button', { name: /nouveau panier/i }))
    expect(onStartNewBasket).toHaveBeenCalled()
  })
})
