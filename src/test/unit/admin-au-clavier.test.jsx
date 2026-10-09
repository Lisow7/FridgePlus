import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'

// Audit du 2026-10-04, ADM-19 et A11Y-10 : le panneau admin au clavier et au
// lecteur d'écran. Ce qui ne se faisait qu'à la souris :
//   - supprimer un ticket : un `<span onClick>` DANS le bouton de la ligne, qui
//     contenait aussi le bouton « Marquer résolu » (HTML invalide : un bouton
//     dans un bouton) ;
//   - supprimer un message (RGPD) : le bouton n'existait que pendant le survol ;
//   - déplier une ligne du journal, ouvrir une ligne de la qualité : des `div`
//     cliquables, hors de l'ordre de tabulation ;
//   - cocher un allergène ou un régime : des `<span onClick>`.

const supportApi = vi.hoisted(() => ({
  adminGetAllTickets: vi.fn(), getTicketMessages: vi.fn(), markTicketReadByAdmin: vi.fn(),
  adminSetTicketStatus: vi.fn(), adminReplyTicket: vi.fn(), adminDeleteTicket: vi.fn(),
  adminDeleteMessage: vi.fn(), adminDeleteAnyMessage: vi.fn(),
}))
const adminApi = vi.hoisted(() => ({
  adminGetLogs: vi.fn(), adminGetRecipesByIds: vi.fn(), adminGetUsersByIds: vi.fn(), adminGetHealthChecks: vi.fn(),
}))
vi.mock('@features/support/api/support', () => supportApi)
vi.mock('@features/admin/api/admin', () => adminApi)
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: () => {} }) }))
vi.mock('@features/admin/providers/admin-provider', () => ({ useAdmin: () => ({ setSupportBadge: () => {} }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useAllergenTypes: () => ({ gluten: { icon: '🌾', labels: { fr: 'Gluten' } } }),
  useCountries: () => [], useIngredientsById: () => new Map(), useIngredients: () => ({}),
}))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => async () => true }))
vi.mock('@shared/ui/confirm-dialog/confirm-modals', () => ({
  ConfirmDeleteModal: ({ title }) => <p>{title}</p>,
}))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
// La pagination lit la langue du `UIProvider` : sans rapport avec ce qu'on vérifie.
vi.mock('@shared/ui/pagination', () => ({ default: () => null }))

import SupportSection from '@features/admin/components/sections/support-section'
import JournalSection from '@features/admin/components/sections/journal-section'
import DataQualitySection from '@features/admin/components/sections/data-quality-section'
import IngredientExtraFields from '@features/admin/components/ingredient-extra-fields'
import BaseRecipeForm from '@features/admin/components/sections/base-recipe-form'

beforeEach(() => {
  Object.values(supportApi).forEach((m) => m.mockReset())
  Object.values(adminApi).forEach((m) => m.mockReset())
})

// Un élément interactif dans un autre : le clavier n'atteint pas l'intérieur,
// et le lecteur d'écran lit le tout comme un seul bouton.
const imbriques = () => [...document.querySelectorAll('button')]
  .flatMap((b) => [...b.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [onclick]')])

describe('Support — une ligne de ticket', () => {
  const TICKET = { id: 't-1', user_id: 'u-2', type: 'question', title: 'Question sur le frigo', status: 'open', has_unread_admin: false, has_unread_user: false, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', username: 'bob' }

  beforeEach(() => {
    supportApi.adminGetAllTickets.mockResolvedValue([TICKET])
    supportApi.getTicketMessages.mockResolvedValue({ messages: [], error: null })
  })

  it('n’imbrique aucun bouton dans un autre', async () => {
    render(<SupportSection lang="fr" />)
    await screen.findByText('Question sur le frigo')
    expect(imbriques()).toEqual([])
  })

  it('supprimer est un vrai bouton, nommé d’après le ticket, et n’ouvre pas le ticket', async () => {
    render(<SupportSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le ticket « Question sur le frigo »' }))
    expect(screen.getByText('Supprimer ce ticket ?')).toBeInTheDocument()
    expect(supportApi.getTicketMessages).not.toHaveBeenCalled()
  })

  it('« Marquer résolu » est un bouton à part, qui n’ouvre pas le ticket', async () => {
    supportApi.adminSetTicketStatus.mockResolvedValue({ error: null })
    render(<SupportSection lang="fr" />)
    const resoudre = await screen.findByRole('button', { name: 'Marquer « Question sur le frigo » résolu' })
    await act(async () => { fireEvent.click(resoudre) })
    expect(supportApi.adminSetTicketStatus).toHaveBeenCalledWith('t-1', 'resolved')
    expect(supportApi.getTicketMessages).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Marquer .* résolu/ })).toBeNull()
  })

  it('« Marquer résolu » refusé par la base : c’est dit', async () => {
    supportApi.adminSetTicketStatus.mockResolvedValue({ error: { code: 'no_rows_affected', message: 'no_rows_affected' } })
    render(<SupportSection lang="fr" />)
    const resoudre = await screen.findByRole('button', { name: 'Marquer « Question sur le frigo » résolu' })
    await act(async () => { fireEvent.click(resoudre) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Rien n\'a été modifié')
  })

  it('ouvrir le ticket reste un seul bouton, au nom du ticket', async () => {
    render(<SupportSection lang="fr" />)
    const ouvrir = await screen.findByRole('button', { name: /^Question sur le frigo/ })
    await act(async () => { fireEvent.click(ouvrir) })
    expect(supportApi.getTicketMessages).toHaveBeenCalledWith('t-1')
  })
})

describe('Support — un message du ticket', () => {
  it('« Supprimer le message » existe sans survol (clavier, toucher)', async () => {
    supportApi.adminGetAllTickets.mockResolvedValue([{ id: 't-1', type: 'question', title: 'Question sur le frigo', status: 'open', created_at: '2026-10-01T10:00:00Z', username: 'bob' }])
    supportApi.getTicketMessages.mockResolvedValue({ messages: [{ id: 'm-1', ticket_id: 't-1', is_admin: false, content: 'Mon frigo est vide', created_at: '2026-10-01T10:00:00Z' }], error: null })
    render(<SupportSection lang="fr" />)
    const ouvrir = await screen.findByRole('button', { name: /^Question sur le frigo/ })
    await act(async () => { fireEvent.click(ouvrir) })
    await screen.findByText('Mon frigo est vide')
    expect(screen.getByRole('button', { name: 'Supprimer le message' })).toBeInTheDocument()
  })
})

describe('Journal — une ligne se déplie au clavier', () => {
  beforeEach(() => {
    adminApi.adminGetLogs.mockResolvedValue({ data: [
      { id: 'l-1', action: 'recipe_approved', user_id: 'a-1', username: 'antoine', target_id: 'r-1', target_type: 'recipe', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l-2', action: 'profile_data_viewed', user_id: 'a-1', username: 'antoine', target_id: null, target_type: null, created_at: '2026-10-01T09:00:00Z' },
    ], count: 2, error: null })
    adminApi.adminGetRecipesByIds.mockResolvedValue({ data: [{ id: 'r-1', title: 'Tarte aux poireaux', data: { emoji: '🥧' }, moderation_status: 'approved' }] })
    adminApi.adminGetUsersByIds.mockResolvedValue({ data: [] })
  })

  it('une ligne qui a un détail est un bouton qui dit s’il est déplié', async () => {
    render(<JournalSection lang="fr" />)
    const ligne = await screen.findByRole('button', { name: /Recette approuvée/ })
    expect(ligne).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(ligne)
    expect(ligne).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Tarte aux poireaux')).toBeInTheDocument()
  })

  it('une ligne sans détail n’est pas un bouton (rien à déplier)', async () => {
    render(<JournalSection lang="fr" />)
    await screen.findByText('Données du profil consultées')
    expect(screen.queryByRole('button', { name: /Données du profil consultées/ })).toBeNull()
  })
})

describe('Qualité — une ligne s’ouvre au clavier', () => {
  beforeEach(() => {
    adminApi.adminGetHealthChecks.mockResolvedValue({
      recipes: [{ id: 'r-9', name_fr: 'Gratin sans étapes', origin: 'official', issues: ['missing_steps'], updated_at: '2026-10-01T10:00:00Z' }],
      ingredients: [], totalRecipes: 1, totalIngredients: 0, error: null,
    })
  })

  it('avec un éditeur à ouvrir, la ligne est un bouton qui l’ouvre', async () => {
    const onEditRecipe = vi.fn()
    render(<DataQualitySection onEditRecipe={onEditRecipe} onEditIngredient={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Gratin sans étapes/ }))
    expect(onEditRecipe).toHaveBeenCalledWith('r-9', 'official')
  })

  it('sans éditeur, la ligne n’est pas un bouton (rien à ouvrir)', async () => {
    render(<DataQualitySection />)
    await screen.findByText('Gratin sans étapes')
    expect(screen.queryByRole('button', { name: /Gratin sans étapes/ })).toBeNull()
  })
})

describe('allergènes et régimes : des puces qu’on coche au clavier', () => {
  it('fiche d’ingrédient : une puce est un bouton qui dit si elle est cochée', () => {
    const setAllergens = vi.fn()
    const props = { defaultUnit: null, setDefaultUnit: vi.fn(), allergens: [], setAllergens, breaksDiets: [], setBreaksDiets: vi.fn(), nutrition: {}, setNutrition: vi.fn(), packSize: {}, setPackSize: vi.fn(), border: '#ccc', textColor: '#000', muted: '#666' }
    const { rerender } = render(<IngredientExtraFields {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Champs étendus/ }))
    const groupe = screen.getByRole('group', { name: /Allergènes/ })
    fireEvent.click(within(groupe).getByRole('button', { name: /Gluten/, pressed: false }))
    expect(setAllergens).toHaveBeenCalledWith(['gluten'])
    rerender(<IngredientExtraFields {...props} allergens={['gluten']} />)
    expect(within(groupe).getByRole('button', { name: /Gluten/, pressed: true })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: /Régimes incompatibles/ })).getByRole('button', { name: 'vegan', pressed: false })).toBeInTheDocument()
  })

  it('recette de base : allergènes et régimes se cochent et se décochent', () => {
    render(<BaseRecipeForm item={{ _isNew: true }} onSave={vi.fn()} onBack={vi.fn()} border="#ccc" textColor="#000" muted="#666" />)
    const regimes = screen.getByRole('group', { name: 'Régimes alimentaires' })
    const vegan = within(regimes).getByRole('button', { name: /Végan/, pressed: false })
    fireEvent.click(vegan)
    expect(vegan).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(vegan)
    expect(vegan).toHaveAttribute('aria-pressed', 'false')
    const allergenes = screen.getByRole('group', { name: 'Allergènes' })
    fireEvent.click(within(allergenes).getByRole('button', { name: /Gluten/, pressed: false }))
    expect(within(allergenes).getByRole('button', { name: /Gluten/, pressed: true })).toBeInTheDocument()
  })
})

describe('aucun bouton imbriqué dans les écrans corrigés', () => {
  it('journal et qualité, une fois chargés', async () => {
    adminApi.adminGetLogs.mockResolvedValue({ data: [{ id: 'l-1', action: 'recipe_approved', target_id: 'r-1', target_type: 'recipe', created_at: '2026-10-01T10:00:00Z' }], count: 1, error: null })
    adminApi.adminGetRecipesByIds.mockResolvedValue({ data: [{ id: 'r-1', title: 'Tarte', data: {} }] })
    adminApi.adminGetUsersByIds.mockResolvedValue({ data: [] })
    const { unmount } = render(<JournalSection lang="fr" />)
    await screen.findByRole('button', { name: /Recette approuvée/ })
    expect(imbriques()).toEqual([])
    unmount()

    adminApi.adminGetHealthChecks.mockResolvedValue({ recipes: [{ id: 'r-9', name_fr: 'Gratin', origin: 'community', issues: ['missing_steps'] }], ingredients: [], totalRecipes: 1, totalIngredients: 0, error: null })
    render(<DataQualitySection onEditRecipe={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Gratin/ })).toBeInTheDocument())
    expect(imbriques()).toEqual([])
  })
})
