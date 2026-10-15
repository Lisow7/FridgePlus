// Une session était-elle ouverte sur cet appareil ? Un témoin dans localStorage,
// posé tant qu'un compte est connecté, retiré par toute sortie VOULUE — même
// faite depuis un autre onglet, qui partage le témoin. Une session qui se ferme
// alors que le témoin est encore là s'est perdue (expirée, fermée depuis un
// autre appareil) : le bandeau du haut le dit (décision du 2026-10-08).
// Le témoin survit au rechargement : une session refusée au démarrage, avant
// même que l'application écoute la bibliothèque, se dit aussi.
const TEMOIN = 'fridge-session-ouverte'

export function marquerLaSessionOuverte() {
  try { localStorage.setItem(TEMOIN, '1') } catch { /* stockage refusé : pas de bandeau, rien d'autre */ }
}

export function oublierLaSessionOuverte() {
  try { localStorage.removeItem(TEMOIN) } catch { /* idem */ }
}

export function laSessionEtaitOuverte() {
  try { return localStorage.getItem(TEMOIN) === '1' } catch { return false }
}
