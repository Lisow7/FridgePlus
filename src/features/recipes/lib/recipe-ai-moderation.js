// R-04 — calcul du `ai_moderation_status` à embarquer dans une recette
// au moment de buildRecipe(). cf. spec
// la conception « recipe-creation-zone-review » du 2026-06-10.
//
// Valeurs persistées dans `custom_recipes.data.ai_moderation_status` :
//   • 'passed'  — OpenAI a répondu OK
//   • 'error'   — OpenAI a planté (timeout, 502, etc.) ; admin queue affiche un badge
//   • 'skipped' — recette privée, jamais envoyée à OpenAI
//   • 'flagged' — n'est jamais persisté ici (la soumission est bloquée avant)
//
// L'admin queue lit cette valeur pour prioriser les recettes 'error' à la
// review humaine (cf. custom-recipes-section.jsx).

/**
 * @param {boolean} isProposePublicSubmission — true si l'utilisateur soumet
 *   en cochant « Proposer comme recette publique » avec un compte connecté.
 * @param {'passed'|'error'|null|undefined} lastOpenAIOutcome — résultat capturé
 *   au dernier appel `checkOpenAIModeration()`. null = on n'a jamais tenté.
 * @returns {'passed'|'error'|'skipped'}
 */
export function computeAiModerationStatus(isProposePublicSubmission, lastOpenAIOutcome) {
  if (!isProposePublicSubmission) return 'skipped'
  // Si l'utilisateur soumet publiquement mais qu'on n'a pas de trace OpenAI,
  // on retombe sur 'error' par prudence (l'admin sera alerté).
  return lastOpenAIOutcome ?? 'error'
}
