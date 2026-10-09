import { useEffect, useState } from 'react'

// La valeur, mais seulement une fois qu'elle a cessé de changer depuis `delai`
// millisecondes.
//
// Pour une recherche : une requête quand on s'arrête de taper, pas une par
// frappe. Audit du 2026-10-04, ADM-09 : des recherches du panneau envoyaient
// une requête par lettre (deux pour les Avis), et la réponse d'une frappe
// ancienne pouvait arriver après la plus récente.
export function useDebouncedValue(valeur, delai = 300) {
  const [stable, setStable] = useState(valeur)
  useEffect(() => {
    const minuteur = setTimeout(() => setStable(valeur), delai)
    return () => clearTimeout(minuteur)
  }, [valeur, delai])
  return stable
}
