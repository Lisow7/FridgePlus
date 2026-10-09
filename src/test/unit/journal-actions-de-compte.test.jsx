import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const admin = vi.hoisted(() => ({ adminGetLogs: vi.fn(), adminGetRecipesByIds: vi.fn(), adminGetUsersByIds: vi.fn() }))
vi.mock('@features/admin/api/admin', () => admin)
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))

import JournalSection from '@features/admin/components/sections/journal-section'

// Relecture du 2026-10-08 : les tâches nocturnes sur les comptes écrivent leurs
// échecs au journal (migration `echecs_des_taches_au_journal`). Encore faut-il
// que l'onglet Journal les nomme : une action inconnue n'y apparaissait que
// sous son nom brut, et seulement dans « Tous ».

describe('journal admin — les actions des tâches de comptes ont un nom', () => {
  it('anonymisation faite, anonymisation impossible, compte non confirmé gardé', async () => {
    const ligne = (id, action) => ({ id, action, user_id: null, target_id: 'u-x', target_type: 'user', created_at: '2026-10-08T03:30:00Z' })
    admin.adminGetLogs.mockResolvedValue({
      data: [ligne('1', 'account_anonymized'), ligne('2', 'account_anonymization_failed'), ligne('3', 'unconfirmed_account_kept')],
      count: 3, error: null,
    })
    admin.adminGetRecipesByIds.mockResolvedValue({ data: [] })
    admin.adminGetUsersByIds.mockResolvedValue({ data: [] })
    render(<JournalSection lang="fr" />)
    expect(await screen.findByText('Compte anonymisé')).toBeInTheDocument()
    expect(screen.getByText('Anonymisation impossible')).toBeInTheDocument()
    expect(screen.getByText('Compte non confirmé gardé')).toBeInTheDocument()
  })

  // Lot 12b (ADM-06) : les actions RÉELLEMENT présentes en base n'avaient aucun
  // nom (`profile_data_viewed` ×77, `notification_sent`…), et une action
  // inconnue n'apparaissait que sous « Tous », faute de pastille « Autres ».
  it('les actions écrites en base ont un nom ; une action inconnue se range sous « Autres »', async () => {
    const ligne = (id, action) => ({ id, action, user_id: null, target_id: 'x', target_type: 'user', created_at: '2026-10-08T03:30:00Z' })
    // Le filtre part à la base (lot 12h, ADM-10) : « Autres » demande tout SAUF
    // les actions qui ont un nom ; la base simulée répond en conséquence.
    admin.adminGetLogs.mockImplementation(async (_page, filtres = {}) => (filtres.saufActions
      ? { data: [ligne('3', 'action_venue_d_ailleurs')], count: 1, error: null }
      : { data: [ligne('1', 'profile_data_viewed'), ligne('2', 'notification_sent'), ligne('3', 'action_venue_d_ailleurs')], count: 3, error: null }))
    admin.adminGetRecipesByIds.mockResolvedValue({ data: [] })
    admin.adminGetUsersByIds.mockResolvedValue({ data: [] })
    render(<JournalSection lang="fr" />)
    expect(await screen.findByText('Données du profil consultées')).toBeInTheDocument()
    expect(screen.getByText('Notification envoyée')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Autres/ }))
    expect(await screen.findByText('action_venue_d_ailleurs')).toBeInTheDocument()
    expect(screen.queryByText('Notification envoyée')).not.toBeInTheDocument()
    const { saufActions } = admin.adminGetLogs.mock.calls.at(-1)[1]
    expect(saufActions).toContain('notification_sent')
    expect(saufActions).not.toContain('action_venue_d_ailleurs')
  })

  // Lot 12a (ADM-04) : la base écrit chaque bascule d'une fonctionnalité
  // (migration `bascules_au_journal`).
  it('une fonctionnalité basculée a son nom', async () => {
    admin.adminGetLogs.mockResolvedValue({
      data: [{ id: '4', action: 'feature_flag_toggled', user_id: null, target_id: 'receipt_scan', target_type: 'feature_flag', metadata: { enabled: false }, created_at: '2026-10-08T03:40:00Z' }],
      count: 1, error: null,
    })
    admin.adminGetRecipesByIds.mockResolvedValue({ data: [] })
    admin.adminGetUsersByIds.mockResolvedValue({ data: [] })
    render(<JournalSection lang="fr" />)
    expect(await screen.findByText('Fonctionnalité basculée')).toBeInTheDocument()
  })
})
