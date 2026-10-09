// Helpers de date pour les restes (leftovers).
//
// Extraits depuis features/fridge/api/leftovers.js (Sprint 9 S9.a.6) car
// utilisés transversalement par le hook use-recipe-filters (recipes feature).
// Pures, sans dépendance Supabase.

// Compare expires_at à minuit local — un reste créé à 14h reste actif
// jusqu'à la fin du jour de la DLC, et n'est expiré qu'au lendemain.
export function getDaysLeft(expiresAt) {
  const exp = new Date(expiresAt)
  exp.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - today.getTime()) / 86400000)
}

export function isLeftoverExpired(expiresAt) {
  return getDaysLeft(expiresAt) < 0
}

// « Reste sauvé » : supprimé AVANT sa DLC = proxy honnête de « utilisé à temps »
// (les restes n'ont pas de signal mangé/jeté). Alimente le compteur anti-gaspi
// côté restes. Un reste encore actif (deleted_at null) n'est pas compté.
export function isLeftoverSaved({ deleted_at, expires_at }) {
  if (!deleted_at || !expires_at) return false
  return new Date(deleted_at).getTime() <= new Date(expires_at).getTime()
}
