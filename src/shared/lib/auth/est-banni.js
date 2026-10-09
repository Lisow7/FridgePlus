// Un compte est-il banni EN CE MOMENT ? (audit du 2026-10-04, CPT-17)
//
// Un bannissement peut être daté (`banned_until`). Passé cette date, le service
// d'authentification laisse se reconnecter, la base laisse écrire
// (`private.compte_peut_ecrire`), et une tâche planifiée remet `banned` à faux
// au plus tard un quart d'heure après : l'écran doit suivre la date, pas
// seulement le drapeau, sinon il resterait bloqué sur « Compte suspendu ».
export function estBanni(profile) {
  if (!profile?.banned) return false
  if (!profile.banned_until) return true
  return new Date(profile.banned_until).getTime() > Date.now()
}
