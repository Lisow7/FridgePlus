import { describe, it, expect, vi, beforeEach } from 'vitest'

const etat = vi.hoisted(() => ({ ouverts: 0, rpc: { data: 'ticket-1', error: null } }))
const rpc = vi.hoisted(() => vi.fn())

// La « base » : le compte de tickets ouverts (lecture), et la fonction
// `ouvrir_ticket` qui crée le ticket ET son premier message d'un seul coup.
vi.mock('@shared/lib/supabase/client', () => {
  const requete = {
    select: () => requete, eq: () => requete,
    in: () => Promise.resolve({ count: etat.ouverts, error: null }),
  }
  return {
    supabase: {
      from: () => requete,
      rpc: (...args) => { rpc(...args); return etat.rpc instanceof Error ? Promise.reject(etat.rpc) : Promise.resolve(etat.rpc) },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-bob' } } }) },
    },
  }
})
vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  findCommunityRecipeTitlesByIds: vi.fn(), findOfficialRecipeNamesByIds: vi.fn(),
}))

import { createReport, REPORT_TARGET_TYPES } from '@shared/api/reports'
import { reportPost, reportReply, reportProfile } from '@shared/api/community'
import { reportReview } from '@features/recipes/api/recipe-reviews'

// Hors audit, trouvé et prouvé le 2026-10-05 sur la vraie base : AUCUN
// signalement de la communauté ni d'un avis ne pouvait aboutir. Les quatre
// fonctions écrivaient une colonne `body` qui n'existe pas dans
// `support_tickets` et oubliaient `title`, obligatoire ; pour un avis, la
// contrainte refusait en plus la cible `recipe_review`. Elles passent désormais
// toutes par `createReport`, qui ouvre le ticket et y joint le détail du motif
// d'un seul coup (fonction `ouvrir_ticket` de la base) : si le détail ne peut
// pas être joint, rien n'est créé.
describe('createReport — un seul chemin, qui aboutit', () => {
  beforeEach(() => { rpc.mockReset(); etat.ouverts = 0; etat.rpc = { data: 'ticket-1', error: null } })

  it('ouvre le ticket et son détail par la fonction de la base, avec exactement ce qu’il faut', async () => {
    const { error, data } = await createReport({ targetType: 'community_post', targetId: 'p-1', reasonKey: 'spam', reasonDetails: '  Pub répétée  ' })
    expect(error).toBeNull()
    expect(data).toEqual({ id: 'ticket-1' })
    expect(rpc).toHaveBeenCalledWith('ouvrir_ticket', {
      p_type: 'report',
      p_title: 'Signalement : post de la communauté (spam)',
      p_message: 'Pub répétée',
      p_target_type: 'community_post',
      p_target_id: 'p-1',
      p_reason_key: 'spam',
    })
  })

  it('sans détail : pas de message joint', async () => {
    await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'wrong_info' })
    expect(rpc.mock.calls[0][1].p_message).toBeNull()
  })

  it('un titre donné par l’écran est gardé', async () => {
    await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam', userTitle: '🍝 Pâtes — Spam' })
    expect(rpc.mock.calls[0][1].p_title).toBe('🍝 Pâtes — Spam')
  })

  it.each(['community_post', 'community_reply', 'community_profile', 'recipe_review', 'recipe', 'user', 'comment', 'ingredient'])(
    'la cible « %s » est acceptée',
    async (cible) => {
      expect(REPORT_TARGET_TYPES).toContain(cible)
      const { error } = await createReport({ targetType: cible, targetId: 'x-1', reasonKey: 'spam' })
      expect(error).toBeNull()
    },
  )

  it('une cible inconnue est refusée sans rien envoyer', async () => {
    const { error } = await createReport({ targetType: 'ailleurs', targetId: 'x', reasonKey: 'spam' })
    expect(error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('10 signalements déjà en attente : refusé avant l’envoi, avec le motif que l’écran sait dire', async () => {
    etat.ouverts = 10
    const { error } = await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })
    expect(error?.message).toBe('max_reports_reached')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refus 42501 des règles d’accès (deux envois en même temps) : traduit en max_reports_reached', async () => {
    etat.rpc = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
    const { error } = await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })
    expect(error?.message).toBe('max_reports_reached')
  })

  it('compte banni ou supprimé : refus dit comme tel, pas comme un plafond', async () => {
    etat.rpc = { data: null, error: { code: 'P0001', message: 'account_restricted' } }
    const { error } = await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })
    expect(error?.message).toBe('account_restricted')
  })

  it('une autre erreur passe telle quelle', async () => {
    etat.rpc = { data: null, error: { code: '23514', message: 'violates check constraint' } }
    const { error } = await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })
    expect(error?.message).toBe('violates check constraint')
  })

  it('un appel qui lève (réseau coupé) : rendu comme une erreur, sans exception, et sans ticket annoncé', async () => {
    etat.rpc = new TypeError('Failed to fetch')
    const { error, data } = await createReport({ targetType: 'recipe', targetId: 'r-1', reasonKey: 'spam' })
    expect(error).toBeInstanceOf(TypeError)
    expect(data).toBeNull()
  })
})

describe('Signalements de la communauté — ils passent par createReport', () => {
  beforeEach(() => { rpc.mockReset(); etat.ouverts = 0; etat.rpc = { data: 'ticket-1', error: null } })

  it('un post : cible community_post, détail joint, { ok: true }', async () => {
    expect(await reportPost('u-bob', 'p-1', 'harassment', 'Insultes')).toEqual({ ok: true })
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_target_type: 'community_post', p_target_id: 'p-1', p_reason_key: 'harassment', p_message: 'Insultes' })
  })

  it('une réponse : cible community_reply', async () => {
    expect(await reportReply('u-bob', 'rep-1', 'spam')).toEqual({ ok: true })
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_target_type: 'community_reply', p_target_id: 'rep-1' })
  })

  it('un profil : cible community_profile', async () => {
    expect(await reportProfile('u-bob', 'u-alice', 'inappropriate')).toEqual({ ok: true })
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_target_type: 'community_profile', p_target_id: 'u-alice' })
  })

  it('se signaler soi-même : refusé sans rien envoyer', async () => {
    expect(await reportProfile('u-bob', 'u-bob', 'spam')).toEqual({ error: 'invalid' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('un motif inconnu : refusé sans rien envoyer', async () => {
    expect(await reportPost('u-bob', 'p-1', 'pas-un-motif')).toEqual({ error: 'invalid' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('plafond atteint : le code, que la fenêtre traduit', async () => {
    etat.ouverts = 10
    expect(await reportPost('u-bob', 'p-1', 'spam')).toEqual({ error: 'max_reports_reached' })
  })

  it('compte restreint : le code', async () => {
    etat.rpc = { data: null, error: { code: 'P0001', message: 'account_restricted' } }
    expect(await reportReply('u-bob', 'rep-1', 'spam')).toEqual({ error: 'account_restricted' })
  })

  it('toute autre panne : un code générique, jamais le texte brut de la base', async () => {
    etat.rpc = { data: null, error: { code: '42703', message: 'column "body" does not exist' } }
    expect(await reportPost('u-bob', 'p-1', 'spam')).toEqual({ error: 'failed' })
  })
})

describe('Signalement d’un avis — il passe par createReport', () => {
  beforeEach(() => { rpc.mockReset(); etat.ouverts = 0; etat.rpc = { data: 'ticket-1', error: null } })

  it('cible recipe_review, { ok: true }', async () => {
    expect(await reportReview('u-bob', 'avis-1', 'wrong_info')).toEqual({ ok: true })
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_target_type: 'recipe_review', p_target_id: 'avis-1', p_reason_key: 'wrong_info' })
  })

  it('refusé : le code — l’écran ne doit plus dire « Signalement envoyé »', async () => {
    etat.rpc = { data: null, error: { code: '23514', message: 'violates check constraint' } }
    expect(await reportReview('u-bob', 'avis-1', 'spam')).toEqual({ error: 'failed' })
  })
})
