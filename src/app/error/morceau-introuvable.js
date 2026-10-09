// Un morceau de code chargé à la demande (`lazy()`) qui n'existe plus : après un
// déploiement, un onglet resté ouvert demande un fichier à l'ancien nom (audit
// du 2026-10-04, ARCH-06). La récupération elle-même (une seule tentative,
// rien hors ligne) est `installerLaRecuperation` (lot SEO-08) ; ceci ne fait
// que reconnaître l'erreur, pour qu'un filet de page recharge la version au
// lieu de rejouer l'import du même fichier disparu.

const MESSAGES = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
]

export function estUnMorceauIntrouvable(erreur) {
  const message = String(erreur?.message ?? erreur ?? '')
  return MESSAGES.some((motif) => motif.test(message))
}
