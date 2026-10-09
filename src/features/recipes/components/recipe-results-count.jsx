// Le nombre de recettes après une recherche ou un filtre, dit aux lecteurs
// d'écran : la liste changeait sans un mot (audit du 2026-10-04, A11Y-17).
// Région vive permanente, montée même à zéro — un lecteur d'écran n'annonce
// de façon fiable qu'une région déjà présente quand son texte change.
export default function RecipeResultsCount({ count, t }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {t.resultsCount(count)}
    </p>
  )
}
