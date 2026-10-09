import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const loadRecentCookingLogs = vi.hoisted(() => vi.fn())
const loadAllCookingLogs = vi.hoisted(() => vi.fn())
const loadCookingLogsCount = vi.hoisted(() => vi.fn())

vi.mock('@shared/api/cooking-logs', () => ({ loadRecentCookingLogs, loadAllCookingLogs, loadCookingLogsCount }))
vi.mock('@shared/api/community', () => ({ getCommunityTermsAcceptedAt: vi.fn().mockResolvedValue(null) }))
const session = vi.hoisted(() => ({ user: { id: 'u1' } }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: session.user }) }))

import { useProfileState } from '@features/profile/hooks/use-profile-state'

// Audit du 2026-10-04, CPT-11. Les onglets Activité et Récompenses tirent leurs
// données d'ici. L'API rendait une liste vide sur erreur : « pas chargé » et
// « jamais cuisiné » donnaient le même écran (« Aucune statistique pour
// l'instant »), et la personne croyait avoir perdu son historique.
const LOG = { id: 'l1', recipe_id: 'r1', recipe_source: 'base', servings: 2, cooked_at: '2026-05-10T10:00:00Z' }
const PANNE = { message: 'Failed to fetch' }
const monter = () => renderHook(() => useProfileState({ enableJournal: true, enableStats: true }))

describe('useProfileState — journal et statistiques', () => {
  beforeEach(() => {
    session.user = { id: 'u1' }
    loadRecentCookingLogs.mockReset(); loadRecentCookingLogs.mockResolvedValue({ logs: [LOG], error: null })
    loadCookingLogsCount.mockReset(); loadCookingLogsCount.mockResolvedValue({ count: 1, error: null })
    loadAllCookingLogs.mockReset(); loadAllCookingLogs.mockResolvedValue({ logs: [LOG], error: null })
  })

  it('pendant le chargement : `null` (ni vide, ni erreur)', () => {
    loadRecentCookingLogs.mockReturnValue(new Promise(() => {}))
    loadAllCookingLogs.mockReturnValue(new Promise(() => {}))
    const { result } = monter()
    expect(result.current.journalLogs).toBeNull()
    expect(result.current.statsLogs).toBeNull()
    expect(result.current.journalError).toBe(false)
    expect(result.current.statsError).toBe(false)
  })

  it('chargé : les listes, sans erreur', async () => {
    const { result } = monter()
    await waitFor(() => expect(result.current.journalLogs).toEqual([LOG]))
    await waitFor(() => expect(result.current.statsLogs).toEqual([LOG]))
    expect(result.current.journalCount).toBe(1)
    expect(result.current.journalError).toBe(false)
    expect(result.current.statsError).toBe(false)
  })

  it('journal refusé : c’est une erreur, pas un journal vide', async () => {
    loadRecentCookingLogs.mockResolvedValue({ logs: [], error: PANNE })
    const { result } = monter()
    await waitFor(() => expect(result.current.journalError).toBe(true))
    expect(result.current.journalLogs).toBeNull()
  })

  it('statistiques refusées : c’est une erreur, pas « aucune statistique »', async () => {
    loadAllCookingLogs.mockResolvedValue({ logs: [], error: PANNE })
    const { result } = monter()
    await waitFor(() => expect(result.current.statsError).toBe(true))
    expect(result.current.statsLogs).toBeNull()
    // Le journal, lui, est arrivé.
    await waitFor(() => expect(result.current.journalLogs).toEqual([LOG]))
  })

  it('un appel qui lève (réseau coupé) est une erreur aussi', async () => {
    loadRecentCookingLogs.mockRejectedValue(new TypeError('Failed to fetch'))
    loadAllCookingLogs.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = monter()
    await waitFor(() => expect(result.current.journalError).toBe(true))
    await waitFor(() => expect(result.current.statsError).toBe(true))
  })

  // Sans cela, un second échec ne changeait rien à l'écran : impossible de
  // savoir si le bouton avait fait quelque chose.
  it('« Réessayer » repasse en chargement le temps de la nouvelle tentative, puis redit l’erreur si elle échoue aussi', async () => {
    let trancher
    loadAllCookingLogs
      .mockResolvedValueOnce({ logs: [], error: PANNE })
      .mockReturnValueOnce(new Promise((resolve) => { trancher = resolve }))
    loadRecentCookingLogs.mockResolvedValue({ logs: [], error: PANNE })
    const { result } = monter()
    await waitFor(() => expect(result.current.statsError).toBe(true))
    await waitFor(() => expect(result.current.journalError).toBe(true))
    act(() => { result.current.reloadCookingLogs() })
    expect(result.current.statsError).toBe(false)
    expect(result.current.journalError).toBe(false)
    expect(result.current.statsLogs).toBeNull()
    await act(async () => { trancher({ logs: [], error: PANNE }) })
    expect(result.current.statsError).toBe(true)
    await waitFor(() => expect(result.current.journalError).toBe(true))
  })

  it('changement de compte après un échec : l’erreur du compte précédent ne reste pas affichée', async () => {
    loadAllCookingLogs.mockResolvedValueOnce({ logs: [], error: PANNE })
    loadRecentCookingLogs.mockResolvedValueOnce({ logs: [], error: PANNE })
    const { result, rerender } = monter()
    await waitFor(() => expect(result.current.statsError).toBe(true))
    await waitFor(() => expect(result.current.journalError).toBe(true))
    session.user = { id: 'u2' }
    rerender()
    await waitFor(() => expect(result.current.statsLogs).toEqual([LOG]))
    await waitFor(() => expect(result.current.journalLogs).toEqual([LOG]))
    expect(result.current.statsError).toBe(false)
    expect(result.current.journalError).toBe(false)
  })

  it('« Réessayer » recharge ; une fois réussi, l’erreur disparaît', async () => {
    loadAllCookingLogs.mockResolvedValueOnce({ logs: [], error: PANNE })
    const { result } = monter()
    await waitFor(() => expect(result.current.statsError).toBe(true))
    await act(async () => { result.current.reloadCookingLogs() })
    await waitFor(() => expect(result.current.statsLogs).toEqual([LOG]))
    expect(result.current.statsError).toBe(false)
    expect(loadAllCookingLogs).toHaveBeenCalledTimes(2)
  })
})
