import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  adminGetRecipesByStatus: vi.fn(), adminSetRecipeStatus: vi.fn(), adminDeleteRecipe: vi.fn(),
  adminUpdateCommunityRecipe: vi.fn(), adminPromoteRecipeToBase: vi.fn(),
}))
const annulation = vi.hoisted(() => ({ options: null }))
const admin = vi.hoisted(() => ({ setPendingCount: vi.fn(), refreshStats: vi.fn() }))
const formulaire = vi.hoisted(() => ({ props: null }))

vi.mock('@features/admin/api/admin', () => api)
vi.mock('@shared/contexts/data-provider', () => ({ useCountries: () => [], useIngredientsById: () => ({}) }))
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: (o) => { annulation.options = o } }) }))
vi.mock('@features/admin/providers/admin-provider', () => ({ useAdmin: () => ({ pendingCount: 1, ...admin }) }))
vi.mock('@features/admin/components/sections/moderation-reason-modal', () => ({
  default: ({ onConfirm }) => <button onClick={() => onConfirm('Motif')}>confirmer-moderation</button>,
}))
vi.mock('@features/recipes/components/recipe-form-modal', () => ({
  default: (props) => { formulaire.props = props; return <div>formulaire-recette</div> },
}))
vi.mock('@shared/ui/confirm-dialog/confirm-modals', () => ({
  ConfirmDeleteModal: ({ onConfirm }) => <button onClick={onConfirm}>confirmer-suppression</button>,
  ConfirmActionModal: ({ title, onConfirm, onCancel }) => (
    <div role="dialog" aria-label={title}>
      <button onClick={onConfirm}>confirmer-action</button>
      <button onClick={onCancel}>annuler-action</button>
    </div>
  ),
}))

import CustomRecipesSection from '@features/admin/components/sections/custom-recipes-section'

// Audit du 2026-10-04, ADM-02 : approuver, rejeter, remettre en attente,
// supprimer et éditer une recette — les actions les plus fréquentes du
// panneau — jetaient le résultat de l'écriture. En cas d'échec : la recette
// quittait la file, le badge baissait, aucun message ; pour l'édition, le
// formulaire se fermait et la saisie était perdue.
const RECETTE = { id: 'r-1', title: 'Tarte aux pommes', moderation_status: 'pending', user_id: 'u-1', username: 'alice', created_at: '2026-10-01T10:00:00Z', data: { emoji: '🥧', image_url: 'https://x/y.jpg' } }
const RIEN_TOUCHE = { code: 'no_rows_affected', message: 'no_rows_affected' }
const MESSAGE = 'Rien n\'a été modifié : l\'élément n\'existe plus, ou les droits ne le permettent pas.'

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset())
  Object.values(admin).forEach((m) => m.mockReset())
  annulation.options = null
  formulaire.props = null
  api.adminGetRecipesByStatus.mockResolvedValue({ data: [RECETTE], error: null })
})

async function monter() {
  render(<CustomRecipesSection lang="fr" />)
  expect(await screen.findByText('Tarte aux pommes')).toBeInTheDocument()
}

describe('Recettes + — modérer une recette', () => {
  it('la base refuse : la recette reste dans la file, le badge ne bouge pas, et c’est dit', async () => {
    api.adminSetRecipeStatus.mockResolvedValue({ error: RIEN_TOUCHE })
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Approuver' }))
    fireEvent.click(screen.getByText('confirmer-moderation'))
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGE)
    expect(screen.getByText('Tarte aux pommes')).toBeInTheDocument()
    expect(admin.setPendingCount).not.toHaveBeenCalled()
  })

  it('la base accepte : la recette quitte la file (témoin)', async () => {
    api.adminSetRecipeStatus.mockResolvedValue({ error: null })
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Approuver' }))
    fireEvent.click(screen.getByText('confirmer-moderation'))
    await waitFor(() => expect(screen.queryByText('Tarte aux pommes')).toBeNull())
    expect(api.adminSetRecipeStatus).toHaveBeenCalledWith('r-1', 'approved', 'Motif')
    expect(admin.setPendingCount).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Recettes + — supprimer une recette (bandeau d’annulation)', () => {
  async function supprimer() {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(screen.getByText('confirmer-suppression'))
    // Masquée tout de suite, le temps du bandeau.
    expect(screen.queryByText('Tarte aux pommes')).toBeNull()
  }

  it('la base refuse : la recette revient, et c’est dit', async () => {
    api.adminDeleteRecipe.mockResolvedValue({ error: RIEN_TOUCHE })
    await supprimer()
    await act(() => annulation.options.onConfirm())
    expect(screen.getByText('Tarte aux pommes')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE)
  })

  it('la base accepte : la recette est partie (témoin)', async () => {
    api.adminDeleteRecipe.mockResolvedValue({ error: null })
    await supprimer()
    await act(() => annulation.options.onConfirm())
    expect(screen.queryByText('Tarte aux pommes')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

// Audit du 2026-10-04, ADM-23 : approuver une sélection partait au premier
// clic — les recettes devenaient visibles par tous sans un mot.
describe('Recettes + — approuver une sélection se confirme', () => {
  async function selectionnerPuisApprouver() {
    await monter()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner cette recette' }))
    fireEvent.click(screen.getByRole('button', { name: 'Approuver la sélection' }))
  }

  it('la question compte les recettes ; « Annuler » n’approuve rien', async () => {
    await selectionnerPuisApprouver()
    expect(screen.getByRole('dialog', { name: 'Approuver 1 recette ?' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('annuler-action'))
    expect(screen.queryByRole('dialog', { name: 'Approuver 1 recette ?' })).not.toBeInTheDocument()
    expect(api.adminSetRecipeStatus).not.toHaveBeenCalled()
  })

  it('confirmée, la sélection est approuvée', async () => {
    api.adminSetRecipeStatus.mockResolvedValue({ error: null })
    await selectionnerPuisApprouver()
    expect(api.adminSetRecipeStatus).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('confirmer-action'))
    await waitFor(() => expect(api.adminSetRecipeStatus).toHaveBeenCalledWith('r-1', 'approved'))
  })
})

// Les trois actions groupées passent par un seul chemin : ne retirer les
// lignes que sur succès complet, vider la sélection, dire le bilan.
describe('Recettes + — rejeter ou supprimer une sélection', () => {
  const selectionner = async () => {
    await monter()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner cette recette' }))
  }

  it('rejeter : le motif part avec chaque recette, qui quitte la file', async () => {
    api.adminSetRecipeStatus.mockResolvedValue({ error: null })
    await selectionner()
    fireEvent.click(screen.getByRole('button', { name: 'Rejeter la sélection' }))
    fireEvent.click(screen.getByText('confirmer-moderation'))
    await waitFor(() => expect(api.adminSetRecipeStatus).toHaveBeenCalledWith('r-1', 'rejected', 'Motif'))
    expect(await screen.findByText('1 recette rejetée.')).toBeInTheDocument()
    expect(screen.queryByText('Tarte aux pommes')).not.toBeInTheDocument()
  })

  it('supprimer : la base refuse, la recette reste dans la file, et c’est dit', async () => {
    api.adminDeleteRecipe.mockResolvedValue({ error: { message: 'RLS refuse' } })
    await selectionner()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la sélection' }))
    fireEvent.click(screen.getByText('confirmer-suppression'))
    await waitFor(() => expect(api.adminDeleteRecipe).toHaveBeenCalledWith('r-1'))
    expect(await screen.findByText(/aucun des 1 éléments n'a été traité \(RLS refuse\)/)).toBeInTheDocument()
    expect(screen.getByText('Tarte aux pommes')).toBeInTheDocument()
  })
})

describe('Recettes + — éditer une recette', () => {
  it('la base refuse : le formulaire reçoit l’erreur (il reste ouvert, la saisie est gardée), rien n’est rechargé', async () => {
    api.adminUpdateCommunityRecipe.mockResolvedValue({ error: RIEN_TOUCHE })
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    let resultat
    await act(async () => { resultat = await formulaire.props.onSave({ name: 'Tarte' }) })
    expect(resultat).toEqual({ error: RIEN_TOUCHE })
    expect(api.adminGetRecipesByStatus).toHaveBeenCalledTimes(1)
  })

  it('la base accepte : la liste est rechargée (témoin)', async () => {
    api.adminUpdateCommunityRecipe.mockResolvedValue({ error: null })
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    let resultat
    await act(async () => { resultat = await formulaire.props.onSave({ name: 'Tarte' }) })
    expect(resultat?.error ?? null).toBeNull()
    await waitFor(() => expect(api.adminGetRecipesByStatus).toHaveBeenCalledTimes(2))
  })
})
