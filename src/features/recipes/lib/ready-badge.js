// Condition d'affichage du point de découvrabilité sur la carte "Prêt" — cf. spec
// la conception « recipes-ready-badge-discoverability » du 2026-07-19, §2.
// Extraite en fonction pure pour être testable sans monter RecipePanel (dont les
// contexts — useAuth, useBaseRecipes, useCountries... — sont trop lourds pour un
// simple test de condition).
export function shouldShowReadyBadge(readyCount, filter) {
  return readyCount > 0 && filter !== 'ready'
}
