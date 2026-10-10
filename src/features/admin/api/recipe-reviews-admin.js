import { supabase } from '@shared/lib/supabase/client'
import { logAuditAction, AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from '../lib/audit'
import { versErreur } from '@shared/lib/supabase/lever-si-erreur'
import { motifContient } from '@shared/lib/supabase/motif-de-recherche'
import { OPEN_TICKET_STATUSES } from '@shared/lib/support/open-tickets-cap'

// Modération admin des avis recettes.
//
// RPC SECURITY DEFINER `admin_review_soft_delete` / `admin_review_hard_delete`
// côté base : la règle UPDATE ne laisse passer que l'auteur ; la RPC refuse
// l'appel si `public.is_admin()` est faux (« forbidden: admin only »).
//
// Toutes les actions sont auditées via logAuditAction (vocabulaire
// fermé + metadata whitelistée). Cohérent avec communityAdmin.

// Refonte BDD Sprint 6d — PR-DB-16b : reads admin reviews depuis engagement
// (sync triggers PR-DB-15 garantissent no drift). Le shape consumer attend
// `recipe_id` + `recipe_source` ('base'/'community'), donc on alias
// target_recipe_id et on joint recipes_unified.origin pour calculer
// recipe_source côté JS.
const REVIEW_ADMIN_SELECT_ENGAGEMENT =
  'id, user_id, target_recipe_id, rating, body, created_at, updated_at, deleted_at, deleted_by_admin, profile:profiles!user_id(username, avatar_id), recipe:recipes_unified!target_recipe_id(origin)'

function mapEngagementAdminRow(row) {
  const origin = row.recipe?.origin
  return {
    ...row,
    recipe_id: row.target_recipe_id,
    recipe_source: origin === 'community' ? 'community' : 'base',
  }
}

// ─── Listing avis (admin) ──────────────────────────────────────────────

/**
 * Liste les avis pour vue admin avec filtre status.
 * @param {object} opts
 * @param {'all'|'active'|'deleted'|'admin_deleted'} opts.status — défaut 'active'
 * @param {string=} opts.search — recherche dans le body (case-insensitive)
 * @param {number=} opts.limit — défaut 50
 */
export async function adminListReviews({ status = 'active', search, limit = 50 } = {}) {
  let q = supabase.from('engagement').select(REVIEW_ADMIN_SELECT_ENGAGEMENT).eq('type', 'review')
  if (status === 'active')             q = q.is('deleted_at', null)
  else if (status === 'deleted')       q = q.not('deleted_at', 'is', null).eq('deleted_by_admin', false)
  else if (status === 'admin_deleted') q = q.eq('deleted_by_admin', true)
  // 'all' = pas de filtre
  if (search?.trim()) q = q.ilike('body', motifContient(search))
  q = q.order('created_at', { ascending: false }).limit(limit)
  const { data, error } = await q
  // Un échec LÈVE : rendu vide, il s'affichait « Aucun avis » (audit ADM-08).
  if (error) {
    if (import.meta.env.DEV) console.error('[recipeReviewsAdmin] list:', error.message)
    throw versErreur(error)
  }
  return (data ?? []).map(mapEngagementAdminRow)
}

/** Liste les signalements ouverts liés aux avis recettes. */
export async function adminListReviewReports({ limit = 50 } = {}) {
  // Pas de colonne `body` sur support_tickets (le contenu vit dans
  // support_messages.first_message). Le `reason_key` structuré suffit ici
  // pour le badge et l'arbitrage admin ; si on a besoin du commentaire libre
  // un jour, ajouter une 2e query sur support_messages.
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, user_id, target_id, reason_key, created_at, status')
    .eq('type', 'report')
    .eq('target_type', 'recipe_review')
    // `neq('closed')` ne retirait rien (statuts : open, in_progress, resolved).
    .in('status', OPEN_TICKET_STATUSES)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.error('[recipeReviewsAdmin] listReports:', error.message)
    throw versErreur(error)
  }
  return data ?? []
}

// ─── Modération ────────────────────────────────────────────────────────

/**
 * Soft-delete admin d'un avis. L'auteur ne peut pas restaurer
 * (la policy UPDATE auteur exige deleted_by_admin = false).
 *
 * @param {string} reviewId
 * @param {string} reason — raison libre (audit + metadata)
 * @param {number=} reportedCount — info audit
 */
export async function adminSoftDeleteReview(reviewId, reason, reportedCount) {
  const { error } = await supabase.rpc('admin_review_soft_delete', {
    p_review_id: reviewId,
  })
  if (error) return { error: error.message }
  await logAuditAction(AUDIT_ACTIONS.RECIPE_REVIEW_DELETED, {
    targetId: reviewId,
    targetType: AUDIT_TARGET_TYPES.RECIPE_REVIEW,
    metadata: { reason, reported_count: reportedCount },
  })
  return { ok: true }
}

export async function adminHardDeleteReview(reviewId, reason) {
  const { error } = await supabase.rpc('admin_review_hard_delete', {
    p_review_id: reviewId,
  })
  if (error) return { error: error.message }
  await logAuditAction(AUDIT_ACTIONS.RECIPE_REVIEW_PURGED, {
    targetId: reviewId,
    targetType: AUDIT_TARGET_TYPES.RECIPE_REVIEW,
    metadata: { reason },
  })
  return { ok: true }
}
