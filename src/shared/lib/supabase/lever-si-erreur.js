// Une lecture qui a échoué doit le DIRE, pas se faire passer pour une liste vide.
//
// Audit du 2026-10-04, ADM-08 : les fonctions de lecture du panneau changeaient
// une erreur en `[]`, `0` ou `{}`, et l'écran affichait son état vide —
// « Aucun post », « Aucun ticket » : une panne ou une règle cassée se lisait
// « rien à modérer ». Même cause que le lot 7 côté utilisateur.

/**
 * Une `Error` qui garde le message ET le code de la base. `useReloader` ne
 * garde que des `Error` : un objet d'erreur Supabase y devenait « [object
 * Object] », sans son code (42501 = refus de droits).
 * @param {unknown} erreur
 * @returns {Error & { code?: string }}
 */
export function versErreur(erreur) {
  if (erreur instanceof Error) return erreur
  const e = new Error(typeof erreur === 'string' ? erreur : (erreur?.message || 'erreur inconnue'))
  if (erreur?.code) e.code = erreur.code
  return e
}

/**
 * Rend `resultat` s'il ne porte pas d'erreur ; sinon la LÈVE (voir
 * `versErreur`). Fait pour le corps d'un `useReloader` : son `error`
 * s'allume, et l'écran dit « pas chargé » au lieu de son état vide.
 * @template {{ error?: unknown }} T
 * @param {T} resultat
 * @returns {T}
 */
export function leverSiErreur(resultat) {
  if (resultat?.error) throw versErreur(resultat.error)
  return resultat
}
