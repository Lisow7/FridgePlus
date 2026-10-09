import { useEffect } from 'react'
import { trackOnce } from '@shared/lib/observability/track'

// Fix C (fil rouge onboarding) : coche l'étape Aha « Découvre une recette que tu
// peux cuisiner » quand l'utilisateur VOIT réellement une recette cuisinable
// (READY), pas à la simple ouverture du panneau ni sur ALMOST. `markSuggestionOpened`
// (côté onboarding) est idempotent → un re-déclenchement de l'effet est sans effet.
// Funnel : émet AUSSI l'impression `cookable_recipe_viewed` (1×/session, dédup
// `trackOnce` → le re-fire de l'effet est sans effet sur la table).
export function useAhaTick({ open, stockSize, readyCount, searchQuery, onSuggestionOpen }) {
  useEffect(() => {
    if (open && stockSize > 0 && readyCount > 0 && !searchQuery.trim()) {
      onSuggestionOpen?.()
      trackOnce('fridge-aha-tracked', 'cookable_recipe_viewed', { count: readyCount })
    }
  }, [open, stockSize, readyCount, searchQuery, onSuggestionOpen])
}
