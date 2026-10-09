import { supabase } from '@shared/lib/supabase/client'
import {
  searchOfficialRecipes as searchOfficialRecipesRepo,
  searchCommunityRecipes as searchCommunityRecipesRepo,
} from '@shared/lib/recipes/recipes-repository'
import {
  MAX_OPEN_TICKETS,
  OPEN_TICKET_STATUSES,
} from '@shared/lib/support/open-tickets-cap'
import { ouvrirTicket } from '@shared/api/reports'
import { auMoinsUneLigne } from '@shared/lib/supabase/rows-affected'
import { versErreur } from '@shared/lib/supabase/lever-si-erreur'
import { motifDansOu } from '@shared/lib/supabase/motif-de-recherche'

export async function getUserTickets(userId) {
  const { data } = await supabase
    .from('support_tickets')
    .select('id, type, title, status, has_unread_user, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// `{ messages, error }` : rendus vides sur erreur, les messages d'un ticket
// s'affichaient « Aucun message dans ce ticket » — chez l'admin comme chez
// l'utilisateur (audit ADM-08).
export async function getTicketMessages(ticketId) {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, sender_id, is_admin, content, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  return { messages: data ?? [], error: error ?? null }
}

// Ouvre un ticket ET y pose la question, d'un seul coup (fonction
// `ouvrir_ticket`, migration `20261005_signalements_et_tickets_qui_aboutissent`).
// Avant le 2026-10-05 : ticket d'abord, question ensuite, sans regarder le
// résultat — un refus laissait un ticket vide (une des 3 places), le texte
// perdu, « bien reçu » à l'écran ; et la question n'entrait pas dans la
// pastille de l'admin (`has_unread_admin` jamais posé).
export async function createTicket(userId, { type, title, message }) {
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('type', 'report')
    .in('status', OPEN_TICKET_STATUSES)
  if ((count ?? 0) >= MAX_OPEN_TICKETS) return { error: { message: 'max_tickets_reached' } }

  return ouvrirTicket({
    p_type:        type,
    p_title:       title,
    p_message:     message?.trim() || null,
    p_target_type: null,
    p_target_id:   null,
    p_reason_key:  null,
  })
}

// « Non lu par l'admin » est posé par la base à chaque message d'un
// utilisateur (déclencheur `trg_ticket_non_lu_admin`) : le navigateur s'en
// chargeait après coup, sans vérifier.
export async function sendUserMessage(ticketId, userId, content) {
  const { error } = await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: userId,
    is_admin: false,
    content,
  })
  return { error }
}

export async function markTicketReadByUser(ticketId) {
  const { error } = await supabase.from('support_tickets')
    .update({ has_unread_user: false })
    .eq('id', ticketId)
  return { error: error ?? null }
}

export async function countUnreadTickets(userId) {
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('has_unread_user', true)
  return count ?? 0
}

// Un échec LÈVE : rendu vide, il s'affichait « Aucun ticket » (audit ADM-08).
// Les pseudos, eux, sont un détail : s'ils n'arrivent pas, les tickets restent.
export async function adminGetAllTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, user_id, type, title, status, has_unread_user, has_unread_admin, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw versErreur(error)
  if (!data?.length) return []
  const userIds = [...new Set(data.map(t => t.user_id))]
  const { data: profiles } = await supabase
    .from('profiles').select('id, username').in('id', userIds)
  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p.username]))
  return data.map(t => ({ ...t, username: byId[t.user_id] ?? null }))
}

export async function adminReplyTicket(ticketId, adminId, content, lang = 'fr') {
  const { error } = await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: adminId,
    is_admin: true,
    content,
  })
  // « Non lu par l'utilisateur », « lu par l'admin », « en cours » : posés par
  // la base dans la MÊME transaction que le message (déclencheur
  // `trg_ticket_repondu`, 2026-10-05). C'était une seconde écriture du
  // navigateur, dont le résultat était jeté (audit ADM-02).
  if (!error) {
    // Notif email au user via Edge Function (non bloquant — si l'envoi
    // échoue, le ticket est quand même mis à jour et la notif in-app
    // reste affichée). Wrap dans IIFE async + try/catch pour rester
    // résilient si supabase.functions n'est pas dispo (tests, env legacy).
    ;(async () => {
      try {
        await supabase.functions?.invoke('send-ticket-notification', {
          body: { ticketId, messageContent: content, lang },
        })
      } catch (err) {
        console.error('[adminReplyTicket] email notification failed:', err)
      }
    })()
  }
  return { error }
}

export async function adminSetTicketStatus(ticketId, status) {
  const patch = { status }
  if (status === 'resolved') patch.has_unread_admin = false
  const resultat = await supabase.from('support_tickets').update(patch).eq('id', ticketId).select('id')
  return { error: auMoinsUneLigne(resultat).error }
}

// Les comptages LÈVENT sur erreur : un 0 se lisait « rien à traiter » (ADM-08).
export async function adminCountOpenTickets() {
  const { count, error } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress'])
  if (error) throw versErreur(error)
  return count ?? 0
}

export async function adminCountUnreadTickets() {
  const { count, error } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('has_unread_admin', true)
  if (error) throw versErreur(error)
  return count ?? 0
}

// Rend `{ error }` : la pastille de l'admin ne doit baisser que si la base a
// bien marqué le ticket (audit ADM-02).
export async function markTicketReadByAdmin(ticketId) {
  const resultat = await supabase.from('support_tickets')
    .update({ has_unread_admin: false })
    .eq('id', ticketId)
    .select('id')
  return { error: auMoinsUneLigne(resultat).error }
}

// ⚠️ La règle de suppression de `support_messages` et `support_tickets` est
// « admin seulement » (prouvé le 2026-10-05) : pour un compte, ces requêtes
// touchent 0 ligne SANS erreur. Elles demandent donc les lignes touchées, et
// 0 ligne est un échec — avant, l'écran retirait un message toujours en base.
// Accorder ce droit au propriétaire est une décision (Antoine).
export async function deleteUserMessage(messageId, userId) {
  const resultat = await supabase
    .from('support_messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', userId)
    .eq('is_admin', false)
    .select('id')
  return { error: auMoinsUneLigne(resultat).error }
}

export async function adminDeleteMessage(messageId) {
  const resultat = await supabase
    .from('support_messages')
    .delete()
    .eq('id', messageId)
    .eq('is_admin', true)
    .select('id')
  return { error: auMoinsUneLigne(resultat).error }
}

// Suppression d'un message utilisateur par l'admin (droit à l'effacement RGPD).
export async function adminDeleteAnyMessage(messageId) {
  const resultat = await supabase
    .from('support_messages')
    .delete()
    .eq('id', messageId)
    .select('id')
  return { error: auMoinsUneLigne(resultat).error }
}

// Une seule requête : les messages suivent par la clé étrangère (ON DELETE
// CASCADE). Le premier `delete` des messages, dont le résultat était jeté,
// pouvait vider un ticket qui restait ensuite en place (audit ADM-02).
export async function adminDeleteTicket(ticketId) {
  const resultat = await supabase.from('support_tickets').delete().eq('id', ticketId).select('id')
  return { error: auMoinsUneLigne(resultat).error }
}

// Une seule requête, sur le ticket : ses messages partent avec lui (clé
// étrangère `ON DELETE CASCADE`). Avant, les messages étaient supprimés
// d'abord, sans regarder : si le ticket échouait ensuite, la conversation
// était à moitié détruite.
export async function deleteUserTicket(ticketId, userId) {
  const resultat = await supabase
    .from('support_tickets')
    .delete()
    .eq('id', ticketId)
    .eq('user_id', userId)
    .select('id')
  return { error: auMoinsUneLigne(resultat).error }
}

export async function updateTicketTitle(ticketId, userId, title) {
  const { error } = await supabase.from('support_tickets').update({ title }).eq('id', ticketId).eq('user_id', userId)
  return { error }
}

// ─── Recherche contextuelle pour le formulaire de signalement ────────────────

// Sprint 5f : délégué au repository (centralisation).
export async function searchBaseRecipes(query, lang = 'fr') {
  return searchOfficialRecipesRepo(query, lang)
}

export async function searchCommunityRecipes(query) {
  return searchCommunityRecipesRepo(query)
}

export async function searchIngredients(query, lang = 'fr') {
  if (!query?.trim()) return []
  const m = motifDansOu(query)
  const { data } = await supabase
    .from('ingredients')
    .select('id, labels, emoji')
    .or(`id.ilike.${m},labels->>${lang}.ilike.${m},labels->>fr.ilike.${m}`)
    .limit(8)
  return (data ?? []).map(r => ({
    id: r.id,
    label: (typeof r.labels === 'object' ? (r.labels[lang] ?? r.labels.fr ?? r.labels.en) : r.labels) ?? r.id,
    emoji: r.emoji ?? '🥕',
  }))
}

// Par la fonction `search_public_profiles` de la base : lue dans `profiles`,
// la recherche ne trouvait jamais personne d'autre que soi (la table ne se lit
// que pour sa propre ligne — audit du 2026-10-04, BDD-13). La fonction ne
// propose ni l'admin, ni un compte supprimé, ni soi-même, ni un compte qui n'a
// rien publié de visible ; 2 caractères au moins, 8 résultats.
export async function searchUsersForReport(query) {
  const q = query?.trim()
  if (!q) return []
  const { data, error } = await supabase.rpc('search_public_profiles', { p_query: q })
  if (error) {
    if (import.meta.env.DEV) console.error('[support] searchUsersForReport:', error.message)
    return []
  }
  return (data ?? []).map(u => ({ id: u.id, label: u.username ?? u.id, emoji: '👤' }))
}
