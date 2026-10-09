import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const api = vi.hoisted(() => ({ adminGetLogs: vi.fn() }))
vi.mock('@features/admin/api/admin', () => api)
vi.mock('@features/admin/providers/admin-provider', () => ({
  useAdmin: () => ({ stats: {}, statsLoading: false, statsError: null, refreshStats: vi.fn(), setSection: vi.fn(), pendingCount: 0, supportBadge: 0, healthCount: 0, reportsCount: 0 }),
}))
vi.mock('@features/admin/components/shared/analytics-chart', () => ({ default: () => null }))

import Dashboard from '@features/admin/components/dashboard'

// Audit du 2026-10-04, ADM-06 : le tableau de bord avait sa propre table de
// noms, qui ne connaissait pas les actions réellement écrites en base — ni
// les bascules de fonctionnalités ni les notifications envoyées — et appelait
// « supprimé » ce que le journal appelait « masqué ». Il lit désormais le même
// module que le journal.
describe('tableau de bord — l’activité récente a les noms du journal', () => {
  it('nomme les actions réelles, avec les mots du journal', async () => {
    const ligne = (id, action) => ({ id, action, user_id: null, target_id: 'x', target_type: 'user', created_at: '2026-10-08T03:30:00Z' })
    api.adminGetLogs.mockResolvedValue({
      data: [ligne('1', 'notification_sent'), ligne('2', 'feature_flag_toggled'), ligne('3', 'community_post_deleted')],
      count: 3, error: null,
    })
    render(<Dashboard lang="fr" />)
    expect(await screen.findByText('Notification envoyée')).toBeInTheDocument()
    expect(screen.getByText('Fonctionnalité basculée')).toBeInTheDocument()
    expect(screen.getByText('Post communauté masqué')).toBeInTheDocument()
  })
})
