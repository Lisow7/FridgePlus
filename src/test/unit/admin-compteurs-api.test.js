// Les compteurs et l'activité du panneau d'administration en une lecture
// chacun (audit du 2026-10-04, ADM-12 (1, 2) et ADM-11, lot 12l). Avant : cinq
// comptages et deux vues de santé téléchargées en entier pour un badge, après
// chaque enregistrement ; trois tables lues en entier sur deux ans pour le
// graphique, bornées à 1 000 lignes chacune par PostgREST sans que rien le dise.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { rpc: vi.fn(async () => ({ data: null, error: null })), from: vi.fn() },
}))

import { adminGetStats, adminGetAnalyticsData } from '@features/admin/api/admin'
import { supabase } from '@shared/lib/supabase/client'

beforeEach(() => { vi.clearAllMocks() })

describe('adminGetStats — admin_compteurs', () => {
  it('une seule fonction, et les neuf compteurs nommés comme le panneau les lit', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: {
      ingredients: 650, base_recipes: 515, users: 42, pending: 3, tickets_open: 4, tickets_unread: 1,
      reports_open: 2, health_recipes: 7, health_ingredients: 5,
    }, error: null })
    const stats = await adminGetStats()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('admin_compteurs')
    expect(stats).toEqual({
      ingredients: 650, baseRecipes: 515, users: 42, pending: 3, ticketsOpen: 4, ticketsUnread: 1,
      reportsOpen: 2, healthCount: 12,
    })
  })

  it('lève l’erreur de la base, avec son code (le fournisseur la retient)', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'forbidden: admin only' } })
    await expect(adminGetStats()).rejects.toMatchObject({ code: '42501' })
  })
})

describe('adminGetAnalyticsData — admin_activite_par_jour', () => {
  it('demande les jours depuis deux ans, et rend les lignes telles quelles', async () => {
    const jours = [{ jour: '2026-10-09', actions: 3, inscriptions: 1, recettes: 0 }]
    supabase.rpc.mockResolvedValueOnce({ data: jours, error: null })
    const avant = Date.now()
    const resultat = await adminGetAnalyticsData()
    const [nom, args] = supabase.rpc.mock.calls[0]
    expect(nom).toBe('admin_activite_par_jour')
    const depuis = new Date(args.p_depuis).getTime()
    expect(avant - depuis).toBeGreaterThan(729 * 24 * 3600 * 1000)
    expect(avant - depuis).toBeLessThan(732 * 24 * 3600 * 1000)
    expect(resultat).toEqual({ jours })
  })

  it('lève l’erreur de la base', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } })
    await expect(adminGetAnalyticsData()).rejects.toMatchObject({ message: 'boom' })
  })
})
