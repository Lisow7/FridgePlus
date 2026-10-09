import { describe, it, expect, vi, beforeEach } from 'vitest'

// `features/notifications/api/notifications.js` — 9 % de lignes exécutées avant
// ce fichier (mesure de couverture du 2026-08-28).
//
// ── Pourquoi ce module mérite mieux ──────────────────────────────────────
// Chacun de ses filtres documente un défaut RÉEL déjà survenu, et aucun n'était
// tenu par un test. Le plus parlant est écrit en toutes lettres dans le module :
//
//   « Sans ce filtre, l'admin voyait dans sa cloche personnelle les broadcasts
//     admin mais NE POUVAIT PAS les supprimer ni les marquer lues — la RLS
//     exige recipient_id = auth.uid(). L'optimistic update local réussissait,
//     mais au refresh la notif réapparaissait, et le badge restait collé à un
//     compteur trompeur. »
//
// 🔴 Un filtre perdu ne casse rien à la compilation, ne déclenche aucun
// avertissement, et ne se voit qu'en production sur un compte admin. C'est la
// même forme que les gardes des lots 13 et 14.
//
// ── Deux paires de filtres qui doivent rester EXACTEMENT opposées ────────
// 1. Cloche personnelle : `recipient_id IS NOT NULL` — les broadcasts dehors.
//    Feed admin : `recipient_id IS NULL` — QUE les broadcasts.
//    Si l'un dérive, l'autre montre ce qu'il ne devrait pas.
// 2. La LISTE et le COMPTEUR du badge doivent appliquer les mêmes filtres :
//    sinon le badge annonce des notifications que la liste ne montre pas.

const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc  = vi.hoisted(() => vi.fn())
const mockInvoke = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: mockFrom, rpc: mockRpc, functions: { invoke: mockInvoke } },
}))

import {
  getMyNotifications, countUnreadNotifications, markNotificationRead,
  markAllNotificationsRead, deleteNotification, deleteAllReadNotifications,
  getAdminFeed, getAdminFeedCounts, adminSendNotification, sendAnnouncementPush,
} from '@features/notifications/api/notifications'

// Chaîne supabase-js « thenable ». `appels` conserve la trace de chaque maillon
// pour pouvoir affirmer qu'un filtre a été posé — ou justement qu'il ne l'a pas été.
function chaine(valeur) {
  const c = {}
  for (const m of ['select', 'not', 'is', 'gt', 'eq', 'order', 'range', 'update', 'delete', 'limit']) {
    c[m] = vi.fn().mockReturnThis()
  }
  c[Symbol.toStringTag] = 'Promise'
  c.then  = (res, rej) => Promise.resolve(valeur).then(res, rej)
  c.catch = (rej)      => Promise.resolve(valeur).catch(rej)
  return c
}

beforeEach(() => { mockFrom.mockReset(); mockRpc.mockReset(); mockInvoke.mockReset() })

describe('Cloche personnelle — les broadcasts admin doivent en être EXCLUS', () => {
  it('🔴 filtre les notifications sans destinataire', async () => {
    const c = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(c)
    await getMyNotifications()

    // LE filtre du bug documenté : sans lui, un admin voit dans sa cloche des
    // notifications que la RLS l'empêche de supprimer ou de marquer lues.
    expect(c.not).toHaveBeenCalledWith('recipient_id', 'is', null)
  })

  it('écarte aussi les notifications expirées, au cas où la purge serait en retard', async () => {
    const c = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(c)
    await getMyNotifications()
    expect(c.gt).toHaveBeenCalledWith('expires_at', expect.any(String))
  })

  it('pagine par tranches de 30, de la plus récente à la plus ancienne', async () => {
    const c = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(c)
    await getMyNotifications({ page: 2 })
    expect(c.range).toHaveBeenCalledWith(60, 89)
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('n\'ajoute le filtre « non lues » que si on le demande', async () => {
    const sans = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(sans)
    await getMyNotifications()
    expect(sans.is).not.toHaveBeenCalledWith('read_at', null)

    mockFrom.mockReset()
    const avec = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(avec)
    await getMyNotifications({ unreadOnly: true })
    expect(avec.is).toHaveBeenCalledWith('read_at', null)
  })

  it('rend une liste vide plutôt que « undefined » quand la base ne renvoie rien', async () => {
    mockFrom.mockReturnValue(chaine({ data: null, count: null, error: { message: 'boum' } }))
    const res = await getMyNotifications()
    expect(res.data).toEqual([])
    expect(res.count).toBe(0)
    expect(res.error).toEqual({ message: 'boum' })
  })
})

describe('Badge — le compteur doit appliquer les MÊMES filtres que la liste', () => {
  it('exclut les broadcasts, les lues et les expirées', async () => {
    const c = chaine({ count: 4, error: null })
    mockFrom.mockReturnValue(c)
    const n = await countUnreadNotifications()

    // Un compteur qui diverge de la liste annonce des notifications
    // introuvables : c'est le « badge collé » du défaut d'origine.
    expect(c.not).toHaveBeenCalledWith('recipient_id', 'is', null)
    expect(c.is).toHaveBeenCalledWith('read_at', null)
    expect(c.gt).toHaveBeenCalledWith('expires_at', expect.any(String))
    expect(n).toBe(4)
  })

  it('rend 0 sur erreur — un badge ne doit jamais afficher « NaN »', async () => {
    mockFrom.mockReturnValue(chaine({ count: null, error: { message: 'boum' } }))
    expect(await countUnreadNotifications()).toBe(0)
  })

  it('rend 0 quand la base ne renvoie pas de compte', async () => {
    mockFrom.mockReturnValue(chaine({ count: null, error: null }))
    expect(await countUnreadNotifications()).toBe(0)
  })
})

describe('Marquage et suppression', () => {
  it('marquer lu ne touche QUE les non lues', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await markNotificationRead('n-1')

    expect(c.eq).toHaveBeenCalledWith('id', 'n-1')
    // Sans ce filtre, re-marquer une notification déjà lue écraserait sa date
    // de lecture d'origine.
    expect(c.is).toHaveBeenCalledWith('read_at', null)
    expect(c.update).toHaveBeenCalledWith({ read_at: expect.any(String) })
  })

  it('« tout marquer lu » ne cible que les non lues', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await markAllNotificationsRead()
    expect(c.is).toHaveBeenCalledWith('read_at', null)
  })

  it('🔴 « supprimer les lues » ne doit JAMAIS emporter les non lues', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await deleteAllReadNotifications()

    // Ce filtre est tout ce qui sépare « nettoyer sa liste » de « tout perdre,
    // y compris ce qu'on n'a pas encore lu ».
    expect(c.not).toHaveBeenCalledWith('read_at', 'is', null)
    expect(c.delete).toHaveBeenCalled()
  })

  it('supprimer une notification cible bien celle demandée', async () => {
    const c = chaine({ error: null })
    mockFrom.mockReturnValue(c)
    await deleteNotification('n-9')
    expect(c.delete).toHaveBeenCalled()
    expect(c.eq).toHaveBeenCalledWith('id', 'n-9')
  })
})

describe('Feed admin — le miroir exact de la cloche personnelle', () => {
  it('ne montre QUE les broadcasts destinés aux admins', async () => {
    const c = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(c)
    await getAdminFeed()

    expect(c.is).toHaveBeenCalledWith('recipient_id', null)
    expect(c.eq).toHaveBeenCalledWith('recipient_role', 'admin')
    // Et surtout : PAS le filtre inverse, sinon les deux vues se confondent.
    expect(c.not).not.toHaveBeenCalledWith('recipient_id', 'is', null)
  })

  it('filtre par type quand on le demande, pas autrement', async () => {
    const sans = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(sans)
    await getAdminFeed()
    expect(sans.eq).not.toHaveBeenCalledWith('type', expect.anything())

    mockFrom.mockReset()
    const avec = chaine({ data: [], count: 0, error: null })
    mockFrom.mockReturnValue(avec)
    await getAdminFeed({ type: 'announcement' })
    expect(avec.eq).toHaveBeenCalledWith('type', 'announcement')
  })

  it('🔴 le compteur admin applique le MÊME filtre — sinon il compte N+1 par envoi', async () => {
    // Documenté dans le module : un broadcast crée N lignes utilisateur EN PLUS
    // de son unique ligne d'archive admin. Sans le filtre, un envoi unique
    // serait compté autant de fois qu'il a de destinataires.
    const c = chaine({ data: [{ type: 'announcement' }, { type: 'announcement' }, { type: 'maintenance' }], error: null })
    mockFrom.mockReturnValue(c)
    const res = await getAdminFeedCounts()

    expect(c.is).toHaveBeenCalledWith('recipient_id', null)
    expect(c.eq).toHaveBeenCalledWith('recipient_role', 'admin')
    expect(res.counts).toEqual({ announcement: 2, maintenance: 1 })
    expect(res.error).toBeNull()
  })

  it('rend un décompte vide sur erreur plutôt que de casser le panneau', async () => {
    mockFrom.mockReturnValue(chaine({ data: null, error: { message: 'boum' } }))
    const res = await getAdminFeedCounts()
    expect(res.counts).toEqual({})
    expect(res.error).toEqual({ message: 'boum' })
  })
})

describe('Envoi admin', () => {
  it('un destinataire nul signifie « à tout le monde »', async () => {
    mockRpc.mockResolvedValue({ data: 'ok', error: null })
    await adminSendNotification({ type: 'announcement', titleFr: 'Bonjour' })

    expect(mockRpc).toHaveBeenCalledWith('admin_send_notification', expect.objectContaining({
      p_type: 'announcement',
      p_recipient_id: null,
      p_expires_days: 30,
    }))
  })

  it('un corps absent reste nul plutôt que de devenir un objet vide', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await adminSendNotification({ type: 'announcement', titleFr: 'Titre' })
    expect(mockRpc.mock.calls[0][1].p_body).toBeNull()
  })

  it('l\'anglais retombe sur le français quand il n\'est pas fourni', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await adminSendNotification({ type: 'announcement', titleFr: 'Titre', bodyFr: 'Corps' })
    const args = mockRpc.mock.calls[0][1]
    expect(args.p_title.fr).toBe('Titre')
    expect(args.p_title.en).toBe('Titre')
    expect(args.p_body.en).toBe('Corps')
  })

  it('un envoi ciblé porte bien son destinataire', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await adminSendNotification({ type: 'message', titleFr: 'Salut', recipientId: 'u-7', expiresDays: 7 })
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_recipient_id: 'u-7', p_expires_days: 7 })
  })

  it('la poussée native remonte son erreur sans lever — elle est en « au mieux »', async () => {
    // Le module la déclare fire-and-forget : l'in-app reste le canal de vérité,
    // un échec de push ne doit jamais remonter à l'interface.
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'hors ligne' } })
    const res = await sendAnnouncementPush({ type: 'announcement', titleFr: 'Titre' })
    expect(res.error).toEqual({ message: 'hors ligne' })
    expect(mockInvoke).toHaveBeenCalledWith('send-announcement-push', expect.objectContaining({
      body: expect.objectContaining({ type: 'announcement' }),
    }))
  })
})
