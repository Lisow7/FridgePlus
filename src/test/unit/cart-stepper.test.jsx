import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CartStepper from '@features/cart/components/cart-stepper'

describe('CartStepper', () => {
  it('rend les 4 onglets dont « Et après ? »', () => {
    render(<CartStepper activePhase="prepare" onPhaseChange={() => {}} lang="fr" />)
    expect(screen.getByRole('tab', { name: /préparer/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /et après/i })).toBeInTheDocument()
  })
  it('désactive « Et après ? » sans whatsNextAvailable', () => {
    render(<CartStepper activePhase="prepare" onPhaseChange={() => {}} lang="fr" />)
    expect(screen.getByRole('tab', { name: /et après/i })).toHaveAttribute('aria-disabled', 'true')
  })
  it('active « Et après ? » si whatsNextAvailable', () => {
    render(<CartStepper activePhase="prepare" onPhaseChange={() => {}} lang="fr" whatsNextAvailable />)
    expect(screen.getByRole('tab', { name: /et après/i })).toHaveAttribute('aria-disabled', 'false')
  })
  it('ne déclenche pas onPhaseChange sur un onglet désactivé', () => {
    const onPhaseChange = vi.fn()
    render(<CartStepper activePhase="prepare" onPhaseChange={onPhaseChange} lang="fr" basketEmpty />)
    fireEvent.click(screen.getByRole('tab', { name: /en courses/i }))
    expect(onPhaseChange).not.toHaveBeenCalled()
  })
})
