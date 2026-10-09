import { describe, it, expect, vi, beforeEach } from 'vitest'

// Le panneau bannit par la base (audit du 2026-10-04, lot 3c-3b).
//
// `adminToggleBan` écrivait `profiles.banned` seul. `admin_bannir` (lot
// 3c-3b-1, en base) pose aussi le motif, la date de fin, coupe les sessions et
// refuse la reconnexion ; il garde ses propres règles (ni soi-même, ni un
// admin, motif obligatoire). Ses refus deviennent des phrases.

const rpc = vi.hoisted(() => vi.fn())
const invoke = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { rpc, functions: { invoke } } }))

import { adminBannir, adminDebannir, notifierLeBannissement } from '@features/admin/api/bannissement'

beforeEach(() => { rpc.mockReset(); invoke.mockReset() })

describe('adminBannir', () => {
  it('appelle admin_bannir avec le motif et la durée, et rend la date de fin', async () => {
    rpc.mockResolvedValue({ data: '2026-10-12T10:00:00+00:00', error: null })
    const r = await adminBannir('u-2', 'Spam — liens', 7)
    expect(rpc).toHaveBeenCalledWith('admin_bannir', { p_user_id: 'u-2', p_motif: 'Spam — liens', p_jours: 7 })
    expect(r).toEqual({ fin: '2026-10-12T10:00:00+00:00', error: null })
  })

  it('« sans fin » : p_jours nul', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await adminBannir('u-2', 'Harcèlement', null)
    expect(rpc).toHaveBeenCalledWith('admin_bannir', { p_user_id: 'u-2', p_motif: 'Harcèlement', p_jours: null })
  })

  it.each([
    ['cannot_ban_admin', 'Un admin ne peut pas être banni.'],
    ['cannot_ban_self', 'Tu ne peux pas te bannir toi-même.'],
    ['reason_required', 'Le motif est obligatoire.'],
    ['reason_too_long', 'Le motif est trop long (300 caractères au plus).'],
    ['user_not_found', 'Ce compte n’existe plus.'],
    ['forbidden', 'Réservé aux admins.'],
  ])('refus « %s » : une phrase', async (code, phrase) => {
    rpc.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } })
    const r = await adminBannir('u-2', 'x', 7)
    expect(r.error.message).toBe(phrase)
  })

  it('panne réseau : une phrase, jamais le message brut', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    const r = await adminBannir('u-2', 'x', 7)
    expect(r.error.message).toBe('Le bannissement n’a pas pu être enregistré. Réessaie.')
  })
})

// L'e-mail au bannissement (choix d'Antoine, 2026-10-05) : une fois sa
// session coupée, la personne ne voit plus que « Ce compte est suspendu » à la
// connexion. Best-effort : le bannissement tient même si l'e-mail ne part pas.
describe('notifierLeBannissement', () => {
  it('appelle la fonction d’envoi avec le compte visé', async () => {
    invoke.mockResolvedValue({ data: { sent: true }, error: null })
    expect(await notifierLeBannissement('u-2')).toEqual({ envoye: true })
    expect(invoke).toHaveBeenCalledWith('notifier-bannissement', { body: { userId: 'u-2' } })
  })

  it('refus ou panne : « pas envoyé », jamais une exception', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'quota' } })
    expect(await notifierLeBannissement('u-2')).toEqual({ envoye: false })
    invoke.mockRejectedValue(new Error('Failed to fetch'))
    expect(await notifierLeBannissement('u-2')).toEqual({ envoye: false })
  })
})

describe('adminDebannir', () => {
  it('appelle admin_debannir', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const r = await adminDebannir('u-2')
    expect(rpc).toHaveBeenCalledWith('admin_debannir', { p_user_id: 'u-2' })
    expect(r.error).toBeNull()
  })
})
