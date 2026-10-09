import { calcRecipeCostByMode, COST_MODES } from '@shared/lib/recipes/recipe-utils'

// Le curseur « Budget maximum » du tiroir des filtres dit « Au plus X € par
// portion » : on compare donc le coût PAR PORTION (audit du 2026-10-04,
// UX-07 — il comparait le coût total, et une recette de 4 portions à 6 €
// disparaissait sous un plafond de 3 € la portion). Sans prix ou sans nombre
// de portions, la recette n'est pas retenue : on ne peut pas dire qu'elle
// tient le budget.
export function respecteLeBudget(recette, max, { lang = 'fr', ingredientsById = null } = {}) {
  if (max == null) return true
  const parPortion = calcRecipeCostByMode(recette, { mode: COST_MODES.PER_SERVING, lang, ingredientsById })
  return parPortion != null && parPortion <= max
}

// Les coûts ne se voient qu'avec l'accès Premium (carte, onglet « Coût ») : pour
// les autres, le curseur est masqué, et un plafond venu de l'adresse
// (`?maxBud=3`, lien partagé) ne doit pas filtrer en silence, sans curseur à
// l'écran pour le retirer.
export function budgetQuiFiltre(maxBudget, coutsVisibles) {
  return coutsVisibles ? maxBudget : null
}
