import { supabase } from '@shared/lib/supabase/client'

// Profils publics des auteurs : pseudo, avatar, bannière, bio, date
// d'inscription — rien d'autre. Lus par la fonction `get_public_profiles` de la
// base (migration `20261005_profils_publics_et_compteurs.sql`).
//
// 🔴 La table `profiles` ne se lit que pour SA ligne, ou en admin. Les posts,
// les réponses et les avis joignaient le profil de l'auteur
// (`profile:profiles!user_id(...)`) : pour tout lecteur non admin, l'auteur
// revenait vide → « Utilisateur supprimé », « Anonyme », « Profil
// introuvable ». L'admin, qui voit tout, ne pouvait pas le remarquer (audit du
// 2026-10-04, BDD-13). Toute lecture du profil d'un AUTRE compte passe par ici.

// La fonction ignore ce qui dépasse 200 identifiants par appel : on découpe.
const PAR_APPEL = 200

/**
 * Les profils publics de ces comptes : `{ profiles: Map(id → profil), error }`.
 * Un compte supprimé n'est pas rendu (il est simplement absent de la Map).
 * @param {Array<string|null|undefined>} ids
 */
export async function loadPublicProfiles(ids) {
  const uniques = [...new Set((ids ?? []).filter(Boolean))]
  const profiles = new Map()
  try {
    for (let i = 0; i < uniques.length; i += PAR_APPEL) {
      const { data, error } = await supabase.rpc('get_public_profiles', { p_ids: uniques.slice(i, i + PAR_APPEL) })
      if (error) return { profiles: new Map(), error }
      for (const profil of data ?? []) profiles.set(profil.id, profil)
    }
  } catch (error) {
    return { profiles: new Map(), error }
  }
  return { profiles, error: null }
}

/**
 * Joint à chaque ligne (`user_id`) le profil de son auteur, sous la forme que
 * les écrans lisent depuis toujours : `profile: { username, avatar_id }`, ou
 * `null` si le compte n'existe plus.
 *
 * Si les profils n'ont pas pu être lus, `profile` est `null` ET
 * `profileUnavailable` vaut `true` : une lecture ratée ne doit pas passer pour
 * un compte supprimé (voir `authorName`).
 * @template {{ user_id?: string|null }} T
 * @param {T[]} rows
 */
export async function withAuthorProfiles(rows) {
  const lignes = rows ?? []
  const { profiles, error } = await loadPublicProfiles(lignes.map((r) => r.user_id))
  if (error && import.meta.env.DEV) console.error('[profils publics]', error.message ?? error)
  return lignes.map((r) => {
    if (error) return { ...r, profile: null, profileUnavailable: true }
    const p = profiles.get(r.user_id)
    return { ...r, profile: p ? { username: p.username, avatar_id: p.avatar_id } : null }
  })
}
