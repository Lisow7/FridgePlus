import { useEffect, useRef, useState } from 'react'
import { getPublicRecipes } from '@features/recipes/lib/custom-recipes'
import { logError } from '@shared/lib/observability/sentry'

// Les recettes publiques de la communauté, lues quand on en a besoin.
//
// Seuls le panneau de recettes et les restes s'en servent. Avant, `App` les
// lisait à chaque démarrage, sur chaque page — deux requêtes avec leur pré-vol,
// que la FAQ et l'accueil payaient pour rien (audit du 2026-10-04, PERF-07).
// Désormais : à la première ouverture de l'un d'eux, une fois. Une lecture
// ratée est journalisée, et la prochaine ouverture réessaie.
export function usePublicRecipesOnDemand(voulu) {
  const [publicRecipes, setPublicRecipes] = useState([])
  const demandeRef = useRef(false)

  useEffect(() => {
    if (!voulu || demandeRef.current) return
    demandeRef.current = true
    getPublicRecipes()
      .then(setPublicRecipes)
      .catch((err) => {
        demandeRef.current = false
        logError(err, { tag: 'App.getPublicRecipes' })
      })
  }, [voulu])

  return publicRecipes
}
