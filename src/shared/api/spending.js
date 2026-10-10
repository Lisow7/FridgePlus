import { supabase } from '@shared/lib/supabase/client'

// Analyse dépenses Premium.
// Snapshot d'une "session courses" déclenchée par "J'ai fait mes courses"
// (handleConfirmAddToFridge dans App.jsx).

/**
 * Insère un événement dépense.
 *
 * Sprint 10 S10.c.4 — RGPD Article 21 (opposition au profilage).
 * Avant l'insert, on vérifie `profiles.profiling_opted_out` via la RPC
 * `is_profiling_opted_out`. Si l'utilisateur s'est opposé au profilage,
 * on skip silencieusement (renvoie `{ ok: true, skipped: true }`) sans
 * écrire en BDD. Defense in depth : même si un caller oublie de vérifier
 * le flag côté UI, cette fonction garantit qu'aucune donnée de profilage
 * n'est créée — conformité juridique stricte.
 *
 * @param {string} userId
 * @param {object} payload
 * @param {number} payload.total_eur
 * @param {number} payload.items_count
 * @param {Array<{id, qty, unit, unit_eur}>} payload.items_json
 * @returns {Promise<{ok:true,id?:string,skipped?:true}|{error:string}>}
 */
export async function recordSpendingEvent(userId, { total_eur, items_count, items_json }) {
  if (!userId) return { error: 'invalid' }

  // RGPD Art. 21 — gate enforcé côté API. Si la RPC échoue (ex: réseau
  // ou colonne pas encore appliquée), on log en DEV mais on PROCÈDE à
  // l'insert : la migration S10.c.2 ajoute la colonne avec default
  // `false`, donc l'opt-out est explicite et opt-in legitime par défaut.
  // L'inverse (skip à la moindre erreur) bloquerait toute capture en cas
  // d'indispo BDD passagère, ce qui n'est pas le bon trade-off.
  // Et depuis l'audit du 2026-10-04 (RGPD-18 (a)), la règle d'insertion de la
  // base lit elle-même l'opposition : si la RPC a échoué pour quelqu'un qui
  // s'est opposé, c'est la base qui refuse (42501 → « sautée », plus bas).
  const { data: optedOut, error: rpcError } = await supabase
    .rpc('is_profiling_opted_out', { p_user_id: userId })
  if (rpcError && import.meta.env.DEV) {
    console.warn('[spending] is_profiling_opted_out failed, proceeding with insert:', rpcError.message)
  }
  if (optedOut === true) {
    return { ok: true, skipped: true }
  }

  const { data, error } = await supabase.from('spending_events').insert({
    user_id: userId,
    total_eur: Number.isFinite(total_eur) ? Math.max(0, total_eur) : 0,
    items_count: Number.isFinite(items_count) ? Math.max(0, Math.round(items_count)) : 0,
    items_json: items_json ?? [],
  }).select('id').single()
  if (error) {
    // La base refuse au nom de l'opposition au profilage (règle d'insertion,
    // RGPD-18 (a)) : c'est le résultat voulu, pas une panne à montrer.
    if (error.code === '42501') return { ok: true, skipped: true }
    if (import.meta.env.DEV) console.error('[spending] recordSpendingEvent:', error.message)
    return { error: error.message }
  }
  return { ok: true, id: data?.id ?? null }
}

/**
 * Efface tout l'historique de dépenses d'un user.
 *
 * Sprint 10 S10.c.5 — RGPD Article 17 (droit à l'effacement) ciblé sur
 * les données de profilage. Complémentaire à l'opt-out futur (Art. 21,
 * cf. S10.c.3/4) : permet d'effacer aussi les snapshots déjà capturés.
 *
 * Pas de soft delete : RGPD Art. 17 exige une suppression effective.
 * La policy RLS `spending_events_delete_own` garantit que l'user ne peut
 * supprimer que ses propres rows.
 *
 * @returns {Promise<{ok:true,count:number}|{error:string}>}
 */
export async function eraseSpendingHistory(userId) {
  if (!userId) return { error: 'invalid' }
  // Compte avant pour pouvoir afficher un feedback précis ("X événements effacés")
  const { count: beforeCount } = await supabase
    .from('spending_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const { error } = await supabase
    .from('spending_events')
    .delete()
    .eq('user_id', userId)
  if (error) {
    if (import.meta.env.DEV) console.error('[spending] eraseSpendingHistory:', error.message)
    return { error: error.message }
  }
  return { ok: true, count: beforeCount ?? 0 }
}

/** Annule un événement (utilisé sur l'undo "J'ai fait mes courses"). */
export async function deleteSpendingEvent(eventId) {
  if (!eventId) return { error: 'invalid' }
  const { error } = await supabase.from('spending_events').delete().eq('id', eventId)
  if (error) {
    if (import.meta.env.DEV) console.error('[spending] deleteSpendingEvent:', error.message)
    return { error: error.message }
  }
  return { ok: true }
}

/**
 * Liste les événements dépense des `monthsBack` derniers mois.
 * Retourne triés du plus récent au plus ancien.
 */
export async function listSpendingEvents(userId, monthsBack = 12) {
  if (!userId) return []
  const since = new Date()
  since.setMonth(since.getMonth() - monthsBack)
  since.setDate(1)
  since.setHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('spending_events')
    .select('id, occurred_at, total_eur, items_count, items_json')
    .eq('user_id', userId)
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false })
  if (error) {
    if (import.meta.env.DEV) console.error('[spending] listSpendingEvents:', error.message)
    return []
  }
  return data ?? []
}
