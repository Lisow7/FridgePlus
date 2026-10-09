import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@features/support/api/support', () => ({
  getUserTickets: vi.fn().mockResolvedValue([{ id: 't1', title: 'Mon ticket', status: 'open', updated_at: '2026-01-01' }]),
  getTicketMessages: vi.fn().mockResolvedValue([{ id: 'm1', content: 'Bonjour', is_admin: false, created_at: '2026-01-01' }]),
  createTicket: vi.fn(), sendUserMessage: vi.fn(), markTicketReadByUser: vi.fn().mockResolvedValue(),
  deleteUserMessage: vi.fn().mockResolvedValue(), deleteUserTicket: vi.fn().mockResolvedValue(),
  updateTicketTitle: vi.fn(), searchBaseRecipes: vi.fn(), searchCommunityRecipes: vi.fn(),
  searchIngredients: vi.fn(), searchUsersForReport: vi.fn(),
}))
vi.mock('@shared/api/reports', () => ({ createReport: vi.fn() }))
vi.mock('@shared/hooks/use-moderation', () => ({ moderateContent: vi.fn() }))
vi.mock('@features/support/data/support-self-help', () => ({ getSelfHelp: () => [] }))

import SupportPanel from '@features/support/components/support-panel'

describe('SupportPanel — suppressions', () => {
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
