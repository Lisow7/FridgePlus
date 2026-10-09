import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Le panier vide propose de reprendre une liste enregistrée, ou d'ajouter un
// ingrédient suggéré. Les deux gestes jetaient leur échec : la liste ne se
// chargeait pas, l'ingrédient ne s'ajoutait pas, et l'écran ne disait rien
// (relevé le 2026-10-08, après la correction du vidage refusé — lot 14c).

vi.mock('@features/cart/api/shopping-lists', () => ({
  loadShoppingLists: vi.fn(() => Promise.resolve([
    { id: 'l-1', name: 'Courses du samedi', items: [{ ingredient_id: 'vg-tomate' }], created_at: '2026-10-01T10:00:00Z' },
  ])),
  getFrequentIngredients: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({ legumes: [{ id: 'vg-tomate', labels: { fr: 'Tomate' } }] }),
  useBaseRecipes: () => ({ recipes: [], recipeNames: {} }),
}))

import EmptyBasketState from '@features/cart/components/empty-basket-state'

const LISTE = /Courses du samedi/

function rendre(props) {
  render(<EmptyBasketState userId="u-1" lang="fr" onManualAdd={vi.fn()} onLoadList={vi.fn()} {...props} />)
}

beforeEach(() => vi.clearAllMocks())

describe('le panier vide dit ses échecs', () => {
  it('reprendre une liste qui échoue : c’est dit', async () => {
    const onLoadList = vi.fn().mockResolvedValue({ error: { message: 'réseau' } })
    rendre({ onLoadList })
    fireEvent.click(await screen.findByRole('button', { name: LISTE }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La liste n’a pas pu être chargée. Réessaie.')
    expect(onLoadList).toHaveBeenCalledWith([{ ingredient_id: 'vg-tomate' }], { id: 'l-1', name: 'Courses du samedi' })
  })

  it('l’appel lève : même chose', async () => {
    rendre({ onLoadList: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) })
    fireEvent.click(await screen.findByRole('button', { name: LISTE }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La liste n’a pas pu être chargée.')
  })

  it('une liste chargée ne dit rien (témoin)', async () => {
    const onLoadList = vi.fn().mockResolvedValue({ error: null })
    rendre({ onLoadList })
    fireEvent.click(await screen.findByRole('button', { name: LISTE }))
    await waitFor(() => expect(onLoadList).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un ingrédient suggéré qui ne s’ajoute pas : c’est dit', async () => {
    const onManualAdd = vi.fn().mockResolvedValue({ error: { message: 'réseau' } })
    rendre({ onManualAdd })
    fireEvent.click(await screen.findByRole('button', { name: /Tomate/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('L’ingrédient n’a pas pu être ajouté. Réessaie.')
  })
})
