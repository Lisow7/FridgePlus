import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/hooks/use-focus-trap', () => ({ useFocusTrap: () => {} }))
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@features/cart/api/shopping-lists', () => ({
  loadShoppingLists: vi.fn().mockResolvedValue([{ id: 'l1', name: 'Courses du mois', items: [{ id: 'i1' }] }]),
}))

import BasketPopover from '@app/layout/header/BasketPopover'

function setup(props = {}) {
  return render(
    <MemoryRouter>
      <BasketPopover
        open
        triggerRef={{ current: null }}
        basket={[]}
        lang="fr"
        userId="u1"
        onClose={vi.fn()}
        onShowRecipes={vi.fn()}
        onLoadShoppingList={vi.fn().mockResolvedValue({ error: null })}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('BasketPopover — charger une liste sauvegardée', () => {
  it('charger une liste depuis un panier vide n\'appelle pas useConfirm() (garde count>0 non atteignable dans cet état)', async () => {
    // Seule branche de rendu qui expose le bouton de chargement d'une liste
    // (handleLoadList) est renderEmptyWithLists(), qui ne s'affiche QUE quand
    // le panier est vide (count === 0, isEmpty === true). Dans cet état, la
    // garde `count > 0 && ...` de handleLoadList est donc toujours fausse :
    // useConfirm() n'est jamais sollicité et onLoadShoppingList est appelé
    // directement. C'était déjà vrai avant la migration confirm() (le
    // window.confirm() natif d'origine était tout aussi inatteignable).
    const onLoadShoppingListMock = vi.fn().mockResolvedValue({ error: null })
    setup({
      basket: [], // count === 0 → isEmpty === true → renderEmptyWithLists()
      onLoadShoppingList: onLoadShoppingListMock,
    })
    await waitFor(() => screen.getByText('Courses du mois'))
    fireEvent.click(screen.getByLabelText(/Voir ma liste : Courses du mois/))
    await waitFor(() => expect(onLoadShoppingListMock).toHaveBeenCalled())
    expect(confirmMock).not.toHaveBeenCalled()
  })
})
