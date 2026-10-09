import { useState, useEffect, useCallback } from 'react'
import { COST_MODES } from '@shared/lib/recipes/recipe-utils'
import { refreshPrices, clearPriceCache } from '@shared/lib/pricing/open-prices'
import { getIngredientItemsFlat, getIngredientId } from '@shared/lib/recipes/recipe-ingredients'

// État de l'onglet Coût du RecipeModal — extrait (2026-07-25, audit front §2).
//
// Appelé DANS le parent (RecipeModal) pour que l'état PERSISTE entre les
// changements d'onglet : la vue RecipeCostTab est montée conditionnellement
// (`activeTab === 'cost'`) et se démonterait/réinitialiserait sinon.
//
// Ne contient que l'état persistant + les deux chemins de rafraîchissement des
// prix Open Prices (auto à l'ouverture de l'onglet, et manuel via bouton).
// La dérivation (rows, total, displayedCost…) reste dans la vue, montée
// seulement quand l'onglet est actif → on préserve la laziness du calcul.
//
// `active` = l'onglet Coût est-il ouvert (déclenche l'auto-refresh).
export function useRecipeCost({ active, recipe, lang }) {
  const [costMode, setCostMode] = useState(COST_MODES.TOTAL)
  const [livePrices, setLivePrices] = useState({})
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null)

  // Auto-refresh à l'ouverture de l'onglet Coût (cache 24h côté open-prices) :
  // fusionne les prix reçus dans l'état existant.
  useEffect(() => {
    if (!active || !getIngredientItemsFlat(recipe).length) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveLoading(true)
    const entries = getIngredientItemsFlat(recipe).map(ing => ({
      id: getIngredientId(ing),
      labelFr: ing.labels?.fr ?? getIngredientId(ing),
    }))
    refreshPrices(entries, lang)
      .then(prices => {
        if (Object.keys(prices).length > 0) {
          setLivePrices(prev => ({ ...prev, ...prices }))
          setLiveUpdatedAt(Date.now())
        }
      })
      .finally(() => setLiveLoading(false))
    // Depend de `recipe?.id`, pas de `recipe` : l'objet est recree a chaque rendu
    // et l'inclure declencherait une requete reseau en boucle. Limite assumee —
    // une recette EDITEE en place, a id constant, ne recalculerait pas ses prix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, recipe?.id, lang])

  // Refresh manuel (bouton) : vide le cache puis remplace les prix.
  const refresh = useCallback(() => {
    clearPriceCache()
    setLivePrices({})
    setLiveUpdatedAt(null)
    setLiveLoading(true)
    const entries = getIngredientItemsFlat(recipe).map(ing => ({
      id: getIngredientId(ing),
      labelFr: ing.labels?.fr ?? getIngredientId(ing),
    }))
    refreshPrices(entries, lang)
      .then(prices => {
        if (Object.keys(prices).length > 0) {
          setLivePrices(prices)
          setLiveUpdatedAt(Date.now())
        }
      })
      .finally(() => setLiveLoading(false))
  }, [recipe, lang])

  return { costMode, setCostMode, livePrices, liveLoading, liveUpdatedAt, refresh }
}
