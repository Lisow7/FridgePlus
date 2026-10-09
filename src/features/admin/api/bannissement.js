import { supabase } from '@shared/lib/supabase/client'

// Bannir et débannir PAR LA BASE (audit du 2026-10-04, lot 3c-3b ; fenêtre
// validée par Antoine le 2026-10-05).
//
// `adminToggleBan` écrivait `profiles.banned` seul : ni motif, ni durée, et la
// session restait ouverte. `admin_bannir` (lot 3c-3b-1, en base) pose le motif
// et la date de fin, coupe les sessions et refuse la reconnexion jusqu'à
// l'échéance ; il garde ses propres règles (ni soi-même, ni un admin, motif
// obligatoire, 1 à 3 650 jours ou sans fin) et écrit au journal. Ses refus
// deviennent des phrases — jamais le message brut de la base.

const PHRASES = {
  cannot_ban_admin: 'Un admin ne peut pas être banni.',
  cannot_ban_self: 'Tu ne peux pas te bannir toi-même.',
  reason_required: 'Le motif est obligatoire.',
  reason_too_long: 'Le motif est trop long (300 caractères au plus).',
  invalid_duration: 'Cette durée n’est pas permise (1 à 3 650 jours, ou sans fin).',
  user_not_found: 'Ce compte n’existe plus.',
  forbidden: 'Réservé aux admins.',
}

function enPhrase(error, repli) {
  const cle = Object.keys(PHRASES).find((c) => error?.message?.includes(c))
  return { message: cle ? PHRASES[cle] : repli, code: cle ?? error?.code ?? null }
}

// Rend `{ fin, error }` : `fin` est la date de fin (ISO), ou null « sans fin ».
export async function adminBannir(userId, motif, jours) {
  const { data, error } = await supabase.rpc('admin_bannir', { p_user_id: userId, p_motif: motif, p_jours: jours })
  if (error) return { fin: null, error: enPhrase(error, 'Le bannissement n’a pas pu être enregistré. Réessaie.') }
  return { fin: data ?? null, error: null }
}

// L'e-mail au bannissement (choix d'Antoine sur la planche, 2026-10-05) : une
// fois sa session coupée, la personne ne voit plus que « Ce compte est
// suspendu » à la connexion — l'e-mail lui donne le motif, la date de fin et
// l'adresse du support. Best-effort : le bannissement tient même s'il ne part
// pas, mais l'admin le sait.
export async function notifierLeBannissement(userId) {
  try {
    const { data, error } = await supabase.functions.invoke('notifier-bannissement', { body: { userId } })
    return { envoye: !error && data?.sent === true }
  } catch {
    return { envoye: false }
  }
}

export async function adminDebannir(userId) {
  const { error } = await supabase.rpc('admin_debannir', { p_user_id: userId })
  return { error: error ? enPhrase(error, 'Le débannissement n’a pas pu être enregistré. Réessaie.') : null }
}
