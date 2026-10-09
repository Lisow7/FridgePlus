import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@features/admin/api/admin', () => ({
  adminGetIngredients: vi.fn().mockResolvedValue({ data: [], count: 0 }),
  adminGetIngredientById: vi.fn(),
  adminUpsertIngredient: vi.fn().mockResolvedValue({ error: null }),
  adminDeleteIngredient: vi.fn(),
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredientsById: () => new Map([['gp-tomate', { id: 'gp-tomate', labels: { fr: 'Tomate' } }]]),
  useAllergenTypes: () => ({}),
}))
vi.mock('@features/admin/providers/admin-provider', () => ({
  useAdmin: () => ({ refreshStats: vi.fn(), focusEditId: null, setFocusEditId: vi.fn() }),
}))

import IngredientsSection from '@features/admin/components/sections/ingredients-section'

describe('IngredientsSection — enregistrement avec avertissements', () => {
  beforeEach(() => { confirmMock.mockReset() })

  it('champs incomplets : appelle useConfirm() (neutre) avant d\'enregistrer', async () => {
    confirmMock.mockResolvedValue(false)
    render(<IngredientsSection />)
    await waitFor(() => screen.getByText('Ajouter'))
    fireEvent.click(screen.getByText('Ajouter'))
    fireEvent.click(screen.getByText('Enregistrer'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('Données incomplètes'),
    })))
    expect(confirmMock.mock.calls[0][0].danger).not.toBe(true)
  })

  it('doublon détecté en création : le 2e appel useConfirm() mentionne le doublon (neutre)', async () => {
    confirmMock.mockResolvedValue(true)
    render(<IngredientsSection />)
    await waitFor(() => screen.getByText('Ajouter'))
    fireEvent.click(screen.getByText('Ajouter'))
    fireEvent.change(screen.getByPlaceholderText('Tomate'), { target: { value: 'Tomate' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(2))
    expect(confirmMock.mock.calls[1][0].title).toContain('existe déjà')
    expect(confirmMock.mock.calls[1][0].danger).not.toBe(true)
  })
})
