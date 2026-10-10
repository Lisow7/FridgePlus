// Couche BDD pour les paniers partagés publics.
//
// Table : `public.shared_baskets`
// Format payload : {
//   rows: Array<{ label, emoji, amount, unit, price, aisle }>,
//   total: number,
//   lang: string,
//   name?: string  // nom de la liste active si disponible
// }
//
// TTL : 7 jours (expires_at), posés par la base — 30 jours au plus, 20 paniers
//       actifs par compte au plus (audit du 2026-10-04, BDD-05). Passé ce délai,
//       la fonction de lecture ne rend plus rien.
// Lecture : par `get_shared_basket(id)`, qui ne rend que LE panier du lien ;
//       la table n'est plus lue en entier (sa lecture publique tombe après la
//       release, migration `paniers_partages_lecture_par_rpc_apres_release`).
// RGPD : aucune PII dans le payload (pas de nom d'utilisateur, pas d'email).
//        ON DELETE CASCADE depuis profiles → suppression compte = suppression listes.

import { supabase } from '@shared/lib/supabase/client'


/**
 * Crée un panier partagé et retourne son UUID public.
 *
 * @param {string} userId
 * @param {object} payload - { rows, total, lang, name? }
 * @returns {Promise<{ data: { id: string, expires_at: string }|null, error: object|null }>}
 */
export async function createSharedBasket(userId, payload) {
  if (!userId) return { data: null, error: { message: 'missing_user_id' } }
  if (!payload || typeof payload !== 'object') {
    return { data: null, error: { message: 'invalid_payload' } }
  }
  const { data, error } = await supabase
    .from('shared_baskets')
    .insert({ user_id: userId, payload })
    .select('id, expires_at')
    .single()
  if (error && import.meta.env.DEV) console.error('[shared_baskets] create:', error.message)
  return { data, error }
}

/**
 * Charge un panier partagé par son UUID, par la fonction `get_shared_basket` :
 * un seul panier, celui du lien ; `null` s'il n'existe pas ou a expiré.
 *
 * @param {string} id
 * @returns {Promise<{ data: { payload: object, expires_at: string }|null, error: object|null }>}
 */
export async function getSharedBasket(id) {
  if (!id) return { data: null, error: { message: 'missing_id' } }
  const { data, error } = await supabase.rpc('get_shared_basket', { p_id: id })
  if (error && import.meta.env.DEV) console.error('[shared_baskets] get:', error.message)
  return { data: data ?? null, error }
}

/**
 * Calcule le nombre de jours restants avant expiration.
 * Retourne 0 si déjà expiré.
 *
 * @param {string} expiresAt - ISO string
 * @returns {number}
 */
export function daysUntilExpiry(expiresAt) {
  if (!expiresAt) return 0
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}
