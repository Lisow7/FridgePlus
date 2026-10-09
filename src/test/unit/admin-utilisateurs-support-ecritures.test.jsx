import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const adminApi = vi.hoisted(() => ({
  adminGetUsers: vi.fn(), adminGetUserCounts: vi.fn(), adminRevelerCompte: vi.fn(),
  adminGetUserProfile: vi.fn(), adminGrantSpecialAccess: vi.fn(), adminRevokeSpecialAccess: vi.fn(),
}))
// Bannir passe par la base, avec motif et durée (lot 3c-3b) — plus par adminToggleBan.
const banApi = vi.hoisted(() => ({ adminBannir: vi.fn(), adminDebannir: vi.fn(), notifierLeBannissement: vi.fn() }))
const supportApi = vi.hoisted(() => ({
  adminGetAllTickets: vi.fn(), getTicketMessages: vi.fn(), markTicketReadByAdmin: vi.fn(),
  adminSetTicketStatus: vi.fn(), adminReplyTicket: vi.fn(), adminDeleteTicket: vi.fn(),
  adminDeleteMessage: vi.fn(), adminDeleteAnyMessage: vi.fn(),
}))
const annulation = vi.hoisted(() => ({ options: null }))
const admin = vi.hoisted(() => ({ setSupportBadge: vi.fn() }))

vi.mock('@features/admin/api/admin', () => adminApi)
vi.mock('@features/admin/api/bannissement', () => banApi)
vi.mock('@features/support/api/support', () => supportApi)
vi.mock('@shared/contexts/data-provider', () => ({ useAllergenTypes: () => [] }))
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: (o) => { annulation.options = o } }) }))
vi.mock('@features/admin/providers/admin-provider', () => ({ useAdmin: () => admin }))
vi.mock('@shared/ui/confirm-dialog/confirm-modals', () => ({
  ConfirmDeleteModal: ({ onConfirm }) => <button onClick={onConfirm}>confirmer-suppression</button>,
  ConfirmActionModal: ({ onConfirm }) => <button onClick={onConfirm}>confirmer-action</button>,
}))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
// La pagination lit la langue du `UIProvider` : sans rapport avec ce qu'on vérifie.
vi.mock('@shared/ui/pagination', () => ({ default: () => null }))

import UsersSection from '@features/admin/components/sections/users-section'
import SupportSection from '@features/admin/components/sections/support-section'

// Audit du 2026-10-04, ADM-02 : bannir, marquer un ticket « lu », supprimer un
// ticket ou un message — le résultat de l'écriture était jeté ; l'écran
// annonçait la chose faite même quand la base refusait.
const RIEN_TOUCHE = { code: 'no_rows_affected', message: 'no_rows_affected' }
const MESSAGE = 'Rien n\'a été modifié : l\'élément n\'existe plus, ou les droits ne le permettent pas.'

beforeEach(() => {
  Object.values(adminApi).forEach((m) => m.mockReset())
  Object.values(banApi).forEach((m) => m.mockReset())
  Object.values(supportApi).forEach((m) => m.mockReset())
  admin.setSupportBadge.mockReset()
  annulation.options = null
})

describe('Utilisateurs — bannir', () => {
  const BOB = { id: 'u-2', username: 'bob', role: 'user', banned: false, created_at: '2026-09-01T10:00:00Z' }

  beforeEach(() => {
    adminApi.adminGetUsers.mockResolvedValue({ data: [BOB], count: 1, error: null })
    adminApi.adminGetUserCounts.mockResolvedValue({ all: 1, active: 1, banned: 0, admins: 0 })
  })

  // Bannir ouvre la fenêtre « motif + durée » (lot 3c-3b) ; un refus de la
  // base est dit DANS la fenêtre, qui reste ouverte.
  async function bannirBob() {
    render(<UsersSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /^Bannir$/ }))
    fireEvent.change(screen.getByLabelText('Motif, montré à la personne'), { target: { value: 'Spam' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bannir 7 jours' })) })
  }

  it('la base refuse : c’est dit, dans la fenêtre', async () => {
    banApi.adminBannir.mockResolvedValue({ fin: null, error: { message: MESSAGE } })
    await bannirBob()
    expect(banApi.adminBannir).toHaveBeenCalledWith('u-2', 'Spam', 7)
    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGE)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('la base accepte : la fenêtre se ferme, l’e-mail part, c’est dit, et la liste est relue', async () => {
    banApi.adminBannir.mockResolvedValue({ fin: '2026-10-12T10:00:00+00:00', error: null })
    banApi.notifierLeBannissement.mockResolvedValue({ envoye: true })
    await bannirBob()
    await waitFor(() => expect(adminApi.adminGetUsers).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(banApi.notifierLeBannissement).toHaveBeenCalledWith('u-2')
    expect(screen.getByText(/bob est banni jusqu’au 12 octobre 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Un e-mail lui a dit le motif et la date/)).toBeInTheDocument()
  })

  it('l’e-mail ne part pas : le bannissement tient, et l’admin le sait', async () => {
    banApi.adminBannir.mockResolvedValue({ fin: '2026-10-12T10:00:00+00:00', error: null })
    banApi.notifierLeBannissement.mockResolvedValue({ envoye: false })
    await bannirBob()
    expect(await screen.findByText(/L’e-mail n’a pas pu partir/)).toBeInTheDocument()
  })

  it('débannir : une confirmation, par la base', async () => {
    adminApi.adminGetUsers.mockResolvedValue({ data: [{ ...BOB, banned: true }], count: 1, error: null })
    banApi.adminDebannir.mockResolvedValue({ error: null })
    render(<UsersSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /^Débannir$/ }))
    await act(async () => { fireEvent.click(screen.getByText('confirmer-action')) })
    expect(banApi.adminDebannir).toHaveBeenCalledWith('u-2')
  })
})

describe('Support — tickets et messages', () => {
  const TICKET = { id: 't-1', user_id: 'u-2', type: 'question', title: 'Question sur le frigo', status: 'open', has_unread_admin: true, has_unread_user: false, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', username: 'bob' }
  const MSG = { id: 'm-1', ticket_id: 't-1', sender_id: 'u-2', is_admin: false, content: 'Mon frigo est vide', created_at: '2026-10-01T10:00:00Z' }

  beforeEach(() => {
    supportApi.adminGetAllTickets.mockResolvedValue([TICKET])
    supportApi.getTicketMessages.mockResolvedValue({ messages: [MSG], error: null })
  })

  async function ouvrirLeTicket() {
    render(<SupportSection lang="fr" />)
    fireEvent.click(await screen.findByText('Question sur le frigo'))
    expect(await screen.findByText('Mon frigo est vide')).toBeInTheDocument()
  }

  it('« lu » refusé par la base : la pastille de l’admin ne baisse pas', async () => {
    supportApi.markTicketReadByAdmin.mockResolvedValue({ error: RIEN_TOUCHE })
    await ouvrirLeTicket()
    expect(supportApi.markTicketReadByAdmin).toHaveBeenCalledWith('t-1')
    expect(admin.setSupportBadge).not.toHaveBeenCalled()
  })

  it('« lu » accepté : la pastille baisse (témoin)', async () => {
    supportApi.markTicketReadByAdmin.mockResolvedValue({ error: null })
    await ouvrirLeTicket()
    await waitFor(() => expect(admin.setSupportBadge).toHaveBeenCalled())
  })

  it('supprimer le ticket, la base refuse : il revient dans la liste, et c’est dit', async () => {
    supportApi.markTicketReadByAdmin.mockResolvedValue({ error: null })
    supportApi.adminDeleteTicket.mockResolvedValue({ error: RIEN_TOUCHE })
    await ouvrirLeTicket()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le ticket' }))
    // Hors audit : depuis la vue détail, ce bouton n'ouvrait RIEN — la confirmation
    // n'était rendue que dans la vue liste (elle surgissait au retour à la liste).
    fireEvent.click(screen.getByText('confirmer-suppression'))
    expect(screen.queryByText('Question sur le frigo')).toBeNull()
    await act(() => annulation.options.onConfirm())
    expect(screen.getByText('Question sur le frigo')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE)
  })

  it('supprimer un message, la base refuse : il revient, et c’est dit', async () => {
    supportApi.markTicketReadByAdmin.mockResolvedValue({ error: null })
    supportApi.adminDeleteAnyMessage.mockResolvedValue({ error: RIEN_TOUCHE })
    await ouvrirLeTicket()
    fireEvent.mouseEnter(screen.getByText('Mon frigo est vide'))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le message' }))
    expect(screen.queryByText('Mon frigo est vide')).toBeNull()
    await act(() => annulation.options.onConfirm())
    expect(screen.getByText('Mon frigo est vide')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE)
  })

  it('supprimer un message, la base accepte : il est parti (témoin)', async () => {
    supportApi.markTicketReadByAdmin.mockResolvedValue({ error: null })
    supportApi.adminDeleteAnyMessage.mockResolvedValue({ error: null })
    await ouvrirLeTicket()
    fireEvent.mouseEnter(screen.getByText('Mon frigo est vide'))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le message' }))
    await act(() => annulation.options.onConfirm())
    expect(screen.queryByText('Mon frigo est vide')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
