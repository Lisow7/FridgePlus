import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

// Audit du 2026-10-04, lot 12k-2 — ADM-12 (3, 4) et ADM-17 (4, 5, 7) :
//   • l'onglet Qualité retéléchargeait les deux vues de santé toutes les cinq
//     minutes, onglet du navigateur masqué ou sous-onglet Import affiché ;
//   • le tableau de bord chargeait cinquante lignes de journal, avec un
//     comptage exact et une lecture des profils, pour en montrer dix ;
//   • la file d'import : la confirmation de publication en lot ne disait pas
//     combien de recettes partaient, les échecs n'étaient que comptés, le
//     rejet passait par `window.prompt` (un motif vide devenait « no reason »),
//     et la page 0 était la seule page.

const adminApi = vi.hoisted(() => ({
  adminGetHealthChecks: vi.fn(), adminGetLogs: vi.fn(), adminGetImportQueue: vi.fn(),
  adminPublishStaged: vi.fn(), adminRejectStaged: vi.fn(), adminBatchPublishValid: vi.fn(), adminReRunValidators: vi.fn(),
}))
const confirmMock = vi.hoisted(() => vi.fn())
vi.mock('@features/admin/api/admin', () => adminApi)
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => confirmMock }))
vi.mock('@features/admin/components/sections/import-metrics', () => ({ default: () => null }))
vi.mock('@features/admin/components/shared/analytics-chart', () => ({ default: () => null }))
vi.mock('@features/admin/providers/admin-provider', () => ({
  useAdmin: () => ({ stats: {}, statsLoading: false, statsError: null, refreshStats: vi.fn(), setSection: vi.fn(), pendingCount: 0, supportBadge: 0, healthCount: 0, reportsCount: 0 }),
}))
vi.mock('@shared/ui/pagination', () => ({
  default: ({ page, totalPages, onPageChange }) => <button onClick={() => onPageChange(page + 1)}>page-suivante ({totalPages})</button>,
}))

import DataQualitySection from '@features/admin/components/sections/data-quality-section'
import ImportQueueTab from '@features/admin/components/sections/import-queue-tab'
import Dashboard from '@features/admin/components/dashboard'

const SANTE = { recipes: [], ingredients: [], totalRecipes: 10, totalIngredients: 10, error: null }
const CINQ_MINUTES = 5 * 60 * 1000

function visibilite(etat) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => etat })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  Object.values(adminApi).forEach((m) => m.mockReset())
  confirmMock.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

describe('Qualité — le rafraîchissement automatique ne tourne que si quelqu’un regarde', () => {
  it('onglet du navigateur masqué : rien ne part ; de retour, une lecture rattrape le retard ; sous-onglet Import : rien', async () => {
    vi.useFakeTimers()
    adminApi.adminGetHealthChecks.mockResolvedValue(SANTE)
    render(<DataQualitySection />)
    await act(async () => {})
    expect(adminApi.adminGetHealthChecks).toHaveBeenCalledTimes(1)

    act(() => visibilite('hidden'))
    await act(async () => { vi.advanceTimersByTime(CINQ_MINUTES + 1000) })
    expect(adminApi.adminGetHealthChecks).toHaveBeenCalledTimes(1)

    await act(async () => visibilite('visible'))
    expect(adminApi.adminGetHealthChecks).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: /import/i }))
    await act(async () => { vi.advanceTimersByTime(CINQ_MINUTES + 1000) })
    expect(adminApi.adminGetHealthChecks).toHaveBeenCalledTimes(2)
  })
})

describe('Tableau de bord — dix lignes de journal, pas cinquante', () => {
  it('demande dix lignes, sans comptage exact', async () => {
    adminApi.adminGetLogs.mockResolvedValue({ data: [], count: 0, error: null })
    render(<Dashboard lang="fr" />)
    await waitFor(() => expect(adminApi.adminGetLogs).toHaveBeenCalled())
    expect(adminApi.adminGetLogs).toHaveBeenCalledWith(0, expect.objectContaining({ limite: 10, compter: false }))
  })
})

describe('File d’import — ce que l’admin fait se dit en nombre, en motif et en pages', () => {
  const LIGNE = { id: 'row1', status: 'valid', batch_id: 'lot-2026-07', parsed_data: { name: { fr: 'Ma recette' } }, errors: [] }

  beforeEach(() => {
    adminApi.adminGetImportQueue.mockImplementation(async (opts = {}) => (
      opts.pageSize === 1 ? { data: [], count: 3, error: null } : { data: [LIGNE], count: 120, error: null }
    ))
    adminApi.adminBatchPublishValid.mockResolvedValue({ published: 1, failed: [{ stagingId: 'row9', error: 'boom' }], error: null })
    adminApi.adminRejectStaged.mockResolvedValue({ error: null })
  })

  it('publier le lot : la confirmation dit combien de recettes partent, et le résultat nomme les échecs', async () => {
    confirmMock.mockResolvedValue(true)
    render(<ImportQueueTab />)
    await waitFor(() => screen.getByText('Ma recette'))
    fireEvent.change(screen.getByDisplayValue('Tous batches'), { target: { value: 'lot-2026-07' } })
    await act(async () => { fireEvent.click(screen.getByText('Publier tous valides du batch')) })
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Publier les 3 recettes valides du batch "lot-2026-07" ?' })))
    expect(await screen.findByText(/1 publiée/)).toBeInTheDocument()
    expect(screen.getByText(/1 échec/)).toHaveTextContent(/row9/)
    expect(screen.getByText(/1 échec/)).toHaveTextContent(/boom/)
  })

  it('rejeter : une vraie fenêtre, un motif obligatoire, jamais window.prompt', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('jamais')
    render(<ImportQueueTab />)
    await waitFor(() => screen.getByText('Ma recette'))
    fireEvent.click(screen.getByText('Rejeter'))
    const fenetre = await screen.findByRole('dialog')
    expect(fenetre).toBeInTheDocument()
    const confirmer = screen.getByRole('button', { name: 'Rejeter la recette' })
    expect(confirmer).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Motif du rejet/), { target: { value: '   ' } })
    expect(confirmer).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Motif du rejet/), { target: { value: 'Doublon de la carbonara' } })
    await act(async () => { fireEvent.click(confirmer) })
    expect(adminApi.adminRejectStaged).toHaveBeenCalledWith('row1', 'Doublon de la carbonara')
    expect(prompt).not.toHaveBeenCalled()
    prompt.mockRestore()
  })

  it('120 entrées : des pages, et la page suivante relit la file', async () => {
    render(<ImportQueueTab />)
    await waitFor(() => screen.getByText('Ma recette'))
    fireEvent.click(screen.getByText(/page-suivante \(3\)/))
    await waitFor(() => expect(adminApi.adminGetImportQueue).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })))
  })
})
