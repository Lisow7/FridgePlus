import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

// Audit du 2026-10-04, lot 12k-1 — ADM-14 (course à l'ouverture d'un ticket,
// statut qui échoue en silence, e-mail au membre dont l'échec n'est jamais vu
// et qui partait dans la langue de l'admin) et ADM-29 (double clic sur
// « Débannir » : deux écritures).

const adminApi = vi.hoisted(() => ({
  adminGetUsers: vi.fn(), adminGetUserCounts: vi.fn(), adminRevelerCompte: vi.fn(),
  adminGetUserProfile: vi.fn(), adminGrantSpecialAccess: vi.fn(), adminRevokeSpecialAccess: vi.fn(),
}))
const banApi = vi.hoisted(() => ({ adminBannir: vi.fn(), adminDebannir: vi.fn(), notifierLeBannissement: vi.fn() }))
const supportApi = vi.hoisted(() => ({
  adminGetAllTickets: vi.fn(), getTicketMessages: vi.fn(), markTicketReadByAdmin: vi.fn(),
  adminSetTicketStatus: vi.fn(), adminReplyTicket: vi.fn(), adminDeleteTicket: vi.fn(),
  adminDeleteMessage: vi.fn(), adminDeleteAnyMessage: vi.fn(),
}))
const admin = vi.hoisted(() => ({ setSupportBadge: vi.fn() }))

vi.mock('@features/admin/api/admin', () => adminApi)
vi.mock('@features/admin/api/bannissement', () => banApi)
vi.mock('@features/support/api/support', () => supportApi)
vi.mock('@shared/contexts/data-provider', () => ({ useAllergenTypes: () => [] }))
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: () => {} }) }))
vi.mock('@features/admin/providers/admin-provider', () => ({ useAdmin: () => admin }))
vi.mock('@shared/ui/confirm-dialog/confirm-modals', () => ({
  ConfirmDeleteModal: ({ onConfirm }) => <button onClick={onConfirm}>confirmer-suppression</button>,
  ConfirmActionModal: ({ onConfirm, busy }) => <button onClick={onConfirm} disabled={busy}>confirmer-action</button>,
}))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@shared/ui/pagination', () => ({ default: () => null }))

import UsersSection from '@features/admin/components/sections/users-section'
import SupportSection from '@features/admin/components/sections/support-section'

const differe = () => { let resoudre; const promesse = new Promise((r) => { resoudre = r }); return { promesse, resoudre } }
const TICKET_A = { id: 't-1', user_id: 'u-2', type: 'question', title: 'Question sur le frigo', status: 'open', has_unread_admin: false, has_unread_user: false, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', username: 'bob', language: 'en' }
const TICKET_B = { ...TICKET_A, id: 't-2', title: 'Autre question', username: 'alice', language: 'fr' }
const msg = (id, ticket, content) => ({ id, ticket_id: ticket, sender_id: 'u-2', is_admin: false, content, created_at: '2026-10-01T10:00:00Z' })

beforeEach(() => {
  Object.values(adminApi).forEach((m) => m.mockReset())
  Object.values(banApi).forEach((m) => m.mockReset())
  Object.values(supportApi).forEach((m) => m.mockReset())
  admin.setSupportBadge.mockReset()
  supportApi.adminGetAllTickets.mockResolvedValue([TICKET_A, TICKET_B])
  supportApi.markTicketReadByAdmin.mockResolvedValue({ error: null })
})

describe('Support — ouvrir un ticket pendant que le précédent charge encore', () => {
  it('les messages du premier, arrivés après, ne s’affichent pas sous l’en-tête du second', async () => {
    const a = differe(); const b = differe()
    supportApi.getTicketMessages.mockImplementation((id) => (id === 't-1' ? a.promesse : b.promesse))
    render(<SupportSection lang="fr" />)
    // Ouvrir A (ses messages tardent), revenir à la liste, ouvrir B.
    fireEvent.click(await screen.findByText('Question sur le frigo'))
    fireEvent.click(screen.getByRole('button', { name: /Retour/ }))
    fireEvent.click(await screen.findByText('Autre question'))
    await act(async () => { b.resoudre({ messages: [msg('m-2', 't-2', 'Message d’Alice')], error: null }) })
    expect(await screen.findByText('Message d’Alice')).toBeInTheDocument()
    await act(async () => { a.resoudre({ messages: [msg('m-1', 't-1', 'Message de Bob, en retard')], error: null }) })
    expect(screen.queryByText('Message de Bob, en retard')).toBeNull()
    expect(screen.getByText('Message d’Alice')).toBeInTheDocument()
  })
})

describe('Support — ce que l’admin fait sur un ticket se dit', () => {
  beforeEach(() => {
    supportApi.getTicketMessages.mockResolvedValue({ messages: [msg('m-1', 't-1', 'Mon frigo est vide')], error: null })
  })

  async function ouvrirLeTicketDeBob() {
    render(<SupportSection lang="fr" />)
    fireEvent.click(await screen.findByText('Question sur le frigo'))
    expect(await screen.findByText('Mon frigo est vide')).toBeInTheDocument()
  }

  it('changer le statut, la base refuse : c’est dit, et le statut ne bouge pas', async () => {
    supportApi.adminSetTicketStatus.mockResolvedValue({ error: { code: 'no_rows_affected', message: 'no_rows_affected' } })
    await ouvrirLeTicketDeBob()
    const autreStatut = screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'false')
    await act(async () => { fireEvent.click(autreStatut) })
    expect(await screen.findByRole('alert')).toHaveTextContent(/Rien n’a été modifié|Rien n'a été modifié/)
    expect(autreStatut).toHaveAttribute('aria-pressed', 'false')
  })

  it('répondre : la réponse part dans la langue du membre, pas celle de l’admin', async () => {
    supportApi.adminReplyTicket.mockResolvedValue({ error: null, emailError: null })
    await ouvrirLeTicketDeBob()
    fireEvent.change(screen.getByLabelText(/Votre réponse/), { target: { value: 'Fixed, thanks!' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Envoyer' })) })
    expect(supportApi.adminReplyTicket).toHaveBeenCalledWith('t-1', null, 'Fixed, thanks!', 'en')
  })

  it('répondre : la réponse est enregistrée mais l’e-mail n’est pas parti — l’admin le sait', async () => {
    supportApi.adminReplyTicket.mockResolvedValue({ error: null, emailError: { message: 'Failed to fetch' } })
    await ouvrirLeTicketDeBob()
    fireEvent.change(screen.getByLabelText(/Votre réponse/), { target: { value: 'Corrigé.' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Envoyer' })) })
    expect(await screen.findByRole('alert')).toHaveTextContent(/e-mail/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/n’est pas parti|n'est pas parti/)
  })
})

describe('Utilisateurs — débannir ne s’écrit qu’une fois', () => {
  it('deux clics sur la confirmation pendant l’écriture : une seule écriture', async () => {
    adminApi.adminGetUsers.mockResolvedValue({ data: [{ id: 'u-2', username: 'bob', role: 'user', banned: true, created_at: '2026-09-01T10:00:00Z' }], count: 1, error: null })
    adminApi.adminGetUserCounts.mockResolvedValue({ all: 1, active: 0, banned: 1, admins: 0 })
    const ecriture = differe()
    banApi.adminDebannir.mockReturnValue(ecriture.promesse)
    render(<UsersSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /^Débannir$/ }))
    const confirmer = screen.getByText('confirmer-action')
    fireEvent.click(confirmer)
    fireEvent.click(confirmer)
    await act(async () => { ecriture.resoudre({ error: null }) })
    await waitFor(() => expect(banApi.adminDebannir).toHaveBeenCalledTimes(1))
  })
})
