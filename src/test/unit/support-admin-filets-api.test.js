import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit du 2026-10-04, lot 12k-1, ADM-14 : la réponse de l'admin à un ticket
// envoyait un e-mail « best-effort » dont l'échec n'était jamais vu (une IIFE
// jetée, un console.error), et la liste des tickets ne portait pas la langue
// de leur auteur — l'e-mail partait dans la langue de l'interface admin.

const etat = vi.hoisted(() => ({ invoke: { data: null, error: null }, invokeLeve: null, profils: [] }))
const appels = vi.hoisted(() => ({ invoke: [], selections: [] }))
const sentry = vi.hoisted(() => ({ logError: vi.fn() }))

vi.mock('@shared/lib/observability/sentry', () => sentry)
vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, selection: null }
    const r = {
      select: (cols) => { trace.selection = cols; appels.selections.push(trace); return r },
      insert: () => r,
      order: () => r,
      in: () => Promise.resolve({ data: table === 'profiles' ? etat.profils : [], error: null }),
      then: (res, rej) => Promise.resolve(table === 'support_tickets'
        ? { data: [{ id: 't-1', user_id: 'u-2', type: 'question', title: 'T', status: 'open', has_unread_user: false, has_unread_admin: false, created_at: '2026-10-01', updated_at: '2026-10-01' }], error: null }
        : { error: null }).then(res, rej),
    }
    return r
  }
  return {
    supabase: {
      from: requete,
      functions: {
        invoke: (nom, options) => {
          appels.invoke.push({ nom, options })
          if (etat.invokeLeve) return Promise.reject(etat.invokeLeve)
          return Promise.resolve(etat.invoke)
        },
      },
    },
  }
})

import { adminReplyTicket, adminGetAllTickets } from '@features/support/api/support'

beforeEach(() => {
  appels.invoke.length = 0; appels.selections.length = 0
  etat.invoke = { data: null, error: null }; etat.invokeLeve = null; etat.profils = []
  sentry.logError.mockReset()
})

describe('adminReplyTicket — l’e-mail au membre, attendu et dit', () => {
  it('message enregistré et e-mail parti : aucune erreur', async () => {
    const r = await adminReplyTicket('t-1', null, 'Corrigé.', 'en')
    expect(r).toEqual({ error: null, emailError: null })
    expect(appels.invoke).toEqual([{ nom: 'send-ticket-notification', options: { body: { ticketId: 't-1', messageContent: 'Corrigé.', lang: 'en' } } }])
  })

  it('la fonction répond une erreur : le message tient, l’erreur de l’e-mail est rendue et journalisée', async () => {
    etat.invoke = { data: null, error: { message: 'Edge function returned 500' } }
    const r = await adminReplyTicket('t-1', null, 'Corrigé.', 'fr')
    expect(r.error).toBeNull()
    expect(r.emailError).toEqual({ message: 'Edge function returned 500' })
    expect(sentry.logError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tag: 'support.email' }))
  })

  it('la fonction est injoignable (réseau) : pareil, sans rien jeter', async () => {
    etat.invokeLeve = new TypeError('Failed to fetch')
    const r = await adminReplyTicket('t-1', null, 'Corrigé.', 'fr')
    expect(r.error).toBeNull()
    expect(r.emailError?.message).toBe('Failed to fetch')
  })
})

describe('adminGetAllTickets — la langue de l’auteur voyage avec le ticket', () => {
  it('lit `language` avec le pseudo, et la pose sur chaque ticket', async () => {
    etat.profils = [{ id: 'u-2', username: 'bob', language: 'en' }]
    const tickets = await adminGetAllTickets()
    expect(appels.selections.find((s) => s.table === 'profiles')?.selection).toMatch(/\blanguage\b/)
    expect(tickets[0]).toMatchObject({ id: 't-1', username: 'bob', language: 'en' })
  })

  it('un auteur sans langue enregistrée : `fr`', async () => {
    etat.profils = [{ id: 'u-2', username: 'bob', language: null }]
    const tickets = await adminGetAllTickets()
    expect(tickets[0].language).toBe('fr')
  })
})
