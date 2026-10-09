// Helper pur : dérive l'état du FIL ROUGE d'activation, recentré sur l'Aha.
// 2 étapes (invité : remplis le frigo → découvre une recette cuisinable) ou 3
// (connecté : + cuisine ton premier plat). Le favori est SORTI du fil (geste
// secondaire). step2 = Aha = a vu une recette READY (cf. Fix C).
export function computeSteps({ hasStock, suggestionOpened, hasCooked, isGuest }) {
  const step1 = !!hasStock
  const step2 = !!suggestionOpened
  const step3 = !!hasCooked
  const total = isGuest ? 2 : 3
  const doneCount = [step1, step2, step3].slice(0, total).filter(Boolean).length
  // `completed` ne dépend PAS de step1 : step1 (hasStock) est LIVE et volatil —
  // cuisiner peut vider le frigo, faisant retomber step1 à faux à l'instant même
  // où step3 devient vrai, ce qui ré-afficherait S1 au lieu de retirer la carte
  // (cas-limite). step2/step3 sont PERSISTÉS : une fois la découverte (step2) et
  // la cuisine (step3) faites, le parcours est terminé quel que soit le stock.
  const completed = isGuest ? step2 : (step2 && step3)
  return { step1, step2, step3, total, doneCount, completed }
}

// Dérive l'état actif de la carte « coach » (un seul état affiché à la fois).
// Priorité : complété → fin ; sinon la 1ʳᵉ étape non faite. À l'Aha (step2), s2a
// nomme une recette prête (READY), sinon s2b « presque ».
export function deriveCoachState({ steps, isGuest, hasReadyRecipe }) {
  if (steps.completed) return 'fin'
  if (!steps.step1) return 's1'
  if (!steps.step2) return hasReadyRecipe ? 's2a' : 's2b'
  if (!isGuest && !steps.step3) return 's3'
  return 'fin'
}
