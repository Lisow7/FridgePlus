import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted évite le problème de hoisting de vi.mock
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

import {
  getUserTickets, getTicketMessages, createTicket,
  sendUserMessage, markTicketReadByUser, countUnreadTickets,
  adminGetAllTickets, adminReplyTicket, adminSetTicketStatus, adminCountOpenTickets,
} from '@features/support/api/support'

// Construit un objet chainable qui se résout avec `returnValue`
function chain(returnValue) {
  const c = {
    select:  vi.fn().mockReturnThis(),
    insert:  vi.fn().mockReturnThis(),
    update:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    in:      vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    single:  vi.fn().mockResolvedValue(returnValue),
  }
  c[Symbol.toStringTag] = 'Promise'
  c.then  = (res, rej) => Promise.resolve(returnValue).then(res, rej)
  c.catch = (rej)      => Promise.resolve(returnValue).catch(rej)
  return c
}

describe('Backend — support.js', () => {
  beforeEach(() => mockFrom.mockReset())

  // ─── getUserTickets ──────────────────────────────────────────────────────
  describe('getUserTickets', () => {
    it('retourne les tickets de l\'utilisateur', async () => {
      const tickets = [{ id: 't1', type: 'question', title: 'Test', status: 'open', has_unread_user: false, created_at: '2026-01-01' }]
      mockFrom.mockReturnValue(chain({ data: tickets, error: null }))
      expect(await getUserTickets('user-1')).toEqual(tickets)
    })

    it('retourne [] si erreur Supabase', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { code: '42501' } }))
      expect(await getUserTickets('user-1')).toEqual([])
    })

    it('retourne [] si data est null', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }))
      expect(await getUserTickets('user-1')).toEqual([])
    })
  })

  // ─── getTicketMessages ───────────────────────────────────────────────────
  describe('getTicketMessages', () => {
    it('retourne les messages triés', async () => {
      const msgs = [
        { id: 'm1', is_admin: false, content: 'Bonjour', created_at: '2026-01-01' },
        { id: 'm2', is_admin: true,  content: 'Réponse', created_at: '2026-01-02' },
      ]
      mockFrom.mockReturnValue(chain({ data: msgs, error: null }))
      const result = await getTicketMessages('ticket-1')
      expect(result).toHaveLength(2)
      expect(result[1].is_admin).toBe(true)
    })

    it('retourne [] si aucun message', async () => {
      mockFrom.mockReturnValue(chain({ data: [], error: null }))
      expect(await getTicketMessages('ticket-vide')).toEqual([])
    })
  })

  // ─── createTicket ────────────────────────────────────────────────────────
  describe('createTicket', () => {
    it('crée un ticket et retourne son id', async () => {
      const countChain  = chain({ count: 0, error: null })
      const insertChain = { ...chain(null), single: vi.fn().mockResolvedValue({ data: { id: 'new-t' }, error: null }) }
      const msgChain    = chain({ data: null, error: null })
      mockFrom
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(msgChain)
      const result = await createTicket('user-1', { type: 'question', title: 'T', message: 'M' })
      expect(result.error).toBeNull()
      expect(result.data?.id).toBe('new-t')
    })

    it('retourne max_tickets_reached si 3 tickets ouverts', async () => {
      mockFrom.mockReturnValue(chain({ count: 3, error: null }))
      const result = await createTicket('user-1', { type: 'question', title: 'T', message: 'M' })
      expect(result.error?.message).toBe('max_tickets_reached')
    })

    it('bloque aussi avec exactement MAX_OPEN_TICKETS tickets', async () => {
      mockFrom.mockReturnValue(chain({ count: 3, error: null }))
      const { error } = await createTicket('user-1', { type: 'report', title: 'Bug', message: 'Pb' })
      expect(error).not.toBeNull()
    })

    // Depuis la migration `20260812_plafond_serveur_tickets_ouverts.sql`, la base
    // applique elle aussi le plafond. Deux envois concurrents franchissent le
    // compteur client et se font arrêter par la policy RLS, qui rend 42501. Sans
    // cette traduction, l'UI — qui teste `message === 'max_tickets_reached'` —
    // afficherait « new row violates row-level security policy » à l'utilisateur.
    it('traduit le refus 42501 de la policy RLS en max_tickets_reached', async () => {
      const countChain  = chain({ count: 2, error: null })
      const insertChain = {
        ...chain(null),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }),
      }
      mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)
      const { error } = await createTicket('user-1', { type: 'question', title: 'T', message: 'M' })
      expect(error?.message).toBe('max_tickets_reached')
    })

    it('retourne error si insert échoue', async () => {
      const countChain  = chain({ count: 1, error: null })
      const insertChain = { ...chain(null), single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }) }
      mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)
      const result = await createTicket('user-1', { type: 'report', title: 'B', message: 'M' })
      expect(result.error).toBeTruthy()
    })
  })

  // ─── countUnreadTickets ──────────────────────────────────────────────────
  describe('countUnreadTickets', () => {
    it('retourne le bon nombre', async () => {
      mockFrom.mockReturnValue(chain({ count: 2, error: null }))
      expect(await countUnreadTickets('user-1')).toBe(2)
    })

    it('retourne 0 si aucun non-lu', async () => {
      mockFrom.mockReturnValue(chain({ count: 0, error: null }))
      expect(await countUnreadTickets('user-1')).toBe(0)
    })

    it('retourne 0 si count null', async () => {
      mockFrom.mockReturnValue(chain({ count: null, error: null }))
      expect(await countUnreadTickets('user-1')).toBe(0)
    })
  })

  // ─── markTicketReadByUser ────────────────────────────────────────────────
  describe('markTicketReadByUser', () => {
    it('appelle update({ has_unread_user: false })', async () => {
      const c = chain({ error: null })
      mockFrom.mockReturnValue(c)
      await markTicketReadByUser('ticket-1')
      expect(c.update).toHaveBeenCalledWith({ has_unread_user: false })
      expect(c.eq).toHaveBeenCalledWith('id', 'ticket-1')
    })
  })

  // ─── sendUserMessage ─────────────────────────────────────────────────────
  describe('sendUserMessage', () => {
    it('insère le message et retourne error: null', async () => {
      const c = chain({ error: null })
      mockFrom.mockReturnValue(c)
      const { error } = await sendUserMessage('ticket-1', 'user-1', 'Bonjour')
      expect(error).toBeNull()
    })

    it('retourne l\'erreur si insert échoue', async () => {
      mockFrom.mockReturnValue(chain({ error: { message: 'DB error' } }))
      const { error } = await sendUserMessage('ticket-1', 'user-1', 'Msg')
      expect(error).toBeTruthy()
    })

    it('is_admin = false pour un message utilisateur', async () => {
      const c = chain({ error: null })
      mockFrom.mockReturnValue(c)
      await sendUserMessage('ticket-1', 'user-1', 'Mon message')
      expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ is_admin: false }))
    })
  })

  // ─── adminReplyTicket ────────────────────────────────────────────────────
  describe('adminReplyTicket', () => {
    it('insère le message admin et met le ticket en in_progress + has_unread_user', async () => {
      const insertChain = chain({ error: null })
      const updateChain = chain({ error: null })
      mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(updateChain)
      const { error } = await adminReplyTicket('ticket-1', 'admin-1', 'Réponse')
      expect(error).toBeNull()
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ has_unread_user: true, status: 'in_progress' })
      )
    })

    it('is_admin = true pour un message admin', async () => {
      const insertChain = chain({ error: null })
      const updateChain = chain({ error: null })
      mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(updateChain)
      await adminReplyTicket('ticket-1', 'admin-1', 'Réponse admin')
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ is_admin: true, sender_id: 'admin-1' })
      )
    })
  })

  // ─── adminSetTicketStatus ────────────────────────────────────────────────
  describe('adminSetTicketStatus', () => {
    it.each(['open', 'in_progress'])('accepte le statut "%s"', async (status) => {
      const c = chain({ error: null })
      mockFrom.mockReturnValue(c)
      const { error } = await adminSetTicketStatus('ticket-1', status)
      expect(error).toBeNull()
      expect(c.update).toHaveBeenCalledWith({ status })
    })

    it('accepte le statut "resolved" et efface has_unread_admin', async () => {
      const c = chain({ error: null })
      mockFrom.mockReturnValue(c)
      const { error } = await adminSetTicketStatus('ticket-1', 'resolved')
      expect(error).toBeNull()
      expect(c.update).toHaveBeenCalledWith({ status: 'resolved', has_unread_admin: false })
    })
  })

  // ─── adminCountOpenTickets ───────────────────────────────────────────────
  describe('adminCountOpenTickets', () => {
    it('retourne le total des tickets open + in_progress', async () => {
      mockFrom.mockReturnValue(chain({ count: 7, error: null }))
      expect(await adminCountOpenTickets()).toBe(7)
    })

    it('retourne 0 si aucun ticket ouvert', async () => {
      mockFrom.mockReturnValue(chain({ count: 0, error: null }))
      expect(await adminCountOpenTickets()).toBe(0)
    })
  })

  // ─── adminGetAllTickets ──────────────────────────────────────────────────
  describe('adminGetAllTickets', () => {
    it('retourne [] si aucun ticket', async () => {
      mockFrom.mockReturnValue(chain({ data: [], error: null }))
      expect(await adminGetAllTickets()).toEqual([])
    })

    it('associe le username au ticket via profiles', async () => {
      const tickets  = [{ id: 't1', user_id: 'u1', type: 'question', title: 'T', status: 'open', has_unread_user: false, created_at: '2026-01-01' }]
      const profiles = [{ id: 'u1', username: 'alice' }]
      mockFrom
        .mockReturnValueOnce(chain({ data: tickets,  error: null }))
        .mockReturnValueOnce(chain({ data: profiles, error: null }))
      const result = await adminGetAllTickets()
      expect(result[0].username).toBe('alice')
    })

    it('username = null si profil introuvable', async () => {
      const tickets = [{ id: 't1', user_id: 'u-inconnu', type: 'report', title: 'B', status: 'open', has_unread_user: false, created_at: '2026-01-01' }]
      mockFrom
        .mockReturnValueOnce(chain({ data: tickets, error: null }))
        .mockReturnValueOnce(chain({ data: [],      error: null }))
      const result = await adminGetAllTickets()
      expect(result[0].username).toBeNull()
    })
  })
})
