import { useCallback, useEffect, useRef } from 'react'
import { useToast } from '@shared/ui/toast/toast-provider'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import { getMyReview, upsertReview } from '@features/recipes/api/recipe-reviews'
import QuickRateToast from '@features/recipes/components/quick-rate-toast'

// Toast de notation rapide 1-tap, affiché après un `logCooking()` réussi
// (cf. use-recipe-modal.js). Il part tout seul au bout de QUICK_RATE_MS, et
// dès qu'on quitte la fiche ou qu'on change de recette : retour d'Antoine du
// 2026-10-04 — il restait collé en bas de l'écran, sur l'accueil, longtemps
// après la recette qu'il concernait (`duration: 0` à l'origine).
export const QUICK_RATE_MS = 3000

/**
 * @param {string|undefined} currentRecipeId recette affichée par la fiche
 * @returns {(userId: string, opts: { recipeId: string, recipeSource: string, lang?: string }) => Promise<void>}
 */
export function useQuickRatePrompt(currentRecipeId) {
  const { show, dismiss } = useToast()
  const signalerEchec = useSaveErrorToast()
  // Incrémenté quand la fiche se ferme ou change de recette : une invite dont
  // la lecture de l'avis (réseau) se termine APRÈS ce moment ne s'affiche pas.
  const generation = useRef(0)
  const shownId = useRef(null)

  useEffect(() => () => {
    generation.current += 1
    if (shownId.current) dismiss(shownId.current)
    shownId.current = null
  }, [currentRecipeId, dismiss])

  return useCallback(async (userId, { recipeId, recipeSource, lang = 'fr' } = {}) => {
    if (!userId || !recipeId || !recipeSource) return
    const gen = generation.current
    let existing
    try {
      existing = await getMyReview(userId, recipeId, recipeSource)
    } catch {
      return // ne casse jamais le flux de cuisson
    }
    if (existing) return // déjà noté : pas de sursollicitation
    if (gen !== generation.current) return // fiche quittée entre-temps

    const id = `quick-rate-${recipeId}`
    // La note part ; si la base la refuse, on le dit (le résultat était jeté
    // jusqu'au 2026-10-05 : une note « donnée » pouvait n'exister nulle part).
    const handleRate = async (rating) => {
      dismiss(id)
      let refusee
      try { refusee = !!(await upsertReview(userId, { recipeId, recipeSource, rating, body: null }))?.error }
      catch { refusee = true }
      if (refusee) signalerEchec('rating')
    }
    shownId.current = id
    show(
      <QuickRateToast lang={lang} onRate={handleRate} onDismiss={() => dismiss(id)} />,
      { id, duration: QUICK_RATE_MS },
    )
  }, [show, dismiss, signalerEchec])
}
