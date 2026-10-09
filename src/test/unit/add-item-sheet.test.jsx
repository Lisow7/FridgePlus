import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@features/cart/components/cart-manual-add', () => ({
  default: ({ onAdd }) => <button onClick={() => onAdd({ ingredient_id: 'fr-tomate', label: 'Tomate' })}>add-manual</button>,
}))
vi.mock('@features/cart/components/cart-suggestions-modal', () => ({ default: () => null }))

import AddItemSheet from '@features/cart/components/add-item-sheet'

describe('AddItemSheet — confirmation de doublon', () => {
  it('demande confirmation via useConfirm() quand l\'ingrédient est déjà dans le panier', async () => {
    confirmMock.mockResolvedValue(true)
    const onAddManualItem = vi.fn()
    render(
      <AddItemSheet
        open
        lang="fr"
        onAddManualItem={onAddManualItem}
        basket={[{ ingredient_id: 'fr-tomate', recipe_name: 'Salade' }]}
      />
    )
    fireEvent.click(screen.getByText('add-manual'))
    await Promise.resolve()
    await Promise.resolve()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Tomate déjà dans ton panier via Salade. Ajouter quand même ?',
    }))
    expect(onAddManualItem).toHaveBeenCalledWith({ ingredient_id: 'fr-tomate', label: 'Tomate' })
  })

  it('n\'ajoute pas si l\'utilisateur annule', async () => {
    confirmMock.mockResolvedValue(false)
    const onAddManualItem = vi.fn()
    render(
      <AddItemSheet
        open
        lang="fr"
        onAddManualItem={onAddManualItem}
        basket={[{ ingredient_id: 'fr-tomate', recipe_name: 'Salade' }]}
      />
    )
    fireEvent.click(screen.getByText('add-manual'))
    await Promise.resolve()
    await Promise.resolve()
    expect(onAddManualItem).not.toHaveBeenCalled()
  })
})
