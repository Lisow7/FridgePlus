import { scoreRecipes } from '@shared/lib/recipes/recipe-scoring'
import { SEUIL_PRESQUE } from '@shared/lib/recipes/recipe-thresholds'

// Choisit la meilleure recette à mettre en avant pour l'Aha onboarding, ou null.
// READY (matchPercent===1) prioritaire ; sinon ALMOST la plus proche (« Presque » :
// au moins SEUIL_PRESQUE, le même seuil que le filtre et les textes)
// avec son 1ᵉʳ slot manquant. `scoreRecipes` trie déjà par matchPercent desc ; les
// `stapleIds` (sel/huile/épices) sont passés en 4ᵉ argument (assumés présents).
export function pickTopCookable({ recipes, stock, groupMaps, stapleIds }) {
  if (!recipes?.length || (stock?.size ?? 0) === 0) return null
  const top = scoreRecipes(recipes, stock, groupMaps, stapleIds)[0]
  if (!top || top.matchPercent < SEUIL_PRESQUE) return null
  if (top.matchPercent === 1) return { recipe: top, status: 'READY', missing: null }
  return { recipe: top, status: 'ALMOST', missing: top.missing?.[0] ?? null }
}
