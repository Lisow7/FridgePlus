import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@features/support/api/support', () => ({
  getUserTickets:         vi.fn().mockResolvedValue([]),
  getTicketMessages:      vi.fn().mockResolvedValue([]),
  createTicket:           vi.fn().mockResolvedValue({ data: { id: 'ticket-1' }, error: null }),
  sendUserMessage:        vi.fn().mockResolvedValue({ error: null }),
  markTicketReadByUser:   vi.fn().mockResolvedValue(undefined),
  deleteUserMessage:      vi.fn().mockResolvedValue(undefined),
  deleteUserTicket:       vi.fn().mockResolvedValue(undefined),
  updateTicketTitle:      vi.fn().mockResolvedValue(undefined),
  searchBaseRecipes:      vi.fn().mockResolvedValue([]),
  searchCommunityRecipes: vi.fn().mockResolvedValue([]),
  searchIngredients:      vi.fn().mockResolvedValue([]),
  searchUsersForReport:   vi.fn().mockResolvedValue([]),
}))

vi.mock('../../lib/db/reports', () => ({
  createReport: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))

import SupportPanel from '@features/support/components/support-panel'
import * as supportDb from '@features/support/api/support'

const defaultProps = {
  userId: 'user-123',
  lang: 'fr',
  darkMode: false,
  onClose: vi.fn(),
  onUnreadChange: vi.fn(),
}

// Ouvre le formulaire libre (catégorie "Question générale", flow='free').
// Flux : Nouvelle demande → sélection catégorie → aide rapide → formulaire.
// "Question générale" propose une étape d'aide rapide (self-service v0.70) ;
// on la traverse via "J'ai toujours besoin d'aide".
async function openNewTicketForm() {
  const user = userEvent.setup()
  render(<SupportPanel {...defaultProps} />)
  await user.click(screen.getByText('Nouvelle demande'))           // → vue cat
  await user.click(screen.getByText('Question générale'))          // → vue help
  await user.click(screen.getByRole('button', { name: 'J\'ai toujours besoin d\'aide' })) // → vue form
  return user
}

describe('SupportPanel — formulaire nouveau ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supportDb.getUserTickets.mockResolvedValue([])
    supportDb.createTicket.mockResolvedValue({ data: { id: 'ticket-1' }, error: null })
  })

  it('affiche "Aucun ticket" par défaut', async () => {
    render(<SupportPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByText(/aucun ticket/i)).toBeInTheDocument())
  })

  it('affiche le bouton Nouvelle demande', () => {
    render(<SupportPanel {...defaultProps} />)
    expect(screen.getByText('Nouvelle demande')).toBeInTheDocument()
  })

  it('ouvre le formulaire au clic sur Nouvelle demande + sélection catégorie', async () => {
    await openNewTicketForm()
    expect(screen.getByPlaceholderText('Résume ta demande en quelques mots')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Détaille ta demande…')).toBeInTheDocument()
  })

  // TODO v3.x — le sélecteur de type (Question/Signalement/Demande) est remplacé par
  // un flux guidé par catégorie. L'étape "sélectionner un type" n'existe plus.
  it.skip('erreur si type non sélectionné', async () => {})

  it('erreur si titre vide', async () => {
    const user = await openNewTicketForm()
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.getByText('Écris un objet.')).toBeInTheDocument()
  })

  it('erreur si titre contient uniquement des espaces', async () => {
    const user = await openNewTicketForm()
    await user.type(screen.getByPlaceholderText('Résume ta demande en quelques mots'), '   ')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.getByText('Écris un objet.')).toBeInTheDocument()
  })

  it('erreur si message vide', async () => {
    const user = await openNewTicketForm()
    await user.type(screen.getByPlaceholderText('Résume ta demande en quelques mots'), 'Mon sujet')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))
    expect(screen.getByText('Écris un message.')).toBeInTheDocument()
  })

  it('erreur max tickets si limite atteinte', async () => {
    supportDb.createTicket.mockResolvedValue({ data: null, error: { message: 'max_tickets_reached' } })
    const user = await openNewTicketForm()
    await user.type(screen.getByPlaceholderText('Résume ta demande en quelques mots'), 'Sujet')
    await user.type(screen.getByPlaceholderText('Détaille ta demande…'), 'Description complète')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() =>
      expect(screen.getByText('Limite de 3 tickets ouverts atteinte.')).toBeInTheDocument()
    )
  })

  it('soumission valide appelle createTicket avec les bons params', async () => {
    supportDb.getUserTickets.mockResolvedValue([
      { id: 'ticket-1', type: 'question', title: 'Sujet', status: 'open', has_unread_user: false, created_at: new Date().toISOString() },
    ])
    const user = await openNewTicketForm()
    await user.type(screen.getByPlaceholderText('Résume ta demande en quelques mots'), 'Mon sujet de test')
    await user.type(screen.getByPlaceholderText('Détaille ta demande…'), 'Ma description complète')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() =>
      expect(supportDb.createTicket).toHaveBeenCalledWith('user-123', {
        type: 'question',
        title: 'Mon sujet de test',
        message: 'Ma description complète',
      })
    )
  })

  it('les catégories de contact sont disponibles après clic Nouvelle demande', async () => {
    const user = userEvent.setup()
    render(<SupportPanel {...defaultProps} />)
    await user.click(screen.getByText('Nouvelle demande'))
    expect(screen.getByText('Question générale')).toBeInTheDocument()
    expect(screen.getByText('Suggestion ou idée')).toBeInTheDocument()
    expect(screen.getByText('Recette officielle')).toBeInTheDocument()
  })
})
