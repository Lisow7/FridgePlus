import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const confirmer = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => confirmer.fn }))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredientsById: () => new Map(), useAllergenTypes: () => ({}), useCountries: () => [], useIngredients: () => ({}),
}))
const admin = vi.hoisted(() => ({
  adminGetBaseRecipes: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
  adminGetBaseRecipeById: vi.fn(), adminUpsertBaseRecipe: vi.fn(), adminDeleteBaseRecipe: vi.fn(),
  adminGetFavoriteCountsByIds: vi.fn().mockResolvedValue({}), countMissingImageBaseRecipes: vi.fn().mockResolvedValue(0),
}))
vi.mock('@features/admin/api/admin', () => admin)
vi.mock('@features/admin/providers/admin-provider', () => ({
  useAdmin: () => ({ refreshStats: vi.fn(), focusEditId: null, setFocusEditId: vi.fn() }),
}))

import IngredientForm from '@features/admin/components/sections/ingredient-form'
import BaseRecipesSection from '@features/admin/components/sections/base-recipes-section'

// Audit du 2026-10-04, ADM-18 : les formulaires d'ingrédient et de recette de
// base se quittaient sans contrôle — une recette longue (étapes, ingrédients)
// se perdait sur un tap.

beforeEach(() => { confirmer.fn.mockReset() })

describe('formulaire d’ingrédient — quitter sans perdre la saisie', () => {
  const monter = (onBack) => render(<IngredientForm item={{ id: 'gp-cafe', emoji: '☕', labels: { fr: 'Café' } }} onSave={vi.fn()} onBack={onBack} border="#ccc" textColor="#000" muted="#666" />)

  it('rien de changé : « ← Retour » quitte sans demander', () => {
    const onBack = vi.fn()
    monter(onBack)
    fireEvent.click(screen.getByText('← Retour'))
    expect(confirmer.fn).not.toHaveBeenCalled()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('une modification : « Annuler » demande ; refusé, on reste', async () => {
    confirmer.fn.mockResolvedValue(false)
    const onBack = vi.fn()
    monter(onBack)
    fireEvent.change(screen.getByPlaceholderText('Tomate'), { target: { value: 'Café moulu' } })
    fireEvent.click(screen.getByText('Annuler'))
    await waitFor(() => expect(confirmer.fn).toHaveBeenCalledWith(expect.objectContaining({ title: 'Abandonner les modifications ?' })))
    expect(onBack).not.toHaveBeenCalled()
  })
})

describe('formulaire de recette de base — quitter sans perdre la saisie', () => {
  it('un nom tapé : « ← Retour » demande ; accepté, on quitte', async () => {
    confirmer.fn.mockResolvedValue(true)
    render(<BaseRecipesSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter/ }))
    fireEvent.change(screen.getByLabelText('Nom FR *'), { target: { value: 'Soupe de légumes' } })
    fireEvent.click(screen.getByText('← Retour'))
    await waitFor(() => expect(confirmer.fn).toHaveBeenCalledWith(expect.objectContaining({ title: 'Abandonner les modifications ?' })))
    await waitFor(() => expect(screen.queryByLabelText('Nom FR *')).not.toBeInTheDocument())
  })
})
