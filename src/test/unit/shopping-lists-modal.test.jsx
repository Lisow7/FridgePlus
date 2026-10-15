import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/hooks/use-focus-trap', () => ({ useFocusTrap: () => {} }))
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: vi.fn() }) }))
vi.mock('@features/cart/api/shopping-lists', () => ({
  loadShoppingLists: vi.fn().mockResolvedValue([{ id: 'l1', name: 'Courses du mois', items: [], updated_at: '2026-01-01' }]),
  updateShoppingList: vi.fn(),
  deleteShoppingList: vi.fn().mockResolvedValue({ error: null }),
  createShoppingList: vi.fn(),
  SHOPPING_LISTS_MAX_PER_USER: 10,
  SHOPPING_LIST_NAME_MAX: 80,
}))

import ShoppingListsModal from '@features/cart/components/shopping-lists-modal'

describe('ShoppingListsModal — confirmations imbriquées', () => {
  it('charger une liste avec panier non-vide demande confirmation (danger)', async () => {
    confirmMock.mockResolvedValue(true)
    const onLoadList = vi.fn().mockResolvedValue({ error: null })
    render(<ShoppingListsModal userId="u1" lang="fr" basketHasItems onLoadList={onLoadList} onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Courses du mois'))
    fireEvent.click(screen.getByLabelText('Charger Courses du mois'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Ton panier actuel n’est pas vide. Le remplacer par cette liste ?',
      danger: true,
    })))
    await waitFor(() => expect(onLoadList).toHaveBeenCalled())
  })

  it('supprimer une liste splitte le message sur \\n\\n en title/body', async () => {
    confirmMock.mockResolvedValue(false)
    render(<ShoppingListsModal userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Courses du mois'))
    fireEvent.click(screen.getByLabelText('Supprimer Courses du mois'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Supprimer définitivement la liste « Courses du mois » ?',
      body: 'Cette action est différente de « Fermer ma liste » dans le panier — ici tu supprimes la liste enregistrée. Tu auras 10 secondes pour annuler.',
      danger: true,
    })))
  })
})

describe('ShoppingListsModal — annonce lecteur d’écran', () => {
  // L'annonce SR arme un setTimeout de 50 ms. S'il survit au démontage, il
  // se déclenche pendant le teardown de jsdom et fait sortir Vitest en erreur
  // (`window is not defined`) alors que tous les tests passent — un flake CI
  // observé sur la release v0.120.
  it('ne laisse aucun timer armé après démontage', async () => {
    confirmMock.mockResolvedValue(true)
    const onLoadList = vi.fn().mockResolvedValue({ error: null })
    const { unmount } = render(
      <ShoppingListsModal userId="u1" lang="fr" onLoadList={onLoadList} onClose={vi.fn()} />,
    )
    await waitFor(() => screen.getByText('Courses du mois'))

    // Horloge figée à partir d'ici : le timer d'annonce ne peut plus se
    // déclencher tout seul, donc sa présence après démontage est mesurable.
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByLabelText('Charger Courses du mois'))
      // Les promesses se résolvent en microtâches, sans avancer l'horloge.
      await act(async () => {})
      expect(onLoadList).toHaveBeenCalled()

      // Comptage relatif, et non absolu : ce qu'on mesure est « le démontage
      // désarme le timer d'annonce », pas « il n'existe aucun timer au monde ».
      // Un éventuel timer d'arrière-plan (React, une lib) ne doit pas rendre
      // ce test fragile.
      const armed = vi.getTimerCount()
      expect(armed).toBeGreaterThanOrEqual(1)

      unmount()
      expect(vi.getTimerCount()).toBe(armed - 1)
    } finally {
      vi.useRealTimers()
    }
  })
})
