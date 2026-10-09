import { supabase } from '@shared/lib/supabase/client'

// Couche d'accès BDD pour les notifications.
//
// Les INSERT sont gérés exclusivement par les triggers Postgres définis
// dans supabase/migrations/20260502_notifications.sql (atomicité avec les
// événements source : ticket reply, recipe submitted, recipe status change).
// Le client ne peut donc QUE lire / marquer lu / supprimer ses propres
// notifs (RLS).

const PER_PAGE = 30

// Charge les notifs de l'utilisateur courant (les plus récentes d'abord).
// On exclut les expirées au cas où le job pg_cron de purge ne soit pas
// encore en place (ou en retard).
//
// Le filtre `recipient_id IS NOT NULL` exclut les notifications
// broadcast admin (qui ont `recipient_id IS NULL` + `recipient_role = 'admin'`).
// Sans ce filtre, l'admin voyait dans sa cloche personnelle les broadcasts
// admin (ex: « Nouvelle recette à modérer ») mais NE POUVAIT PAS les
// supprimer ni les marquer lues — la RLS `notifications_delete_own` /
// `notifications_update_own` exige `recipient_id = auth.uid()`. Résultat :
// l'optimistic update local réussissait, mais au refresh la notif
// réapparaissait, et le badge restait collé à un compteur trompeur.
// Les broadcasts admin sont gérés dans le panel admin dédié via
// `getAdminFeed()` (lecture partagée, sans state lu/non-lu).
export async function getMyNotifications({ page = 0, unreadOnly = false } = {}) {
  let q = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .not('recipient_id', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1)

  if (unreadOnly) q = q.is('read_at', null)

  const { data, count, error } = await q
  return { data: data ?? [], count: count ?? 0, error }
}

// Compteur des notifs non lues — pour le badge sur la cloche.
// Idem : filtre `recipient_id IS NOT NULL` pour ne compter que les notifs
// personnelles non lues (cf. commentaire de getMyNotifications ci-dessus).
export async function countUnreadNotifications() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .not('recipient_id', 'is', null)
    .is('read_at', null)
    .gt('expires_at', new Date().toISOString())
  if (error) return 0
  return count ?? 0
}

// Marquer une notif comme lue. RLS empêche de marquer celle d'un autre user.
export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null)
  return { error }
}

// Marquer toutes ses notifs non lues comme lues d'un coup.
export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  return { error }
}

// Supprimer une notif (par exemple un user qui veut nettoyer sa liste).
export async function deleteNotification(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
  return { error }
}

// Supprimer toutes les notifs lues d'un coup.
export async function deleteAllReadNotifications() {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .not('read_at', 'is', null)
  return { error }
}

// Compteur par type pour les onglets du panel admin — même filtre exact
// que getAdminFeed (recipient_id IS NULL AND recipient_role='admin').
// Important : ne PAS grouper sur toute la table par type — les broadcasts
// (Annonce/Maintenance) génèrent N lignes user (role='user') en plus de
// leur unique ligne d'archive admin ; sans ce filtre, le compteur
// compterait N+1 au lieu de 1 par envoi.
export async function getAdminFeedCounts() {
  const { data, error } = await supabase
    .from('notifications')
    .select('type')
    .is('recipient_id', null)
    .eq('recipient_role', 'admin')
    .gt('expires_at', new Date().toISOString())
  if (error) return { counts: {}, error }
  const counts = {}
  for (const row of data ?? []) counts[row.type] = (counts[row.type] ?? 0) + 1
  return { counts, error: null }
}

// Pour la section admin — feed des broadcast (recipient_id IS NULL).
// Ne nécessite pas de marquer lu (lecture partagée entre admins).
export async function getAdminFeed({ page = 0, type = null } = {}) {
  let q = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .is('recipient_id', null)
    .eq('recipient_role', 'admin')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1)
  if (type) q = q.eq('type', type)
  const { data, count, error } = await q
  return { data: data ?? [], count: count ?? 0, error }
}

// Admin : supprimer une notification broadcast (feed admin). Passe par la
// RPC admin_delete_notification_batch qui supprime tout le batch (toutes
// les copies utilisateur + l'archive admin) si la ligne cible en a un —
// sinon supprime juste cette ligne (items créés par trigger, ex.
// recipe_pending, pas de batch_id).
export async function adminDeleteNotification(id) {
  const { data, error } = await supabase.rpc('admin_delete_notification_batch', { p_notification_id: id })
  return { data, error }
}

// Admin : envoyer une notification broadcast (tous les users) ou ciblée
// (un user_id précis). Utilise la RPC `admin_send_notification` qui vérifie
// is_admin() côté Postgres et bypasse la contrainte triggers-only.
// Signature RPC attendue :
//   admin_send_notification(
//     p_type text, p_title jsonb, p_body jsonb,
//     p_metadata jsonb, p_recipient_id uuid, p_expires_days int
//   )
export async function adminSendNotification({
  type,
  titleFr, titleEn = titleFr,
  bodyFr = null, bodyEn = null,
  metadata = {},
  recipientId = null,   // null = broadcast tous users
  expiresDays = 30,
}) {
  const title = { fr: titleFr, en: titleEn, es: titleFr, de: titleFr, ja: titleFr }
  const body  = bodyFr ? { fr: bodyFr, en: bodyEn ?? bodyFr, es: bodyFr, de: bodyFr, ja: bodyFr } : null

  const { data, error } = await supabase.rpc('admin_send_notification', {
    p_type:         type,
    p_title:        title,
    p_body:         body,
    p_metadata:     metadata,
    p_recipient_id: recipientId,
    p_expires_days: expiresDays,
  })
  return { data, error }
}

// Admin : déclenche l'envoi push natif pour un broadcast Annonce/Maintenance
// (Message ciblé exclu — rejeté aussi côté serveur si tenté, cf.
// send-announcement-push). Appelée en fire-and-forget juste après le succès
// de adminSendNotification : un échec ici n'est jamais remonté à l'UI
// (l'in-app reste le canal de vérité).
export async function sendAnnouncementPush({ type, titleFr, titleEn = titleFr, bodyFr = null, bodyEn = null }) {
  const { data, error } = await supabase.functions.invoke('send-announcement-push', {
    body: {
      type,
      title: { fr: titleFr, en: titleEn },
      body: bodyFr ? { fr: bodyFr, en: bodyEn ?? bodyFr } : null,
    },
  })
  return { data, error }
}
