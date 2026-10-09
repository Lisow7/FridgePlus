import { useEffect, useMemo, useState } from 'react'
import { useBaseRecipes, useCountries } from '@shared/contexts/data-provider'
import { useProfileState } from '@features/profile/hooks/use-profile-state'
import { getMyCustomRecipesForResolution } from '@shared/api/community'
import { computeWeeklyStreak, computeBadges } from '@shared/lib/recipes/achievements'

// Source unique des journaux de cuisine + dérivés (stats, journal propre,
// série, badges). Partagé par /profile/activite (stats + journal) et
// /profile/recompenses (série + badges) → pas de duplication du plumbing.
//
// Tout est dérivé compute-on-the-fly des logs existants : zéro BDD/PII en plus.
export function useCookingLogs(userId) {
  const { recipes: baseRecipes, recipeNames } = useBaseRecipes()
  const countries = useCountries()
  const { journalLogs, statsLogs } = useProfileState({ enableJournal: true, enableStats: true })

  // Recettes communauté de l'utilisateur (pour résoudre noms/pays de SES recettes).
  const [customRecipes, setCustomRecipes] = useState([])
  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomRecipes([])
      return
    }
    let cancelled = false
    getMyCustomRecipesForResolution(userId).then(list => { if (!cancelled) setCustomRecipes(list) })
    return () => { cancelled = true }
  }, [userId])

  // Exclut les logs orphelins (recette supprimée / introuvable) du journal + stats.
  const isOrphanLog = (log) => {
    if (log.recipe_source === 'custom') return !customRecipes.find(c => c.id === log.recipe_id)
    return !baseRecipes?.find(r => r.id === log.recipe_id)
  }
  const cleanJournalLogs = useMemo(
    () => (journalLogs ?? []).filter(l => !isOrphanLog(l)),
    [journalLogs, customRecipes, baseRecipes] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const cleanStatsLogs = useMemo(
    () => (statsLogs ?? []).filter(l => !isOrphanLog(l)),
    [statsLogs, customRecipes, baseRecipes] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const resolveCountry = useMemo(() => (recipeId, source) => {
    if (source === 'custom') return customRecipes?.find(c => c.id === recipeId)?.country ?? null
    return baseRecipes?.find(c => c.id === recipeId)?.country ?? null
  }, [customRecipes, baseRecipes])

  // #14a — séries + badges, dérivés des mêmes logs propres.
  const streak = useMemo(() => computeWeeklyStreak(cleanStatsLogs), [cleanStatsLogs])
  const badges = useMemo(() => computeBadges(cleanStatsLogs, resolveCountry), [cleanStatsLogs, resolveCountry])

  return {
    baseRecipes, recipeNames, countries, customRecipes,
    journalLogs, statsLogs, cleanJournalLogs, cleanStatsLogs,
    resolveCountry, streak, badges,
  }
}
