import { useCallback, useEffect, useRef } from 'react'

// Fermeture différée d'une bulle au survol (WCAG 2.2, 1.4.13 « Contenu au
// survol ou au focus » ; audit du 2026-10-04, A11Y-22). La bulle est un
// portail séparé de son ancre par un espace de quelques pixels : fermer dès
// que le pointeur quitte l'ancre la faisait disparaître avant qu'on l'atteigne.
// Quitter l'ancre ou la bulle programme la fermeture ; entrer sur l'une ou
// l'autre l'annule. Le délai est court : la bulle ne doit pas « traîner ».
export const DELAI_DE_SORTIE_MS = 150

/**
 * @param {() => void} fermer ferme la bulle (stable : passer un useCallback)
 * @returns {{ fermerBientot: () => void, annulerLaFermeture: () => void }}
 */
export function useFermetureDifferee(fermer) {
  const minuteur = useRef(null)

  const annulerLaFermeture = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current)
    minuteur.current = null
  }, [])

  const fermerBientot = useCallback(() => {
    annulerLaFermeture()
    minuteur.current = setTimeout(() => {
      minuteur.current = null
      fermer()
    }, DELAI_DE_SORTIE_MS)
  }, [annulerLaFermeture, fermer])

  // Au démontage, aucun minuteur ne doit survivre au composant.
  useEffect(() => annulerLaFermeture, [annulerLaFermeture])

  return { fermerBientot, annulerLaFermeture }
}
