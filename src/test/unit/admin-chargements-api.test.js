import { describe, it, expect, vi, beforeEach } from 'vitest'

// La « base » : chaque requête rend ce qu'on lui a prévu, dans l'ordre ; on garde
// la trace des filtres appliqués.
const etat = vi.hoisted(() => ({ resultats: [], requetes: [] }))

vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, filtres: [] }
    etat.requetes.push(trace)
    const resultat = () => etat.resultats.shift() ?? { data: [], error: null }
    const q = {}
    for (const f of ['select', 'eq', 'in', 'is', 'not', 'neq', 'ilike', 'order', 'limit', 'range', 'gte']) {
      q[f] = (...a) => { trace.filtres.push([f, ...a]); return q }
    }
    q.single = () => Promise.resolve(resultat())
    q.maybeSingle = () => Promise.resolve(resultat())
    q.then = (ok, ko) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }
  return { supabase: { from: (table) => requete(table), auth: { getUser: () => Promise.resolve({ data: { user: { id: 'a' } } }) } } }
})

import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import { adminListPosts, adminListCommunityReports } from '@features/admin/api/community-admin'
import { adminListReviews, adminListReviewReports } from '@features/admin/api/recipe-reviews-admin'
import { adminGetAllTickets, getTicketMessages } from '@features/support/api/support'

beforeEach(() => { etat.resultats = []; etat.requetes = [] })

const PANNE = { data: null, error: { message: 'permission denied for table support_tickets', code: '42501' } }

// Audit du 2026-10-04, ADM-08 : les chargements du panneau transformaient une
// erreur en liste vide, et l'écran affichait son état vide — « Aucun post »,
// « Aucun ticket » : une panne ou une règle cassée se lisait « rien à modérer ».
describe('leverSiErreur — pour le corps d’un useReloader', () => {
  it('sans erreur : rend le résultat tel quel', () => {
    const r = { data: [1], count: 1, error: null }
    expect(leverSiErreur(r)).toBe(r)
  })

  it('avec une erreur de la base : lève une Error qui garde le message ET le code', () => {
    expect(() => leverSiErreur(PANNE)).toThrow('permission denied for table support_tickets')
    try { leverSiErreur(PANNE) } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect(e.code).toBe('42501')
    }
  })
})

describe.each([
  ['adminListPosts', () => adminListPosts({ status: 'active' })],
  ['adminListCommunityReports', () => adminListCommunityReports()],
  ['adminListReviews', () => adminListReviews({ status: 'active' })],
  ['adminListReviewReports', () => adminListReviewReports()],
  ['adminGetAllTickets', () => adminGetAllTickets()],
])('%s — un échec n’est plus une liste vide', (_, appel) => {
  it('la base refuse : l’appel lève, avec le code de la base', async () => {
    etat.resultats = [PANNE]
    await expect(appel()).rejects.toMatchObject({ code: '42501' })
  })

  it('la base répond : la liste (témoin)', async () => {
    etat.resultats = [{ data: [], error: null }]
    await expect(appel()).resolves.toEqual([])
  })
})

describe('les signalements « à traiter » de la modération', () => {
  // Les statuts d'un ticket sont `open`, `in_progress`, `resolved` : le filtre
  // `neq('status', 'closed')` ne retirait rien, et un signalement résolu restait
  // listé et compté (lu sur la vraie base le 2026-10-05).
  it.each([
    ['communauté', () => adminListCommunityReports()],
    ['avis', () => adminListReviewReports()],
  ])('%s : seulement les ouverts et en cours', async (_, appel) => {
    await appel()
    const filtres = etat.requetes[0].filtres
    expect(filtres).toContainEqual(['in', 'status', ['open', 'in_progress']])
    expect(filtres.some(([f, col]) => f === 'neq' && col === 'status')).toBe(false)
  })
})

describe('adminGetAllTickets — les pseudos', () => {
  it('les pseudos n’ont pas pu être lus : les tickets restent, sans pseudo', async () => {
    etat.resultats = [
      { data: [{ id: 't-1', user_id: 'u-1', title: 'T' }], error: null },
      { data: null, error: { message: 'boom' } },
    ]
    const tickets = await adminGetAllTickets()
    // Sans profil lisible : pas de pseudo, et la langue de repli (`fr`) pour l'e-mail (ADM-14).
    expect(tickets).toEqual([{ id: 't-1', user_id: 'u-1', title: 'T', username: null, language: 'fr' }])
  })
})

describe('getTicketMessages — { messages, error }', () => {
  it('la base répond : les messages', async () => {
    etat.resultats = [{ data: [{ id: 'm-1' }], error: null }]
    expect(await getTicketMessages('t-1')).toEqual({ messages: [{ id: 'm-1' }], error: null })
  })

  it('la base refuse : l’erreur, pas « aucun message »', async () => {
    etat.resultats = [PANNE]
    const { messages, error } = await getTicketMessages('t-1')
    expect(messages).toEqual([])
    expect(error).toMatchObject({ code: '42501' })
  })
})
