import { describe, it, expect, vi, beforeEach } from 'vitest'

const etat = vi.hoisted(() => ({ ouverts: 0, rpc: { data: 'ticket-1', error: null }, suppression: { data: [], error: null }, ecriture: { error: null } }))
const rpc = vi.hoisted(() => vi.fn())
const appels = vi.hoisted(() => [])

// Une « base » qui note chaque requête (table, verbe, filtres) et répond selon `etat`.
vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, verbe: 'select', filtres: [], selection: null }
    appels.push(trace)
    const r = {
      select: (cols) => { if (trace.verbe === 'select') trace.selection = cols; else trace.selection = cols; return r },
      insert: (ligne) => { trace.verbe = 'insert'; trace.ligne = ligne; return r },
      update: (champs) => { trace.verbe = 'update'; trace.ligne = champs; return r },
      delete: () => { trace.verbe = 'delete'; return r },
      eq: (c, v) => { trace.filtres.push([c, v]); return r },
      neq: (c, v) => { trace.filtres.push(['≠ ' + c, v]); return r },
      in: () => Promise.resolve({ count: etat.ouverts, error: null }),
      then: (res, rej) => {
        const reponse = trace.verbe === 'delete' ? etat.suppression : etat.ecriture
        return Promise.resolve(reponse).then(res, rej)
      },
    }
    return r
  }
  return { supabase: { from: requete, rpc: (...a) => { rpc(...a); return Promise.resolve(etat.rpc) } } }
})

import { createTicket, sendUserMessage, markTicketReadByUser, deleteUserMessage, deleteUserTicket } from '@features/support/api/support'

const PANNE = { message: 'Failed to fetch' }

beforeEach(() => {
  rpc.mockReset(); appels.length = 0
  etat.ouverts = 0; etat.rpc = { data: 'ticket-1', error: null }
  etat.suppression = { data: [], error: null }; etat.ecriture = { error: null }
})

// Trouvé le 2026-10-05 : le ticket était créé, PUIS son message inséré sans
// regarder le résultat — un refus laissait un ticket vide (qui occupe une des 3
// places), « bien reçu » à l'écran, le texte de la question perdu. Et
// `has_unread_admin` n'était pas posé : la question n'entrait pas dans la
// pastille de l'admin. La fonction `ouvrir_ticket` fait les deux d'un seul coup.
describe('createTicket — le ticket et sa question, d’un seul coup', () => {
  it('passe par la fonction de la base, avec exactement ce qu’il faut', async () => {
    const { data, error } = await createTicket('u-bob', { type: 'question', title: 'Mon frigo', message: '  Il est vide ?  ' })
    expect(error).toBeNull()
    expect(data).toEqual({ id: 'ticket-1' })
    expect(rpc).toHaveBeenCalledWith('ouvrir_ticket', {
      p_type: 'question', p_title: 'Mon frigo', p_message: 'Il est vide ?',
      p_target_type: null, p_target_id: null, p_reason_key: null,
    })
    // Aucune écriture directe dans les tables : tout passe par la fonction.
    expect(appels.filter((a) => a.verbe !== 'select')).toEqual([])
  })

  it('3 tickets ouverts : refusé avant l’envoi', async () => {
    etat.ouverts = 3
    expect((await createTicket('u-bob', { type: 'question', title: 'T', message: 'M' })).error?.message).toBe('max_tickets_reached')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refus 42501 des règles d’accès : max_tickets_reached', async () => {
    etat.rpc = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
    expect((await createTicket('u-bob', { type: 'question', title: 'T', message: 'M' })).error?.message).toBe('max_tickets_reached')
  })

  it('compte restreint : dit comme tel', async () => {
    etat.rpc = { data: null, error: { code: 'P0001', message: 'account_restricted' } }
    expect((await createTicket('u-bob', { type: 'question', title: 'T', message: 'M' })).error?.message).toBe('account_restricted')
  })

  it('toute autre erreur : rendue, et pas de ticket annoncé', async () => {
    etat.rpc = { data: null, error: PANNE }
    const { data, error } = await createTicket('u-bob', { type: 'question', title: 'T', message: 'M' })
    expect(error).toEqual(PANNE)
    expect(data).toBeNull()
  })
})

describe('sendUserMessage — la base prévient l’admin', () => {
  it('insère le message, et rien d’autre : « non lu par l’admin » est posé par la base', async () => {
    const { error } = await sendUserMessage('ticket-1', 'u-bob', 'Merci !')
    expect(error).toBeNull()
    const ecritures = appels.filter((a) => a.verbe !== 'select')
    expect(ecritures).toHaveLength(1)
    expect(ecritures[0]).toMatchObject({ table: 'support_messages', verbe: 'insert', ligne: { ticket_id: 'ticket-1', sender_id: 'u-bob', is_admin: false, content: 'Merci !' } })
  })

  it('refusé : l’erreur est rendue', async () => {
    etat.ecriture = { error: PANNE }
    expect((await sendUserMessage('ticket-1', 'u-bob', 'x')).error).toEqual(PANNE)
  })
})

describe('markTicketReadByUser — rend son erreur', () => {
  it('accepté : { error: null }', async () => {
    expect(await markTicketReadByUser('ticket-1')).toEqual({ error: null })
  })
  it('refusé : l’erreur', async () => {
    etat.ecriture = { error: PANNE }
    expect(await markTicketReadByUser('ticket-1')).toEqual({ error: PANNE })
  })
})

// Prouvé le 2026-10-05 sur la vraie base : la règle de suppression est
// « admin seulement ». La requête d'un compte touche 0 ligne, SANS erreur — et
// l'écran retirait le message. Désormais 0 ligne touchée = échec.
describe('deleteUserMessage / deleteUserTicket — 0 ligne touchée n’est pas un succès', () => {
  it('message : 0 ligne touchée → échec reconnaissable', async () => {
    etat.suppression = { data: [], error: null }
    expect((await deleteUserMessage('m-1', 'u-bob')).error?.code).toBe('no_rows_affected')
  })

  it('message : supprimé pour de vrai → aucune erreur', async () => {
    etat.suppression = { data: [{ id: 'm-1' }], error: null }
    expect((await deleteUserMessage('m-1', 'u-bob')).error).toBeNull()
    const suppression = appels.find((a) => a.verbe === 'delete')
    expect(suppression.table).toBe('support_messages')
    expect(suppression.filtres).toEqual(expect.arrayContaining([['id', 'm-1'], ['sender_id', 'u-bob'], ['is_admin', false]]))
  })

  it('ticket : 0 ligne touchée → échec', async () => {
    expect((await deleteUserTicket('t-1', 'u-bob')).error?.code).toBe('no_rows_affected')
  })

  it('ticket : une seule requête, sur le ticket — ses messages partent avec lui (clé étrangère en cascade)', async () => {
    etat.suppression = { data: [{ id: 't-1' }], error: null }
    expect((await deleteUserTicket('t-1', 'u-bob')).error).toBeNull()
    const suppressions = appels.filter((a) => a.verbe === 'delete')
    expect(suppressions).toHaveLength(1)
    expect(suppressions[0].table).toBe('support_tickets')
    expect(suppressions[0].filtres).toEqual(expect.arrayContaining([['id', 't-1'], ['user_id', 'u-bob']]))
  })

  it('une erreur de la base passe telle quelle', async () => {
    etat.suppression = { data: null, error: PANNE }
    expect((await deleteUserTicket('t-1', 'u-bob')).error).toEqual(PANNE)
  })
})
