import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const api = vi.hoisted(() => ({ adminGetStats: vi.fn() }))

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'admin-1' }, isAdmin: true }) }))
vi.mock('@features/admin/api/admin', () => ({ adminGetStats: api.adminGetStats }))

import { AdminProvider, useAdmin } from '@features/admin/providers/admin-provider'

// Audit du 2026-10-04, ADM-08 : un compteur qui n'a pas pu être lu était avalé
// par `refreshStats` ; les badges restaient à 0 — « rien à modérer ». Le
// fournisseur retient désormais l'échec, et le tableau de bord le dit.
// ADM-12 (1, 2), lot 12l : les neuf compteurs viennent d'UNE lecture
// (`admin_compteurs`), plus de cinq comptages et de deux vues de santé
// téléchargées en entier à chaque ouverture et après chaque enregistrement.
const leve = (message, code) => () => { throw Object.assign(new Error(message), code ? { code } : {}) }

const COMPTEURS = { ingredients: 10, baseRecipes: 5, users: 8, pending: 2, ticketsOpen: 1, ticketsUnread: 1, reportsOpen: 3, healthCount: 4 }
function reussir() { api.adminGetStats.mockResolvedValue(COMPTEURS) }

const monter = () => renderHook(() => useAdmin(), { wrapper: AdminProvider })

beforeEach(() => { Object.values(api).forEach((m) => m.mockReset()); reussir() })

describe('AdminProvider — les compteurs', () => {
  it('tout est lu en une fois : pas d’erreur, chaque badge a son chiffre (témoin)', async () => {
    const { result } = monter()
    await waitFor(() => expect(result.current.stats.usersCount).toBe(8))
    expect(api.adminGetStats).toHaveBeenCalledTimes(1)
    expect(result.current.statsError).toBeNull()
    expect(result.current.stats).toMatchObject({ recipesPending: 2, baseRecipesCount: 5, ingredientsCount: 10, ticketsOpen: 1, ticketsUnread: 1 })
    expect(result.current.pendingCount).toBe(2)
    expect(result.current.supportBadge).toBe(1)
    expect(result.current.reportsCount).toBe(3)
    expect(result.current.healthCount).toBe(4)
  })

  it('la lecture échoue : l’échec est retenu, avec son code', async () => {
    api.adminGetStats.mockImplementation(leve('permission denied', '42501'))
    const { result } = monter()
    await waitFor(() => expect(result.current.statsError).not.toBeNull())
    expect(result.current.statsError.code).toBe('42501')
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
