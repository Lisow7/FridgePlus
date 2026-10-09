import { useEffect, useMemo, useReducer, useState, useDeferredValue } from 'react'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { useStockSession } from '@shared/contexts/session-state-context'
import { useBaseRecipes, useGroupMaps } from '@shared/contexts/data-provider'
import { trackOnce } from '@shared/lib/observability/track'
import { hasSeenWelcome } from '../lib/welcome-storage'
import { isDismissed, markDismissed, isCompleted, markCompleted, hasOpenedSuggestion, subscribeGettingStarted } from '../lib/getting-started-storage'
import { computeSteps, deriveCoachState } from '../lib/getting-started-steps'
import { useHasCookedFirstDish } from '../hooks/use-has-cooked-first-dish'
import { pickTopCookable } from '../lib/pick-top-cookable'
import GettingStartedCard from './getting-started-card'

// Décide QUOI montrer (état « coach ») pour invités ET connectés. Absorbe l'ancien
// nudge Aha : à l'étape découverte, nomme la meilleure recette cuisinable
// (pickTopCookable) et émet `cookable_recipe_viewed`. Se retire DÉFINITIVEMENT à
// la complétion (latch de célébration en session, puis `isCompleted` → null).
export default function GettingStartedContainer({ lang = 'fr', user, onOpenRecipes, onSignUp, onOpenRewards, onQuickAdd, onQuickRemove, onOpenRecipe, onSuggestionOpen, stapleIds, covered = false }) {
  const enabled = useFeatureFlag('onboarding_activation')
  const { stock } = useStockSession()
  const { recipes, recipeNames } = useBaseRecipes()
  const groupMaps = useGroupMaps()
  const [, force] = useReducer((x) => x + 1, 0) // re-render après collapse/expand
  const [celebratingUid, setCelebratingUid] = useState(null)
  const uid = user?.id ?? 'guest'
  const isGuest = !user
  const hasCooked = useHasCookedFirstDish(uid)

  // INVARIANT : tout l'état lu LIVE par render depuis l'uid courant.
  const steps = computeSteps({ hasStock: (stock?.size ?? 0) > 0, suggestionOpened: hasOpenedSuggestion(uid), hasCooked, isGuest })

  // Scoring seulement quand il faut trancher s2a/s2b (frigo rempli, Aha à venir) —
  // évite le scoring lourd sinon (Blocker B).
  const needPick = steps.step1 && !steps.step2 && !steps.completed
  const deferredStock = useDeferredValue(stock)
  const pick = useMemo(
    () => (needPick ? pickTopCookable({ recipes, stock: deferredStock, groupMaps, stapleIds }) : null),
    [needPick, recipes, deferredStock, groupMaps, stapleIds],
  )
  const hasReadyRecipe = pick?.status === 'READY'
  const state = deriveCoachState({ steps, isGuest, hasReadyRecipe })

  // Impression Aha : event 1×/session (même clé de dédup que useAhaTick).
  useEffect(() => {
    if (state === 's2a' && pick?.recipe?.id) trackOnce('fridge-aha-tracked', 'cookable_recipe_viewed', { recipeId: pick.recipe.id })
  }, [state, pick])

  // Complétion INVITÉ + CONNECTÉ (retrait définitif) — en EFFECT (StrictMode
  // avalerait la célébration en render). Latch `celebratingUid` : garde la carte
  // affichée pour la célébration/CTA de CETTE session malgré la complétion persistée.
  useEffect(() => {
    if (steps.completed && !isCompleted(uid)) { markCompleted(uid); setCelebratingUid(uid) }
  }, [uid, steps.completed])

  // Rouverture depuis un point d'entrée externe (bouton fusée du footer) :
  // `reopenGuide` notifie → on force un re-render pour ré-afficher le guide.
  useEffect(() => subscribeGettingStarted(force), [])

  if (!enabled || !hasSeenWelcome()) return null
  // Retiré : complété lors d'une session ANTÉRIEURE (≠ célébration en cours).
  if (isCompleted(uid) && celebratingUid !== uid) return null
  // Un panneau recouvre l'accueil (Recettes, panier, bac…) : la carte s'efface
  // au lieu d'en masquer le bas (audit 2026-10-02). Le conteneur reste MONTÉ —
  // `celebratingUid` survit ainsi à l'ouverture d'un panneau.
  if (covered) return null

  const collapsed = isDismissed(uid)
  // Nom lisible via la map recipeNames (indexée par id), comme RecipeCard.
  const rid = pick?.recipe?.id
  const recipeName = rid ? (recipeNames?.[rid]?.[lang] ?? recipeNames?.[rid]?.fr ?? rid) : ''
  const onSeeRecipe = () => { if (pick?.recipe?.id) { onOpenRecipe?.(pick.recipe.id); onSuggestionOpen?.() } }

  return (
    <GettingStartedCard
      lang={lang} state={state} isGuest={isGuest}
      stepsTotal={steps.total} stepsDone={steps.doneCount} recipeName={recipeName}
      collapsed={collapsed}
      onCollapse={() => { markDismissed(uid); force() }}
      stock={stock}
      onQuickAdd={onQuickAdd}
      onQuickRemove={onQuickRemove}
      onSeeRecipe={onSeeRecipe}
      onSeeRecipes={onOpenRecipes}
      onSignUp={onSignUp}
      onOpenRewards={onOpenRewards}
    />
  )
}
