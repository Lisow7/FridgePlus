import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))

import HomePhase from '@features/cart/components/home-phase'

const basket = [{ id: '1', label: 'Tomate', ingredient_id: 'fr-tomate', checked: true, price: 1.5 }]

describe('HomePhase — vider le panier', () => {
  it('appelle useConfirm() avec le titre danger avant de vider', async () => {
    confirmMock.mockResolvedValue(true)
    const onClearBasket = vi.fn()
    render(<HomePhase basket={basket} lang="fr" onClearBasket={onClearBasket} />)
    fireEvent.click(screen.getByText('Vider sans transférer'))
    await Promise.resolve()
    await Promise.resolve()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Vider le panier sans transférer au frigo ?',
      danger: true,
    }))
    expect(onClearBasket).toHaveBeenCalled()
  })

  it('ne vide pas si l\'utilisateur annule', async () => {
    confirmMock.mockResolvedValue(false)
    const onClearBasket = vi.fn()
    render(<HomePhase basket={basket} lang="fr" onClearBasket={onClearBasket} />)
    fireEvent.click(screen.getByText('Vider sans transférer'))
    await Promise.resolve()
    await Promise.resolve()
    expect(onClearBasket).not.toHaveBeenCalled()
  })
})
