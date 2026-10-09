import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const api = vi.hoisted(() => ({
  adminGetStats: vi.fn(), adminGetHealthChecks: vi.fn(),
  adminCountOpenTickets: vi.fn(), adminCountUnreadTickets: vi.fn(), adminCountReports: vi.fn(),
}))

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'admin-1' }, isAdmin: true }) }))
vi.mock('@features/admin/api/admin', () => ({ adminGetStats: api.adminGetStats, adminGetHealthChecks: api.adminGetHealthChecks }))
vi.mock('@features/support/api/support', () => ({
  adminCountOpenTickets: api.adminCountOpenTickets, adminCountUnreadTickets: api.adminCountUnreadTickets,
}))
vi.mock('@shared/api/reports', () => ({ adminCountReports: api.adminCountReports }))

import { AdminProvider, useAdmin } from '@features/admin/providers/admin-provider'

// Audit du 2026-10-04, ADM-08 : un compteur qui n'a pas pu être lu était avalé
// par `refreshStats` ; les badges restaient à 0 — « rien à modérer ». Le
// fournisseur retient désormais l'échec, et le tableau de bord le dit.
const leve = (message, code) => () => { throw Object.assign(new Error(message), code ? { code } : {}) }

function reussir() {
  api.adminGetStats.mockResolvedValue({ ingredients: 10, baseRecipes: 5, users: 8, pending: 2 })
  api.adminGetHealthChecks.mockResolvedValue({ recipes: [], ingredients: [], error: null })
  api.adminCountOpenTickets.mockResolvedValue(1)
  api.adminCountUnreadTickets.mockResolvedValue(1)
  api.adminCountReports.mockResolvedValue({ count: 0, error: null })
}

const monter = () => renderHook(() => useAdmin(), { wrapper: AdminProvider })

beforeEach(() => { Object.values(api).forEach((m) => m.mockReset()); reussir() })

describe('AdminProvider — les compteurs', () => {
  it('tout est lu : pas d’erreur, les compteurs sont là (témoin)', async () => {
    const { result } = monter()
    await waitFor(() => expect(result.current.stats.usersCount).toBe(8))
    expect(result.current.statsError).toBeNull()
    expect(result.current.pendingCount).toBe(2)
  })

  it('un comptage échoue : l’échec est retenu, avec son code', async () => {
    api.adminGetStats.mockImplementation(leve('permission denied', '42501'))
    const { result } = monter()
    await waitFor(() => expect(result.current.statsError).not.toBeNull())
    expect(result.current.statsError.code).toBe('42501')
  })

  it('le comptage des signalements rend une erreur : l’échec est retenu aussi', async () => {
    api.adminCountReports.mockResolvedValue({ count: 0, error: { message: 'boom', code: 'XX000' } })
    const { result } = monter()
    await waitFor(() => expect(result.current.statsError?.message).toBe('boom'))
  })

  it('« Réessayer » réussit : l’échec s’efface', async () => {
    api.adminGetStats.mockImplementation(leve('panne'))
    const { result } = monter()
    await waitFor(() => expect(result.current.statsError).not.toBeNull())
    reussir()
    await act(() => result.current.refreshStats())
    expect(result.current.statsError).toBeNull()
    expect(result.current.stats.usersCount).toBe(8)
  })
})
