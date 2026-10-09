// Scoring de recettes — DÉPLACÉ vers la source canonique partagée
// `@shared/lib/recipes/recipe-scoring` (importable cross-feature sans violer
// l'isolation). Ce fichier re-exporte pour ne pas casser les imports existants
// (use-recipe-filters).
export { scoreRecipes, expandStock } from '@shared/lib/recipes/recipe-scoring'
