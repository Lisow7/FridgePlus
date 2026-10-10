import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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

  it('ne vide pas si l’utilisateur annule', async () => {
    confirmMock.mockResolvedValue(false)
    const onClearBasket = vi.fn()
    render(<HomePhase basket={basket} lang="fr" onClearBasket={onClearBasket} />)
    fireEvent.click(screen.getByText('Vider sans transférer'))
    await Promise.resolve()
    await Promise.resolve()
    expect(onClearBasket).not.toHaveBeenCalled()
  })
})

// Audit du 2026-10-04, lot « accès à la base rangés » : un échec de « J'ai fait
// mes courses » ne se disait pas — le bouton revenait, rien d'autre.
describe('HomePhase — « J’ai fait mes courses » qui échoue le dit', () => {
  it('le frigo n’a rien reçu : une alerte dit que les articles sont toujours au panier', async () => {
    const onCompleteShopping = vi.fn().mockResolvedValue({ error: { message: 'boom' }, addedToFridge: 0 })
    render(<HomePhase basket={basket} lang="fr" onCompleteShopping={onCompleteShopping} />)
    fireEvent.click(screen.getByRole('button', { name: /J['’]ai fait mes courses/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Rien n’est passé au frigo : tes articles sont toujours dans le panier. Réessaie.")
  })

  it('au frigo mais pas retirés du panier : l’alerte le dit', async () => {
    const onCompleteShopping = vi.fn().mockResolvedValue({ error: { message: 'boom' }, addedToFridge: 1, resteAuPanier: true })
    render(<HomePhase basket={basket} lang="fr" onCompleteShopping={onCompleteShopping} />)
    fireEvent.click(screen.getByRole('button', { name: /J['’]ai fait mes courses/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Tes articles sont au frigo, mais n’ont pas pu être retirés du panier. Réessaie.")
  })

  it('réussite : aucune alerte (témoin)', async () => {
    const onCompleteShopping = vi.fn().mockResolvedValue({ error: null, addedToFridge: 1 })
    render(<HomePhase basket={basket} lang="en" onCompleteShopping={onCompleteShopping} />)
    fireEvent.click(screen.getByRole('button', { name: /I['’]m done shopping/ }))
    await waitFor(() => expect(onCompleteShopping).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
