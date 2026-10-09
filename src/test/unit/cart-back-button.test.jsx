import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CartBackButton from '@features/cart/components/cart-back-button'

describe('CartBackButton', () => {
  it('masqué en phase Préparer', () => {
    const { container } = render(<CartBackButton activePhase="prepare" onPhaseChange={() => {}} lang="fr" />)
    expect(container.firstChild).toBeNull()
  })
  it('masqué en phase « Et après ? »', () => {
    const { container } = render(<CartBackButton activePhase="whatsNext" onPhaseChange={() => {}} lang="fr" />)
    expect(container.firstChild).toBeNull()
  })
  it('depuis En courses → revient à Préparer', () => {
    const onPhaseChange = vi.fn()
    render(<CartBackButton activePhase="shopping" onPhaseChange={onPhaseChange} lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: /précédent/i }))
    expect(onPhaseChange).toHaveBeenCalledWith('prepare')
  })
  it('depuis Rentré → revient à En courses', () => {
    const onPhaseChange = vi.fn()
    render(<CartBackButton activePhase="home" onPhaseChange={onPhaseChange} lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: /précédent/i }))
    expect(onPhaseChange).toHaveBeenCalledWith('shopping')
  })
})
