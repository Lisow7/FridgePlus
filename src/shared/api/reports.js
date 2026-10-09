// src/lib/db/reports.js
// ============================================================
// Module DB pour les signalements (v3.3.17).
// ------------------------------------------------------------
// Note d'archi : les signalements vivent dans `support_tickets` avec
// `type = 'report'` + 3 colonnes structurées (target_type, target_id,
// reason_key — ajoutées en v3.3.17). On évite ainsi la duplication
// avec un système parallèle.
//
// Helpers ici = vue dédiée « signalements » par-dessus support_tickets.
// Les helpers conversation (réponses, status…) restent dans support.js.
// ============================================================

import { supabase } from '@shared/lib/supabase/client'
import {
  findCommunityRecipeTitlesByIds,
  findOfficialRecipeNamesByIds,
} from '@shared/lib/recipes/recipes-repository'
import {
  MAX_OPEN_TICKETS,
  OPEN_TICKET_STATUSES,
  estRefusDePlafond,
} from '@shared/lib/support/open-tickets-cap'

// ─── Whitelists (cohérence avec les CHECK constraints SQL) ───────────────────

export const REPORT_TARGET_TYPES = ['recipe', 'user', 'comment', 'ingredient']
export const REPORT_REASON_KEYS  = [
  'spam',
  'inappropriate',
  'allergen_error',
  'wrong_info',
  'plagiarism',
  'harassment',
  'other',
]
export const REPORT_STATUSES = ['open', 'in_progress', 'resolved']

// ─── Côté user : créer un signalement ────────────────────────────────────────
//
// Crée un ticket support type='report' avec les 3 colonnes structurées.
// Le titre est généré automatiquement à partir du target_type + reason.

export async function createReport({ targetType, targetId, reasonKey, reasonDetails, userTitle }) {
  if (!REPORT_TARGET_TYPES.includes(targetType)) return { error: { message: 'Invalid target_type' } }
  if (!REPORT_REASON_KEYS.includes(reasonKey))   return { error: { message: 'Invalid reason_key' } }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not authenticated' } }

  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', OPEN_TICKET_STATUSES)
  if ((count ?? 0) >= MAX_OPEN_TICKETS) return { error: { message: 'max_tickets_reached' } }

  const title = userTitle?.trim() || `Signalement ${targetType} (${reasonKey})`

  // 1. Créer le ticket support type='report'
  const { data: ticket, error } = await supabase.from('support_tickets').insert({
    user_id:     user.id,
    type:        'report',
    title,
    status:      'open',
    target_type: targetType,
    target_id:   String(targetId),
    reason_key:  reasonKey,
    has_unread_admin: true,
  }).select('id').single()

  // Le compteur ci-dessus a laissé passer, mais la policy RLS a refusé : deux
  // signalements envoyés en même temps. On rend le message que l'UI sait
  // afficher plutôt que l'erreur Postgres brute.
  if (estRefusDePlafond(error)) return { error: { message: 'max_tickets_reached' } }
  if (error) return { error }

  // 2. Si l'utilisateur a fourni des détails, les poser comme premier message du fil
  if (reasonDetails?.trim()) {
    await supabase.from('support_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      is_admin:  false,
      content:   reasonDetails.trim(),
    })
  }

  return { error: null, data: ticket }
}

// ─── Côté admin : liste + count ──────────────────────────────────────────────

export async function adminGetReports({ status = null, targetType = null, reasonKey = null, page = 0, perPage = 50 } = {}) {
  let query = supabase
    .from('support_tickets')
    .select('id, user_id, type, title, status, target_type, target_id, reason_key, created_at, updated_at, has_unread_admin', { count: 'exact' })
    .eq('type', 'report')
    .order('has_unread_admin', { ascending: false })
    .order('created_at',       { ascending: false })
    .range(page * perPage, (page + 1) * perPage - 1)

  if (status)     query = query.eq('status', status)
  if (targetType) query = query.eq('target_type', targetType)
  if (reasonKey)  query = query.eq('reason_key', reasonKey)

  const { data, error, count } = await query
  if (error || !data?.length) return { data: data ?? [], count: count ?? 0, error }

  // Joindre les usernames des reporters
  const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))]
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, username, banned').in('id', userIds)
    : { data: [] }
  const byUser = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // Joindre le titre de la cible (recette custom ou base uniquement pour l'instant)
  const recipeIds = data.filter(r => r.target_type === 'recipe' && r.target_id).map(r => r.target_id)
  let recipeNames = {}
  if (recipeIds.length) {
    // Sprint 5f : délégué au repository (centralise les fetch par IDs)
    const [custom, base] = await Promise.all([
      findCommunityRecipeTitlesByIds(recipeIds),
      findOfficialRecipeNamesByIds(recipeIds),
    ])
    for (const r of custom) recipeNames[r.id] = r.title
    for (const r of base) recipeNames[r.id] = typeof r.name === 'object' ? (r.name.fr ?? r.name.en ?? '') : r.name
  }

  return {
    data: data.map(r => ({
      ...r,
      reporter_username: byUser[r.user_id]?.username ?? null,
      reporter_banned:   byUser[r.user_id]?.banned   ?? false,
      target_label:      r.target_type === 'recipe' ? (recipeNames[r.target_id] ?? null) : null,
    })),
    count: count ?? 0,
    error,
  }
}

export async function adminCountReports({ status = 'open' } = {}) {
  const { count, error } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'report')
    .eq('status', status)
  return { count: count ?? 0, error }
}

// Wrapper d'écriture status — délègue à support.adminSetTicketStatus
// pour garder le workflow de notifications/audit cohérent avec les tickets.
// Note (Sprint 9 S9.a.6) : les fonctions de gestion de cycle de vie
// (update status, delete, reply) vivent dans `@features/support/api/support`
// car les signalements sont stockés dans `support_tickets`. Les consommateurs
// admin importent directement depuis `@features/support` (autorisé via
// ADMIN_BRIDGES). Pas de re-export ici pour respecter le flux unidirectionnel
// `shared → features`.
