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
  adminCountIngredientUsage: vi.fn().mockResolvedValue({ count: 0, error: null }),
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredientsById: () => new Map([['gp-tomate', { id: 'gp-tomate', labels: { fr: 'Tomate' } }]]),
  useAllergenTypes: () => ({}),
}))
vi.mock('@features/admin/providers/admin-provider', () => ({
  useAdmin: () => ({ refreshStats: vi.fn(), focusEditId: null, setFocusEditId: vi.fn() }),
}))

import IngredientsSection from '@features/admin/components/sections/ingredients-section'
import IngredientForm from '@features/admin/components/sections/ingredient-form'
import { adminGetIngredients, adminCountIngredientUsage } from '@features/admin/api/admin'

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

// Audit du 2026-10-04, ADM-16 : un nouvel ingrédient s'insère, et la base
// refuse un identifiant déjà pris (23505) au lieu de l'écraser en silence.
describe('IngredientForm — identifiant déjà pris', () => {
  beforeEach(() => { confirmMock.mockReset(); confirmMock.mockResolvedValue(true) })

  it('le refus de la base est dit en clair, avec l’identifiant', async () => {
    const onSave = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint "ingredients_pkey"' } })
    render(<IngredientForm item={{ _isNew: true, emoji: '🍅', labels: { fr: 'Tomate cerise' } }} onSave={onSave} onBack={() => {}} border="#ccc" textColor="#000" muted="#666" />)
    fireEvent.change(screen.getByRole('textbox', { name: /suite/ }), { target: { value: 'tomate cerise' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    expect(await screen.findByText('L\'identifiant « fr-tomate-cerise » existe déjà : modifie-le avant d\'enregistrer.')).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'fr-tomate-cerise', _isNew: true }))
  })
})

// ADM-16 : la confirmation de suppression demandait de « vérifier qu'aucune
// recette ne le référence », sans liste ni compteur.
describe('IngredientsSection — la suppression dit combien de recettes s’en servent', () => {
  beforeEach(() => {
    adminGetIngredients.mockResolvedValue({ data: [{ id: 'gp-cafe', emoji: '☕', labels: { fr: 'Café' }, subcategory: 'drinks' }], count: 1 })
  })

  it('3 recettes : la confirmation le dit', async () => {
    adminCountIngredientUsage.mockResolvedValue({ count: 3, error: null })
    render(<IngredientsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText(/3 recettes s'en servent : il deviendra introuvable pour elles\./)).toBeInTheDocument()
    expect(adminCountIngredientUsage).toHaveBeenCalledWith('gp-cafe')
  })

  it('aucune recette : la confirmation le dit aussi', async () => {
    adminCountIngredientUsage.mockResolvedValue({ count: 0, error: null })
    render(<IngredientsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText(/Aucune recette ne s'en sert\./)).toBeInTheDocument()
  })

  it('le compte échoue : la confirmation dit qu’on ne sait pas', async () => {
    adminCountIngredientUsage.mockResolvedValue({ count: 0, error: { message: 'réseau' } })
    render(<IngredientsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText(/Impossible de compter les recettes qui s'en servent/)).toBeInTheDocument()
  })
})
