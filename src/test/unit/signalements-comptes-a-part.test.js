import { describe, it, expect, vi, beforeEach } from 'vitest'

const etat = vi.hoisted(() => ({ ouverts: { report: 0, autre: 0 }, rpc: { data: 'ticket-1', error: null }, envois: [] }))

// La « base » compte comme PostgREST : elle APPLIQUE le filtre de type qu'on lui
// donne. Sans filtre, elle compte tout — c'était le défaut.
vi.mock('@shared/lib/supabase/client', () => {
  const from = () => {
    const filtres = []
    const r = {
      select: () => r,
      eq: (c, v) => { filtres.push(['eq', c, v]); return r },
      neq: (c, v) => { filtres.push(['neq', c, v]); return r },
      in: () => {
        const type = filtres.find(([, colonne]) => colonne === 'type')
        let count = etat.ouverts.report + etat.ouverts.autre
        if (type?.[0] === 'eq' && type[2] === 'report') count = etat.ouverts.report
        if (type?.[0] === 'neq' && type[2] === 'report') count = etat.ouverts.autre
        return Promise.resolve({ count, error: null })
      },
    }
    return r
  }
  return {
    supabase: {
      from,
      rpc: (fn, args) => { etat.envois.push(args); return Promise.resolve(etat.rpc) },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-bob' } } }) },
    },
  }
})
vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  findCommunityRecipeTitlesByIds: vi.fn(), findOfficialRecipeNamesByIds: vi.fn(),
}))

import { createReport } from '@shared/api/reports'
import { createTicket } from '@features/support/api/support'
import { reportPost } from '@shared/api/community'
import { MAX_OPEN_TICKETS, MAX_OPEN_REPORTS } from '@shared/lib/support/open-tickets-cap'

// Audit du 2026-10-04, CPT-17 : le plafond de 3 demandes ouvertes comptait
// tickets ET signalements. Trois signalements en attente empêchaient d'écrire
// au support — et trois questions, de signaler un contenu.
describe('Signalements et demandes au support : deux plafonds', () => {
  beforeEach(() => { etat.ouverts = { report: 0, autre: 0 }; etat.rpc = { data: 'ticket-1', error: null }; etat.envois = [] })

  it('les plafonds : 3 demandes, 10 signalements', () => {
    expect(MAX_OPEN_TICKETS).toBe(3)
    expect(MAX_OPEN_REPORTS).toBe(10)
  })

  it('trois questions ouvertes n\'empêchent plus de signaler un contenu', async () => {
    etat.ouverts = { report: 0, autre: 3 }
    const { error } = await createReport({ targetType: 'community_post', targetId: 'p-1', reasonKey: 'spam' })
    expect(error).toBeNull()
    expect(etat.envois).toHaveLength(1)
  })

  it('trois signalements en attente n\'empêchent plus d\'écrire au support', async () => {
    etat.ouverts = { report: 3, autre: 0 }
    const { error } = await createTicket('u-bob', { type: 'question', title: 'Une question', message: 'Bonjour' })
    expect(error).toBeNull()
    expect(etat.envois).toHaveLength(1)
  })

  it('neuf signalements en attente : le dixième passe', async () => {
    etat.ouverts = { report: 9, autre: 3 }
    expect((await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })).error).toBeNull()
  })

  it('dix signalements en attente : refusé avant l\'envoi, avec son propre motif', async () => {
    etat.ouverts = { report: 10, autre: 0 }
    const { error } = await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })
    expect(error?.message).toBe('max_reports_reached')
    expect(etat.envois).toHaveLength(0)
  })

  it('trois demandes ouvertes : une quatrième question est refusée (inchangé)', async () => {
    etat.ouverts = { report: 0, autre: 3 }
    const { error } = await createTicket('u-bob', { type: 'question', title: 'Une question', message: 'Bonjour' })
    expect(error?.message).toBe('max_tickets_reached')
  })

  it('un refus 42501 de la base sur un signalement se dit « signalements », sur une question « demandes »', async () => {
    etat.rpc = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
    expect((await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })).error?.message).toBe('max_reports_reached')
    expect((await createTicket('u-bob', { type: 'question', title: 'T', message: 'M' })).error?.message).toBe('max_tickets_reached')
  })

  it('le signalement d\'un message de la communauté relaie le code, que la fenêtre traduit', async () => {
    etat.ouverts = { report: 10, autre: 0 }
    expect(await reportPost('u-bob', 'p-1', 'spam')).toEqual({ error: 'max_reports_reached' })
  })
})
