import { supabase } from '@shared/lib/supabase/client'
import { logAuditAction, AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../lib/audit'
import { versErreur } from '@shared/lib/supabase/lever-si-erreur'
import { motifContient } from '@shared/lib/supabase/motif-de-recherche'
import { OPEN_TICKET_STATUSES } from '@shared/lib/support/open-tickets-cap'

// Modération admin de la communauté.
//
// Toutes les actions passent par les RPC SECURITY DEFINER `admin_community_*`
// (`admin_community_soft_delete_post`, `admin_community_hard_delete_post`,
// `admin_community_set_mute`) : la base refuse l'appel si `public.is_admin()`
// est faux (« forbidden: admin only », migration
// 20260503_fix_admin_rpc_is_admin_check). Le navigateur ne modifie donc jamais
// le post d'un autre membre en direct — la règle « Authors update own posts »
// l'en empêcherait de toute façon.
//
// Chaque action est ensuite écrite au journal par logAuditAction (vocabulaire
// fermé, métadonnées filtrées).

const POST_ADMIN_SELECT = 'id, user_id, category, title, body, likes_count, replies_count, created_at, updated_at, deleted_at, deleted_by_admin, profile:profiles!user_id(username, avatar_id, community_muted_until)'

// ─── Listing posts (admin) ─────────────────────────────────────────────

/**
 * Liste posts pour vue admin avec filtres.
 * @param {object} opts
 * @param {'all'|'active'|'deleted'|'admin_deleted'} opts.status — défaut 'active'
 * @param {string=} opts.search — recherche dans le titre
 * @param {number=} opts.limit — défaut 50
 */
export async function adminListPosts({ status = 'active', search, limit = 50 } = {}) {
  let q = supabase.from('community_posts').select(POST_ADMIN_SELECT)
  if (status === 'active')        q = q.is('deleted_at', null)
  else if (status === 'deleted')  q = q.not('deleted_at', 'is', null).eq('deleted_by_admin', false)
  else if (status === 'admin_deleted') q = q.eq('deleted_by_admin', true)
  // 'all' = pas de filtre
  if (search?.trim()) q = q.ilike('title', motifContient(search))
  q = q.order('created_at', { ascending: false }).limit(limit)
  const { data, error } = await q
  // Un échec LÈVE : rendu vide, il s'affichait « Aucun post » — « rien à
  // modérer » (audit ADM-08). L'écran (`useReloader`) dit « pas chargé ».
  if (error) {
    if (import.meta.env.DEV) console.error('[communityAdmin] listPosts:', error.message)
    throw versErreur(error)
  }
  return data ?? []
}

/** Liste les signalements ouverts liés à la communauté. */
export async function adminListCommunityReports({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('support_tickets')
    /* v3.17.2 — pas d'embed profiles ici : support_tickets.user_id n'a pas
       de FK déclarée vers profiles que PostgREST puisse résoudre. On
       expose juste user_id ; l'admin peut consulter le profil depuis
       l'onglet Utilisateurs si besoin. */
    .select('id, user_id, type, status, target_type, target_id, reason_key, created_at')
    .eq('type', 'report')
    .in('target_type', ['community_post', 'community_reply'])
    // Les statuts d'un ticket : open, in_progress, resolved. `neq('closed')` ne
    // retirait rien — un signalement résolu restait « à traiter ».
    .in('status', OPEN_TICKET_STATUSES)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.error('[communityAdmin] listReports:', error.message)
    throw versErreur(error)
  }
  return data ?? []
}

// ─── Modération posts ──────────────────────────────────────────────────

/**
 * Soft-delete admin d'un post. L'auteur ne peut pas restaurer (la policy
 * UPDATE auteur exige deleted_by_admin = false).
 *
 * @param {string} postId
 * @param {string} reason — raison libre (audit + metadata)
 * @param {number=} reportedCount — nombre de signalements liés (info audit)
 */
export async function adminSoftDeletePost(postId, reason, reportedCount) {
  // RPC SECURITY DEFINER : bypass RLS pour permettre l'admin d'updater
  // un post dont il n'est pas l'auteur.
  const { error } = await supabase.rpc('admin_community_soft_delete_post', {
    p_post_id: postId,
  })
  if (error) return { error: error.message }
  await logAuditAction(AUDIT_ACTIONS.COMMUNITY_POST_DELETED, {
    targetId: postId,
    targetType: AUDIT_TARGET_TYPES.COMMUNITY_POST,
    metadata: { reason, reported_count: reportedCount },
  })
  return { ok: true }
}

export async function adminHardDeletePost(postId, reason) {
  const { error } = await supabase.rpc('admin_community_hard_delete_post', {
    p_post_id: postId,
  })
  if (error) return { error: error.message }
  await logAuditAction(AUDIT_ACTIONS.COMMUNITY_POST_PURGED, {
    targetId: postId,
    targetType: AUDIT_TARGET_TYPES.COMMUNITY_POST,
    metadata: { reason },
  })
  return { ok: true }
}

// ─── Mute user ─────────────────────────────────────────────────────────

/**
 * Mute un user pour la communauté pendant durationDays jours.
 * Pour mute permanent, passer durationDays = null (date 9999-12-31).
 */
export async function adminMuteUser(userId, reason, durationDays) {
  let until
  if (durationDays === null || durationDays === undefined) {
    until = '9999-12-31T23:59:59Z'
  } else {
    if (durationDays < 1 || durationDays > 365) {
      return { error: 'duration_out_of_bounds' }
    }
    until = new Date(Date.now() + durationDays * 86400_000).toISOString()
  }
  const { error } = await supabase.rpc('admin_community_set_mute', {
    p_user_id: userId,
    p_until: until,
  })
  if (error) return { error: error.message }
  await logAuditAction(AUDIT_ACTIONS.COMMUNITY_USER_MUTED, {
    targetId: userId,
    targetType: AUDIT_TARGET_TYPES.USER,
    metadata: { reason, until_iso: until, duration_days: durationDays ?? null },
  })
  return { ok: true, until }
}

export async function adminUnmuteUser(userId, reason) {
  const { error } = await supabase.rpc('admin_community_set_mute', {
    p_user_id: userId,
    p_until: null,
  })
  if (error) return { error: error.message }
  await logAuditAction(AUDIT_ACTIONS.COMMUNITY_USER_UNMUTED, {
    targetId: userId,
    targetType: AUDIT_TARGET_TYPES.USER,
    metadata: { reason },
  })
  return { ok: true }
}

