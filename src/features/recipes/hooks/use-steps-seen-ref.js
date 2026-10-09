import { useCallback, useEffect, useRef } from 'react'
import { track } from '@shared/lib/observability/track'

// Mesure (audit d'intuitivité du 2026-10-02) : `recipe_steps_seen` = la fiche
// a été lue jusqu'aux étapes. L'onglet « Étapes » est celui par défaut, donc
// « onglet actif » ne dirait rien : on regarde si le titre « Préparation » est
// réellement passé à l'écran. Sur mobile, il est sous les ingrédients (il faut
// défiler) ; sur bureau, il est visible dès l'ouverture, ce qui est exact.
// Une fois par recette et par ouverture de la fiche : revenir sur l'onglet ou
// re-défiler ne ré-émet pas.
// Renvoie un ref callback à poser sur l'élément observé.
export function useStepsSeenRef(recipeId) {
  const sentFor = useRef(null)
  const observer = useRef(null)

  useEffect(() => () => observer.current?.disconnect(), [])

  return useCallback((node) => {
    observer.current?.disconnect()
    observer.current = null
    if (!node || !recipeId || sentFor.current === recipeId) return
    if (typeof IntersectionObserver === 'undefined') return
    observer.current = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || sentFor.current === recipeId) return
      sentFor.current = recipeId
      track('recipe_steps_seen', { recipeId })
      observer.current?.disconnect()
    })
    observer.current.observe(node)
  }, [recipeId])
}
