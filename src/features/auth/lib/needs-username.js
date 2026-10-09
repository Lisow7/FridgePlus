// Vrai uniquement quand un utilisateur connecté a un profil CHARGÉ dont le
// pseudo n'est pas confirmé (compte OAuth fraîchement créé). La condition
// `!!profile` évite le flash pendant le chargement différé du profil.
export function needsUsername(user, profile) {
  return !!user && !!profile && profile.username_confirmed === false
}
