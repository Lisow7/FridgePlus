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
  MAX_OPEN_REPORTS,
  OPEN_TICKET_STATUSES,
  estRefusDePlafond,
} from '@shared/lib/support/open-tickets-cap'

// ─── Whitelists (cohérence avec les CHECK constraints SQL) ───────────────────

// Toutes les cibles qu'accepte la contrainte `chk_support_tickets_target_type`.
// Les quatre dernières étaient signalées par des fonctions à part, qui
// n'aboutissaient JAMAIS (colonne `body` inexistante, `title` oublié — prouvé
// le 2026-10-05) : elles passent maintenant toutes par `createReport`.
export const REPORT_TARGET_TYPES = [
  'recipe', 'user', 'comment', 'ingredient',
  'community_post', 'community_reply', 'community_profile', 'recipe_review',
]

// Le titre d'un signalement, quand l'écran n'en donne pas : lu par l'admin.
const LIBELLES_CIBLE = {
  recipe: 'recette', user: 'utilisateur', comment: 'commentaire', ingredient: 'ingrédient',
  community_post: 'post de la communauté', community_reply: 'réponse de la communauté',
  community_profile: 'profil de la communauté', recipe_review: 'avis sur une recette',
}
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
// Crée un ticket support type='report' avec les 3 colonnes structurées, et y
// joint le détail du motif — D'UN SEUL COUP, par la fonction `ouvrir_ticket`
// de la base (migration `20261005_signalements_et_tickets_qui_aboutissent`) :
// si le détail ne peut pas être joint, rien n'est créé. Avant le 2026-10-05,
// le détail était inséré après coup sans regarder le résultat : un refus
// laissait un signalement sans son texte, annoncé « envoyé ».
//
// Rend `{ error: null, data: { id } }`, ou `{ error }` dont le `message` vaut
// `max_tickets_reached` ou `account_restricted` quand l'écran sait le dire.

export async function createReport({ targetType, targetId, reasonKey, reasonDetails, userTitle }) {
  if (!REPORT_TARGET_TYPES.includes(targetType)) return { error: { message: 'Invalid target_type' } }
  if (!REPORT_REASON_KEYS.includes(reasonKey))   return { error: { message: 'Invalid reason_key' } }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not authenticated' } }

  // Les signalements ont leur propre plafond : les questions au support ne
  // comptent pas ici (CPT-17).
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('type', 'report')
    .in('status', OPEN_TICKET_STATUSES)
  if ((count ?? 0) >= MAX_OPEN_REPORTS) return { error: { message: 'max_reports_reached' } }

  const title = userTitle?.trim() || `Signalement : ${LIBELLES_CIBLE[targetType]} (${reasonKey})`
  return ouvrirTicket({
    p_type:        'report',
    p_title:       title,
    p_message:     reasonDetails?.trim() || null,
    p_target_type: targetType,
    p_target_id:   String(targetId),
    p_reason_key:  reasonKey,
  })
}

// Appelle `ouvrir_ticket` et traduit ses refus en messages que les écrans
// savent afficher. Partagé avec `createTicket` (features/support).
//   • 42501 : une règle d'accès a refusé — le plafond de tickets ouverts,
//     franchi par deux envois simultanés (le compteur client passe d'abord) ;
//   • `account_restricted` (compte banni ou supprimé) est le message même de
//     l'erreur que lève la fonction : il passe tel quel.
export async function ouvrirTicket(args) {
  let data, error
  try { ({ data, error } = await supabase.rpc('ouvrir_ticket', args)) }
  catch (err) { error = err ?? new Error('unknown') }
  if (estRefusDePlafond(error)) {
    return { error: { message: args.p_type === 'report' ? 'max_reports_reached' : 'max_tickets_reached' }, data: null }
  }
  if (error || !data) return { error: error ?? { message: 'no_ticket' }, data: null }
  return { error: null, data: { id: data } }
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
