import { useEffect, useRef } from 'react'
import { track } from '@shared/lib/observability/track'

// Mesure (audit d'intuitivité du 2026-10-02) : `ingredient_search` = une
// recherche d'aliment ABOUTIE, c'est-à-dire une saisie qui s'est arrêtée — pas
// une ligne par touche. Seul le NOMBRE de résultats part, JAMAIS le texte tapé
// (c'est le choix de sobriété : une recherche à 0 résultat suffit à repérer un
// trou du catalogue sans stocker ce que les gens écrivent).
// Une même saisie n'émet qu'une fois, même si les filtres changent ensuite.
export const SEARCH_SETTLE_MS = 1500

export function useTrackIngredientSearch(query, resultCount) {
  const countRef = useRef(resultCount)
  const lastSent = useRef('')
  useEffect(() => { countRef.current = resultCount }, [resultCount])

  useEffect(() => {
    const q = query.trim()
    if (!q || q === lastSent.current) return undefined
    const timer = setTimeout(() => {
      lastSent.current = q
      track('ingredient_search', { results: countRef.current })
    }, SEARCH_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [query])
}
