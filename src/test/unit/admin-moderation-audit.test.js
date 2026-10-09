import { describe, it, expect, vi, beforeEach } from 'vitest'

// Les actions de modération admin sont-elles réellement AUDITÉES ?
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// La mesure de couverture du 2026-08-28 a sorti `community-admin.js` (38 l) et
// `recipe-reviews-admin.js` (27 l) à 0 % de lignes exécutées. Les deux portent
// en en-tête la même promesse, écrite noir sur blanc :
//
//   « Toutes les actions admin sont auditées via logAuditAction (vocabulaire
//     fermé + metadata whitelistée). »
//
// 🔴 Rien ne la vérifiait. Or c'est un garde-fou, et ce dépôt s'est déjà fait
// prendre deux fois sur cette forme : le plafond budgétaire IA débranché trois
// mois, et la garde RGPD des dépenses sans test (lot 13). **Supprimer un appel
// d'audit ne casse rien** — la suppression réussit, l'écran se rafraîchit, et
// la trace disparaît en silence. Sur des actions de modération (suppression
// définitive d'un avis, réduction au silence d'un utilisateur), une trace
// manquante n'est pas un détail de confort : c'est ce qui permet de répondre à
// « qui a fait ça, quand, et pourquoi ».
//
// ── L'invariant, dans les deux sens ──────────────────────────────────────
// 1. Une action qui RÉUSSIT est tracée, avec le bon verbe et la bonne cible.
// 2. Une action qui ÉCHOUE n'est PAS tracée — un journal qui consigne des
//    suppressions qui n'ont pas eu lieu est pire qu'un journal absent.

const mockRpc  = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockLog  = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}))

vi.mock('@features/admin/lib/audit', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, logAuditAction: (...a) => mockLog(...a) }
})

import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '@features/admin/lib/audit'
import {
  adminSoftDeletePost, adminHardDeletePost, adminMuteUser, adminUnmuteUser, adminListPosts,
} from '@features/admin/api/community-admin'
import {
  adminSoftDeleteReview, adminHardDeleteReview, adminListReviews,
} from '@features/admin/api/recipe-reviews-admin'

// Chaine supabase-js « thenable » pour les listages.
function chaine(valeur) {
  const c = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }
  c[Symbol.toStringTag] = 'Promise'
  c.then  = (res, rej) => Promise.resolve(valeur).then(res, rej)
  c.catch = (rej)      => Promise.resolve(valeur).catch(rej)
  return c
}

const OK   = { error: null }
const ECHEC = { error: { message: 'RLS refuse' } }

beforeEach(() => { mockRpc.mockReset(); mockLog.mockReset(); mockFrom.mockReset() })

describe('Modération admin — toute action réussie laisse une trace', () => {
  it('masquer un post de la communauté : RPC appelée ET action journalisée', async () => {
    mockRpc.mockResolvedValue(OK)
    const res = await adminSoftDeletePost('p-1', 'spam', 3)

    expect(mockRpc).toHaveBeenCalledWith('admin_community_soft_delete_post', { p_post_id: 'p-1' })
    expect(mockLog).toHaveBeenCalledWith(AUDIT_ACTIONS.COMMUNITY_POST_DELETED, {
      targetId: 'p-1',
      targetType: AUDIT_TARGET_TYPES.COMMUNITY_POST,
      metadata: { reason: 'spam', reported_count: 3 },
    })
    expect(res).toEqual({ ok: true })
  })

  it('supprimer définitivement un post : verbe d\'audit DISTINCT du masquage', async () => {
    mockRpc.mockResolvedValue(OK)
    await adminHardDeletePost('p-2', 'illégal')

    // Confondre les deux verbes rendrait le journal inexploitable : on ne
    // saurait plus distinguer un masquage réversible d'une purge définitive.
    expect(mockLog).toHaveBeenCalledWith(AUDIT_ACTIONS.COMMUNITY_POST_PURGED, expect.anything())
    expect(mockLog).not.toHaveBeenCalledWith(AUDIT_ACTIONS.COMMUNITY_POST_DELETED, expect.anything())
  })

  it('masquer un avis de recette : RPC appelée ET action journalisée', async () => {
    mockRpc.mockResolvedValue(OK)
    const res = await adminSoftDeleteReview('r-1', 'insultes', 2)

    expect(mockRpc).toHaveBeenCalledWith('admin_review_soft_delete', { p_review_id: 'r-1' })
    expect(mockLog).toHaveBeenCalledWith(AUDIT_ACTIONS.RECIPE_REVIEW_DELETED, {
      targetId: 'r-1',
      targetType: AUDIT_TARGET_TYPES.RECIPE_REVIEW,
      metadata: { reason: 'insultes', reported_count: 2 },
    })
    expect(res).toEqual({ ok: true })
  })

  it('supprimer définitivement un avis : verbe d\'audit distinct', async () => {
    mockRpc.mockResolvedValue(OK)
    await adminHardDeleteReview('r-2', 'diffamation')
    expect(mockLog).toHaveBeenCalledWith(AUDIT_ACTIONS.RECIPE_REVIEW_PURGED, expect.anything())
  })
})

describe('Modération admin — une action qui échoue ne laisse PAS de trace', () => {
  // Un journal qui consigne des suppressions qui n'ont pas eu lieu est pire
  // qu'un journal absent : il fait croire à une action accomplie.
  const cas = [
    ['masquage de post',      () => adminSoftDeletePost('p-1', 'spam', 1)],
    ['purge de post',         () => adminHardDeletePost('p-1', 'spam')],
    ['masquage d\'avis',      () => adminSoftDeleteReview('r-1', 'spam', 1)],
    ['purge d\'avis',         () => adminHardDeleteReview('r-1', 'spam')],
    ['mise en sourdine',      () => adminMuteUser('u-1', 'spam', 7)],
    ['levée de sourdine',     () => adminUnmuteUser('u-1', 'appel accepté')],
  ]
  for (const [nom, action] of cas) {
    it(`${nom} : erreur remontée, aucun journal`, async () => {
      mockRpc.mockResolvedValue(ECHEC)
      const res = await action()
      expect(res).toEqual({ error: 'RLS refuse' })
      expect(mockLog).not.toHaveBeenCalled()
    })
  }
})

describe('Mise en sourdine — les bornes de durée', () => {
  it('refuse une durée hors bornes SANS toucher à la base', async () => {
    for (const jours of [0, -1, 366, 10_000]) {
      mockRpc.mockReset(); mockLog.mockReset()
      const res = await adminMuteUser('u-1', 'spam', jours)
      expect(res, `durée ${jours} acceptée à tort`).toEqual({ error: 'duration_out_of_bounds' })
      expect(mockRpc).not.toHaveBeenCalled()
      expect(mockLog).not.toHaveBeenCalled()
    }
  })

  it('accepte les bornes elles-mêmes (1 et 365 jours)', async () => {
    for (const jours of [1, 365]) {
      mockRpc.mockReset(); mockRpc.mockResolvedValue(OK)
      const res = await adminMuteUser('u-1', 'spam', jours)
      expect(res.ok, `durée ${jours} refusée à tort`).toBe(true)
      expect(typeof res.until).toBe('string')
    }
  })

  it('⚠️ omettre la durée rend la sourdine PERMANENTE — comportement voulu, mais piégeux', async () => {
    // `adminMuteUser(id, reason)` sans troisième argument ne lève pas : il pose
    // une sourdine jusqu'en 9999. C'est le contrat documenté du module (« pour
    // mute permanent, passer durationDays = null »), mais l'oubli d'un argument
    // produit silencieusement la sanction la plus lourde. Ce test le fige pour
    // qu'un changement soit une décision, et le rend visible à la lecture.
    mockRpc.mockResolvedValue(OK)
    const res = await adminMuteUser('u-1', 'spam')
    expect(res.until).toBe('9999-12-31T23:59:59Z')
    expect(mockLog).toHaveBeenCalledWith(AUDIT_ACTIONS.COMMUNITY_USER_MUTED, expect.objectContaining({
      metadata: expect.objectContaining({ duration_days: null }),
    }))
  })

  it('la levée de sourdine passe bien une échéance nulle', async () => {
    mockRpc.mockResolvedValue(OK)
    await adminUnmuteUser('u-1', 'appel accepté')
    expect(mockRpc).toHaveBeenCalledWith('admin_community_set_mute', { p_user_id: 'u-1', p_until: null })
    expect(mockLog).toHaveBeenCalledWith(AUDIT_ACTIONS.COMMUNITY_USER_UNMUTED, expect.anything())
  })
})


describe('Vues de modération — les trois statuts doivent rester DISTINCTS', () => {
  // Ce n'est pas de la couverture de confort : c'est ce qui décide de ce que le
  // modérateur voit. Si « supprimé par l'auteur » et « masqué par un admin »
  // se confondent, la liste ment sur l'état réel du contenu — et un contenu
  // signalé peut disparaître de la vue censée le traiter.
  it("« actif » ne montre que ce qui n'est pas supprimé", async () => {
    const c = chaine({ data: [], error: null }); mockFrom.mockReturnValue(c)
    await adminListPosts({ status: 'active' })
    expect(c.is).toHaveBeenCalledWith('deleted_at', null)
    expect(c.eq).not.toHaveBeenCalledWith('deleted_by_admin', true)
  })

  it("« supprimé par l'auteur » exclut explicitement les masquages admin", async () => {
    const c = chaine({ data: [], error: null }); mockFrom.mockReturnValue(c)
    await adminListPosts({ status: 'deleted' })
    expect(c.not).toHaveBeenCalledWith('deleted_at', 'is', null)
    expect(c.eq).toHaveBeenCalledWith('deleted_by_admin', false)
  })

  it('« masqué par un admin » ne retient que ceux-là', async () => {
    const c = chaine({ data: [], error: null }); mockFrom.mockReturnValue(c)
    await adminListPosts({ status: 'admin_deleted' })
    expect(c.eq).toHaveBeenCalledWith('deleted_by_admin', true)
    expect(c.is).not.toHaveBeenCalled()
  })

  it("« tous » n'applique aucun filtre d'état", async () => {
    const c = chaine({ data: [], error: null }); mockFrom.mockReturnValue(c)
    await adminListPosts({ status: 'all' })
    expect(c.is).not.toHaveBeenCalled()
    expect(c.not).not.toHaveBeenCalled()
  })

  it('les avis appliquent les mêmes trois filtres, plus le type « review »', async () => {
    const c = chaine({ data: [], error: null }); mockFrom.mockReturnValue(c)
    await adminListReviews({ status: 'admin_deleted' })
    // Sans ce filtre de type, la vue mélangerait les avis aux autres formes
    // d'engagement stockées dans la même table.
    expect(c.eq).toHaveBeenCalledWith('type', 'review')
    expect(c.eq).toHaveBeenCalledWith('deleted_by_admin', true)
  })

  it('une recherche vide ne pose pas de filtre texte', async () => {
    const c = chaine({ data: [], error: null }); mockFrom.mockReturnValue(c)
    await adminListPosts({ search: '   ' })
    expect(c.ilike).not.toHaveBeenCalled()
  })

  it('une recherche est appliquée sur le titre, sans espaces parasites', async () => {
    const c = chaine({ data: [], error: null }); mockFrom.mockReturnValue(c)
    await adminListPosts({ search: '  arnaque  ' })
    expect(c.ilike).toHaveBeenCalledWith('title', '%arnaque%')
  })

  it('un échec de listage rend une liste vide plutôt que de casser la page admin', async () => {
    mockFrom.mockReturnValue(chaine({ data: null, error: { message: 'boum' } }))
    expect(await adminListPosts({})).toEqual([])
  })
})
