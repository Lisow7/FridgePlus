// Ce que le compte laisse sur l'appareil, et que la déconnexion EFFACE (jamais « recopié ») :
// un compte n'écrit pas ces clés (ses données sont en base), mais un invité qui se connecte
// peut en laisser avant leur migration, et le brouillon de recette est écrit par tous. Les
// laisser ferait hériter le prochain compte du frigo ou du brouillon du précédent, sur un
// appareil partagé (ADR 0001 : à la déconnexion, les clés locales sont effacées).
//
// La liste est écrite ici, en dur : `src/shared` ne dépend pas de `src/features`. Le test
// `deconnexion-qui-nettoie` vérifie qu'elle suit les modules qui écrivent ces clés.
//
// Ce qui reste exprès : la langue et le thème (l'appareil), l'adresse retenue à la connexion
// (le choix de la personne), les cookies acceptés (CNIL : un choix par appareil).
export const CLES_LOCALES_DU_COMPTE = Object.freeze([
  'fridge-stock',
  'fridge-favorites',
  'fridge-custom-recipes',
  'fridge-recipe-draft',
])

// Efface les clés, sans jamais lever (stockage indisponible, navigation privée).
export function purgerLesDonneesLocalesDuCompte() {
  for (const cle of CLES_LOCALES_DU_COMPTE) {
    try { localStorage.removeItem(cle) } catch { /* stockage indisponible : rien à effacer */ }
  }
}
