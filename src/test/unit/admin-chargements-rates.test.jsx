import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const communaute = vi.hoisted(() => ({
  adminListPosts: vi.fn(), adminListCommunityReports: vi.fn(), adminSoftDeletePost: vi.fn(),
  adminHardDeletePost: vi.fn(), adminMuteUser: vi.fn(), adminUnmuteUser: vi.fn(),
}))
const avis = vi.hoisted(() => ({
  adminListReviews: vi.fn(), adminListReviewReports: vi.fn(), adminSoftDeleteReview: vi.fn(), adminHardDeleteReview: vi.fn(),
}))
const support = vi.hoisted(() => ({
  adminGetAllTickets: vi.fn(), getTicketMessages: vi.fn(), markTicketReadByAdmin: vi.fn(), adminSetTicketStatus: vi.fn(),
  adminReplyTicket: vi.fn(), adminDeleteTicket: vi.fn(), adminDeleteMessage: vi.fn(), adminDeleteAnyMessage: vi.fn(),
}))
const admin = vi.hoisted(() => ({
  adminGetLogs: vi.fn(), adminGetRecipesByIds: vi.fn(), adminGetUsersByIds: vi.fn(),
  adminGetImportQueue: vi.fn(), adminPublishStaged: vi.fn(), adminRejectStaged: vi.fn(), adminBatchPublishValid: vi.fn(),
  adminReRunValidators: vi.fn(), adminGetImportMetrics: vi.fn(),
  adminGetRecipesByStatus: vi.fn(), adminSetRecipeStatus: vi.fn(), adminDeleteRecipe: vi.fn(),
  adminUpdateCommunityRecipe: vi.fn(), adminPromoteRecipeToBase: vi.fn(),
  adminGetUsers: vi.fn(), adminGetUserCounts: vi.fn(), adminToggleBan: vi.fn(), adminRevelerCompte: vi.fn(),
  adminGetUserProfile: vi.fn(), adminGrantSpecialAccess: vi.fn(), adminRevokeSpecialAccess: vi.fn(),
}))
const notifications = vi.hoisted(() => ({
  getAdminFeed: vi.fn(), adminDeleteNotification: vi.fn(), adminSendNotification: vi.fn(),
  sendAnnouncementPush: vi.fn(), getAdminFeedCounts: vi.fn(),
}))

vi.mock('@features/admin/api/community-admin', () => communaute)
vi.mock('@features/admin/api/recipe-reviews-admin', () => avis)
vi.mock('@features/support/api/support', () => support)
vi.mock('@features/admin/api/admin', () => admin)
vi.mock('@features/notifications/api/notifications', () => notifications)
vi.mock('@features/notifications/components/notifications-panel', () => ({ NotifItem: () => null }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => true }))
vi.mock('@features/admin/providers/admin-provider', () => ({
  useAdmin: () => ({ pendingCount: 0, setPendingCount: vi.fn(), refreshStats: vi.fn(), setSupportBadge: vi.fn() }),
}))
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: vi.fn() }) }))
vi.mock('@shared/contexts/data-provider', () => ({ useCountries: () => [], useIngredientsById: () => ({}), useAllergenTypes: () => [] }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => async () => true }))
vi.mock('@shared/ui/pagination', () => ({ default: () => null }))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-form-modal', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/moderation-reason-modal', () => ({ default: () => null }))

import CommunitySection from '@features/admin/components/sections/community-section'
import RecipeReviewsAdminSection from '@features/admin/components/sections/recipe-reviews-section'
import SupportSection from '@features/admin/components/sections/support-section'
import JournalSection from '@features/admin/components/sections/journal-section'
import NotificationsSection from '@features/admin/components/sections/notifications-section'
import ImportQueueTab from '@features/admin/components/sections/import-queue-tab'
import CustomRecipesSection from '@features/admin/components/sections/custom-recipes-section'
import UsersSection from '@features/admin/components/sections/users-section'
import ReportThread from '@features/admin/components/sections/report-thread'
import { fireEvent, waitFor } from '@testing-library/react'

// Audit du 2026-10-04, ADM-08 : un chargement raté s'affichait comme « aucune
// donnée » — « Aucun post », « Aucun ticket », « Aucune entrée » —, ce qui se
// lit « rien à modérer ». Deux écrans disaient en plus « Accès refusé. Vérifiez
// les policies RLS » pour N'IMPORTE quelle erreur, coupure réseau comprise.
const RESEAU = { message: 'Failed to fetch' }
const REFUS = { message: 'permission denied', code: '42501' }
// Lève À L'APPEL (pas de promesse rejetée) : sous Vitest 5, après un `mockReset`, une promesse
// rejetée par un simulacre est comptée comme non gérée même quand l'écran l'attrape.
const leve = (e) => () => { throw Object.assign(new Error(e.message), e.code ? { code: e.code } : {}) }

beforeEach(() => {
  for (const api of [communaute, avis, support, admin, notifications]) Object.values(api).forEach((m) => m.mockReset())
  admin.adminGetUserCounts.mockResolvedValue({ all: 0, active: 0, banned: 0, admins: 0 })
  admin.adminGetImportMetrics.mockResolvedValue({ error: null, metrics: null })
  notifications.getAdminFeedCounts.mockResolvedValue({ counts: {} })
})

async function attendreLEchec() {
  const alerte = await screen.findByRole('alert')
  expect(alerte).toHaveTextContent('Le chargement a échoué')
  return alerte
}

describe('un chargement raté se dit, au lieu de passer pour une liste vide', () => {
  it('Communauté', async () => {
    communaute.adminListPosts.mockImplementation(leve(RESEAU))
    communaute.adminListCommunityReports.mockResolvedValue([])
    render(<CommunitySection />)
    await attendreLEchec()
    expect(screen.queryByText('Aucun post pour ce filtre.')).toBeNull()
  })

  it('Avis', async () => {
    avis.adminListReviews.mockImplementation(leve(RESEAU))
    avis.adminListReviewReports.mockResolvedValue([])
    render(<RecipeReviewsAdminSection />)
    await attendreLEchec()
    expect(screen.queryByText('Aucun avis pour ce filtre.')).toBeNull()
  })

  it('Support', async () => {
    support.adminGetAllTickets.mockImplementation(leve(RESEAU))
    render(<SupportSection lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText(/Aucun ticket/)).toBeNull()
  })

  it('Journal', async () => {
    admin.adminGetLogs.mockResolvedValue({ data: null, count: null, error: RESEAU })
    render(<JournalSection lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText('Aucune entrée correspondante')).toBeNull()
  })

  it('Notifications', async () => {
    notifications.getAdminFeed.mockResolvedValue({ data: null, count: null, error: RESEAU })
    render(<NotificationsSection lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText('Aucun évènement récent')).toBeNull()
  })

  it('Support : les messages d’un ticket pas chargés — pas « Aucun message dans ce ticket »', async () => {
    support.adminGetAllTickets.mockResolvedValue([{ id: 't-1', user_id: 'u-2', type: 'question', title: 'Question sur le frigo', status: 'open', has_unread_admin: false, created_at: '2026-10-01T10:00:00Z' }])
    support.getTicketMessages.mockResolvedValue({ messages: [], error: RESEAU })
    render(<SupportSection lang="fr" />)
    ;(await screen.findByText('Question sur le frigo')).click()
    await attendreLEchec()
    expect(screen.queryByText('Aucun message dans ce ticket.')).toBeNull()
  })

  it('Signalements : le fil d’un signalement pas chargé — pas « soyez le premier à répondre »', async () => {
    support.getTicketMessages.mockResolvedValue({ messages: [], error: RESEAU })
    render(<ReportThread reportId="r-1" lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText(/soyez le premier à répondre/)).toBeNull()
  })

  it('Support : après une réponse, une relecture ratée garde le fil et le dit', async () => {
    support.adminGetAllTickets.mockResolvedValue([{ id: 't-1', user_id: 'u-2', type: 'question', title: 'Question sur le frigo', status: 'open', has_unread_admin: false, created_at: '2026-10-01T10:00:00Z' }])
    support.getTicketMessages.mockResolvedValueOnce({ messages: [{ id: 'm-1', is_admin: false, content: 'Mon frigo est vide', created_at: '2026-10-01T10:00:00Z' }], error: null })
    support.adminReplyTicket.mockResolvedValue({ error: null })
    render(<SupportSection lang="fr" />)
    ;(await screen.findByText('Question sur le frigo')).click()
    expect(await screen.findByText('Mon frigo est vide')).toBeInTheDocument()
    support.getTicketMessages.mockResolvedValueOnce({ messages: [], error: RESEAU })
    fireEvent.change(screen.getByLabelText('Votre réponse'), { target: { value: 'Bonjour' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await attendreLEchec()
    await waitFor(() => expect(screen.getByText('Mon frigo est vide')).toBeInTheDocument())
  })

  it('Métriques d’import : pas de zéros qui se liraient « file vide »', async () => {
    admin.adminGetImportQueue.mockResolvedValue({ data: [], count: 0, error: null })
    admin.adminGetImportMetrics.mockResolvedValue({ error: RESEAU, metrics: null })
    render(<ImportQueueTab />)
    await attendreLEchec()
  })

  it('File d’import', async () => {
    admin.adminGetImportQueue.mockResolvedValue({ data: null, count: null, error: RESEAU })
    render(<ImportQueueTab lang="fr" />)
    await attendreLEchec()
    expect(screen.queryByText(/Aucune entrée dans la file/)).toBeNull()
  })

  it('Recettes + : une coupure réseau n’est pas un « Accès refusé »', async () => {
    admin.adminGetRecipesByStatus.mockResolvedValue({ data: [], error: RESEAU })
    render(<CustomRecipesSection lang="fr" />)
    const alerte = await attendreLEchec()
    expect(alerte).toHaveTextContent('Failed to fetch')
    expect(screen.queryByText(/Accès refusé/)).toBeNull()
    expect(screen.queryByText(/Vérifiez les policies/)).toBeNull()
  })

  it('Utilisateurs : un vrai refus de droits (42501) est dit tel quel', async () => {
    admin.adminGetUsers.mockResolvedValue({ data: [], count: 0, error: REFUS })
    render(<UsersSection lang="fr" />)
    const alerte = await attendreLEchec()
    expect(alerte).toHaveTextContent('Accès refusé par la base.')
    expect(screen.queryByText(/Vérifiez les policies/)).toBeNull()
  })
})
