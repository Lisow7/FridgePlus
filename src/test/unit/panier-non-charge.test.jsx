import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react'

// Audit du 2026-10-04, lot « le panier dit son échec » : quand le panier n'a
// pas pu être lu, il paraissait vide — et depuis un panier vide, « Reprendre
// une liste » ne demande rien : `clearBasket` vidait EN BASE un panier que
// personne n'avait vu, avant d'y poser la liste.

const mockAdd   = vi.hoisted(() => vi.fn())
const mockClear = vi.hoisted(() => vi.fn())
vi.mock('@features/cart/api/basket', () => ({
  addBasketItems:         (...a) => mockAdd(...a),
  clearBasket:            (...a) => mockClear(...a),
  removeBasketItemsByIds: vi.fn(),
  updateBasketItemsBatch: vi.fn(),
  mettreAuFrigo:          vi.fn(),
}))
vi.mock('@shared/lib/pricing/open-prices', () => ({ getEmbeddedPrice: () => null }))

import { useCartActions } from '@features/cart/hooks/use-cart-actions'
import PanierNonCharge from '@features/cart/components/panier-non-charge'

const LISTE = [{ ingredient_id: 'fr-tomate', label: 'Tomate', amount: 2, unit: 'pcs' }]
const monter = (basketNonCharge) => renderHook(() => useCartActions({
  user: { id: 'u-1' }, basket: [], stock: new Set(), lang: 'fr',
  ingredientsById: new Map(), refreshBasket: vi.fn(), basketNonCharge,
})).result

beforeEach(() => {
  mockAdd.mockReset().mockResolvedValue({ error: null })
  mockClear.mockReset().mockResolvedValue({ error: null, deletedCount: 0 })
})

describe('« Reprendre une liste » sur un panier qui n’a pas pu être lu', () => {
  it('🔴 refuse : rien n’est vidé ni ajouté en base', async () => {
    const r = monter(true)
    const res = await act(async () => r.current.handleLoadList(LISTE))
    expect(mockClear).not.toHaveBeenCalled()
    expect(mockAdd).not.toHaveBeenCalled()
    expect(res).toEqual({ error: { message: 'panier_non_charge' } })
  })

  it('panier lu : vide puis pose la liste (témoin)', async () => {
    const r = monter(false)
    const res = await act(async () => r.current.handleLoadList(LISTE))
    expect(mockClear).toHaveBeenCalledWith('u-1')
    expect(mockAdd).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ error: null })
  })
})

describe('l’écran du panier non chargé', () => {
  it('dit que rien n’est perdu, et « Réessayer » relit le panier', () => {
    const onReessayer = vi.fn()
    render(<PanierNonCharge lang="fr" onReessayer={onReessayer} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Ton panier n'a pas pu être chargé. Rien n'est perdu : réessaie.")
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onReessayer).toHaveBeenCalledTimes(1)
  })

  it('en anglais aussi', () => {
    render(<PanierNonCharge lang="en" onReessayer={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Your cart could not be loaded. Nothing is lost: try again.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
