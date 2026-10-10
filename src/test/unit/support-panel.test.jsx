import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
const tickets = vi.hoisted(() => ({ liste: [{ id: 't1', title: 'Mon ticket', status: 'open', updated_at: '2026-01-01' }] }))
const supprimerTicket = vi.hoisted(() => vi.fn())
const supprimerMessage = vi.hoisted(() => vi.fn())
vi.mock('@features/support/api/support', () => ({
  getUserTickets: vi.fn(() => Promise.resolve(tickets.liste)),
  getTicketMessages: vi.fn().mockResolvedValue({ messages: [{ id: 'm1', content: 'Bonjour', is_admin: false, created_at: '2026-01-01' }], error: null }),
  createTicket: vi.fn(), sendUserMessage: vi.fn(), markTicketReadByUser: vi.fn().mockResolvedValue({ error: null }),
  deleteUserMessage: (...a) => supprimerMessage(...a), deleteUserTicket: (...a) => supprimerTicket(...a),
  updateTicketTitle: vi.fn(), searchBaseRecipes: vi.fn(), searchCommunityRecipes: vi.fn(),
  searchIngredients: vi.fn(), searchUsersForReport: vi.fn(),
}))
vi.mock('@shared/api/reports', () => ({ createReport: vi.fn() }))
vi.mock('@shared/api/moderation-de-contenu', () => ({ moderateContent: vi.fn() }))
vi.mock('@features/support/data/support-self-help', () => ({ getSelfHelp: () => [] }))

import SupportPanel from '@features/support/components/support-panel'

describe('SupportPanel — suppressions', () => {
  beforeEach(() => {
    tickets.liste = [{ id: 't1', title: 'Mon ticket', status: 'open', updated_at: '2026-01-01' }]
    supprimerTicket.mockReset(); supprimerTicket.mockResolvedValue({ error: null })
    supprimerMessage.mockReset(); supprimerMessage.mockResolvedValue({ error: null })
  })

  // Trouvé le 2026-10-05 : l'erreur d'une suppression refusée n'était affichée
  // que dans le pied d'un ticket ouvert. Depuis la liste, un refus ne se
  // voyait pas — le ticket restait, sans un mot.
  it('supprimer un ticket refusé depuis la liste : le ticket reste, et une alerte le dit', async () => {
    confirmMock.mockResolvedValue(true)
    supprimerTicket.mockResolvedValue({ error: { code: 'no_rows_affected' } })
    render(<SupportPanel userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Mon ticket'))
    fireEvent.click(screen.getByTitle('Supprimer le ticket'))
    expect(await screen.findByRole('alert')).toHaveTextContent('L\'opération a échoué. Rien n\'a été modifié.')
    expect(screen.getByText('Mon ticket')).toBeInTheDocument()
  })

  // Audit du 2026-10-04, A11Y-07 : le titre en cours de modification était un
  // champ sans aucun nom (« zone de texte », sans dire laquelle).
  it('le titre en cours de modification est un champ nommé', async () => {
    render(<SupportPanel userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Mon ticket'))
    fireEvent.click(screen.getByText('Mon ticket'))
    await waitFor(() => screen.getByText('Bonjour'))
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le titre' }))
    expect(screen.getByRole('textbox', { name: 'Titre de la demande' })).toHaveValue('Mon ticket')
  })

  // A11Y-07 (2e partie) : la réponse n'était nommée que par son placeholder.
  it('la zone de réponse est nommée', async () => {
    render(<SupportPanel userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Mon ticket'))
    fireEvent.click(screen.getByText('Mon ticket'))
    await waitFor(() => screen.getByText('Bonjour'))
    expect(screen.getByRole('textbox', { name: 'Ta réponse au support' })).toBeInTheDocument()
  })

  it('supprimer un message refusé sur un ticket RÉSOLU : une alerte le dit aussi', async () => {
    tickets.liste = [{ id: 't1', title: 'Mon ticket', status: 'resolved', updated_at: '2026-01-01' }]
    confirmMock.mockResolvedValue(true)
    supprimerMessage.mockResolvedValue({ error: { code: 'no_rows_affected' } })
    render(<SupportPanel userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Mon ticket'))
    fireEvent.click(screen.getByText('Mon ticket'))
    await waitFor(() => screen.getByText('Bonjour'))
    fireEvent.mouseEnter(screen.getByText('Bonjour').closest('div'))
    fireEvent.click(screen.getByTitle('Supprimer le message'))
    expect(await screen.findByRole('alert')).toHaveTextContent('L\'opération a échoué. Rien n\'a été modifié.')
    expect(screen.getByText('Bonjour')).toBeInTheDocument()
  })

  it('supprimer un ticket appelle useConfirm() (danger)', async () => {
    confirmMock.mockResolvedValue(false)
    render(<SupportPanel userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Mon ticket'))
    fireEvent.click(screen.getByTitle('Supprimer le ticket'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Supprimer ce ticket définitivement ? Cette action est irréversible.',
      danger: true,
    })))
  })

  it('supprimer un message appelle useConfirm() (danger)', async () => {
    confirmMock.mockResolvedValue(false)
    render(<SupportPanel userId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Mon ticket'))
    fireEvent.click(screen.getByText('Mon ticket'))
    await waitFor(() => screen.getByText('Bonjour'))
    fireEvent.mouseEnter(screen.getByText('Bonjour').closest('div'))
    fireEvent.click(screen.getByTitle('Supprimer le message'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Supprimer ce message définitivement ?',
      danger: true,
    })))
  })
})
