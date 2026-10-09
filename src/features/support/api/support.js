import { supabase } from '@shared/lib/supabase/client'
import {
  searchOfficialRecipes as searchOfficialRecipesRepo,
  searchCommunityRecipes as searchCommunityRecipesRepo,
} from '@shared/lib/recipes/recipes-repository'
import {
  MAX_OPEN_TICKETS,
  OPEN_TICKET_STATUSES,
  estRefusDePlafond,
} from '@shared/lib/support/open-tickets-cap'

export async function getUserTickets(userId) {
  const { data } = await supabase
    .from('support_tickets')
    .select('id, type, title, status, has_unread_user, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getTicketMessages(ticketId) {
  const { data } = await supabase
    .from('support_messages')
    .select('id, sender_id, is_admin, content, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function createTicket(userId, { type, title, message }) {
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', OPEN_TICKET_STATUSES)
  if ((count ?? 0) >= MAX_OPEN_TICKETS) return { error: { message: 'max_tickets_reached' } }

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({ user_id: userId, type, title, status: 'open', has_unread_user: false })
    .select('id')
    .single()
  if (error || !ticket) {
    console.error('[createTicket] error:', error?.code, error?.message, error?.details, error?.hint)
    // Le compteur ci-dessus a laissé passer, mais la policy RLS a refusé : deux
    // envois concurrents. On rend le message que l'UI sait afficher plutôt que
    // l'erreur Postgres brute.
    if (estRefusDePlafond(error)) return { error: { message: 'max_tickets_reached' } }
    return { error }
  }

  await supabase.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_id: userId,
    is_admin: false,
    content: message,
  })
  return { data: ticket, error: null }
}

export async function sendUserMessage(ticketId, userId, content) {
  const { error } = await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: userId,
    is_admin: false,
    content,
  })
  if (!error) {
    await supabase.from('support_tickets')
      .update({ has_unread_admin: true })
      .eq('id', ticketId)
  }
  return { error }
}

export async function markTicketReadByUser(ticketId) {
  await supabase.from('support_tickets')
    .update({ has_unread_user: false })
    .eq('id', ticketId)
}

export async function countUnreadTickets(userId) {
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('has_unread_user', true)
  return count ?? 0
}

export async function adminGetAllTickets() {
  const { data } = await supabase
    .from('support_tickets')
    .select('id, user_id, type, title, status, has_unread_user, has_unread_admin, created_at, updated_at')
    .order('created_at', { ascending: false })
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
  if (!error) {
    await supabase.from('support_tickets')
      .update({ has_unread_user: true, has_unread_admin: false, status: 'in_progress' })
      .eq('id', ticketId)

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
  const { error } = await supabase.from('support_tickets').update(patch).eq('id', ticketId)
  return { error }
}

export async function adminCountOpenTickets() {
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress'])
  return count ?? 0
}

export async function adminCountUnreadTickets() {
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('has_unread_admin', true)
  return count ?? 0
}

export async function markTicketReadByAdmin(ticketId) {
  await supabase.from('support_tickets')
    .update({ has_unread_admin: false })
    .eq('id', ticketId)
}

export async function deleteUserMessage(messageId, userId) {
  const { error } = await supabase
    .from('support_messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', userId)
    .eq('is_admin', false)
  return { error }
}

export async function adminDeleteMessage(messageId) {
  const { error } = await supabase
    .from('support_messages')
    .delete()
    .eq('id', messageId)
    .eq('is_admin', true)
  return { error }
}

// Suppression d'un message utilisateur par l'admin (droit à l'effacement RGPD).
export async function adminDeleteAnyMessage(messageId) {
  const { error } = await supabase
    .from('support_messages')
    .delete()
    .eq('id', messageId)
  return { error }
}

export async function adminDeleteTicket(ticketId) {
  await supabase.from('support_messages').delete().eq('ticket_id', ticketId)
  const { error } = await supabase.from('support_tickets').delete().eq('id', ticketId)
  return { error }
}

export async function deleteUserTicket(ticketId, userId) {
  await supabase.from('support_messages').delete().eq('ticket_id', ticketId)
  const { error } = await supabase.from('support_tickets').delete().eq('id', ticketId).eq('user_id', userId)
  return { error }
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
  const s = query.trim().replace(/%/g, '')
  const { data } = await supabase
    .from('ingredients')
    .select('id, labels, emoji')
    .or(`id.ilike.%${s}%,labels->>${lang}.ilike.%${s}%,labels->>fr.ilike.%${s}%`)
    .limit(8)
  return (data ?? []).map(r => ({
    id: r.id,
    label: (typeof r.labels === 'object' ? (r.labels[lang] ?? r.labels.fr ?? r.labels.en) : r.labels) ?? r.id,
    emoji: r.emoji ?? '🥕',
  }))
}

export async function searchUsersForReport(query) {
  if (!query?.trim()) return []
  const s = query.trim().replace(/%/g, '')
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `%${s}%`)
    .neq('role', 'admin')
    .limit(8)
  return (data ?? []).map(u => ({ id: u.id, label: u.username ?? u.id, emoji: '👤' }))
}
