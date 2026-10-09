import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGroupMaps, useIngredientsById, TYPE_MAP, DIFFICULTY_MAP } from '@shared/contexts/data-provider'

// Inverses : label FR → clé BDD (pour sérialiser vers URL)
const TYPE_TO_KEY = Object.fromEntries(Object.entries(TYPE_MAP).map(([k, v]) => [v, k]))
const DIFFICULTY_TO_KEY = Object.fromEntries(Object.entries(DIFFICULTY_MAP).map(([k, v]) => [v, k]))

// Désérialisation : clés BDD → labels FR (appliqués à l'init depuis URL)
function mapKeysToLabels(keys, map) {
  return new Set([...keys].map(k => map[k] ?? k))
}
// Sérialisation : labels FR → clés BDD (pour écrire dans URL)
function mapLabelsToKeys(labels, inverseMap) {
  return new Set([...labels].map(l => inverseMap[l] ?? l))
}
import { scoreRecipes } from '@features/recipes/lib/recipe-scoring'
import { computeStapleIds } from '@features/recipes/lib/pantry-staples'
import { isLeftoverExpired } from '@shared/lib/leftovers/expired'
import { recipeHasSeasonalIngredient } from '@shared/lib/ingredients/seasonality'
import { isHealthyRecipe } from '@features/recipes/lib/health-score'
import { HIDDEN_DIETS } from '@shared/static/recipe-constants'
import { serializeFiltersToParams, deserializeFiltersFromParams } from '@features/recipes/lib/recipe-filters-url'
import { computeRecipeNutrition } from '@shared/lib/recipes/recipe-nutrition'
import { calcRecipeCost } from '@shared/lib/recipes/recipe-utils'
import { getIngredientItemsFlat, getIngredientIds } from '@shared/lib/recipes/recipe-ingredients'

const FILTER_KEY    = 'fridge-recipe-filter'
const VALID_FILTERS = ['all', 'ready', 'almost', 'priority', 'favorites', 'custom']

// Recherche insensible aux accents (bug UX audit 2026-07-17 : "creme" ne
// matchait pas "Crème brûlée").
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function toggleInSet(set, value) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function readSavedFilter() {
  try {
    const saved = localStorage.getItem(FILTER_KEY)
    return (saved && VALID_FILTERS.includes(saved)) ? saved : null
  } catch { return null }
}

export function useRecipeFilters({
  recipes,
  stock,
  lang,
  favorites,
  customRecipes,
  publicRecipes,
  leftovers,
  RECIPE_NAMES,
}) {
  const groupMaps       = useGroupMaps()
  const ingredientsById = useIngredientsById()

  const [searchParams, setSearchParams] = useSearchParams()
  // On lit l'URL une seule fois au mount — intentionnellement pas de dépendance sur searchParams
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialFromUrl = useMemo(() => deserializeFiltersFromParams(searchParams), [])

  const [searchQuery, setSearchQuery]       = useState(initialFromUrl.searchQuery ?? '')
  const [filter, setFilterRaw]              = useState(() => initialFromUrl.filter ?? readSavedFilter() ?? 'all')
  const [difficultySet, setDifficultySet]   = useState(() =>
    initialFromUrl.difficultySet
      ? mapKeysToLabels(initialFromUrl.difficultySet, DIFFICULTY_MAP)
      : new Set()
  )
  const [typeSet, setTypeSet]               = useState(() =>
    initialFromUrl.typeSet
      ? mapKeysToLabels(initialFromUrl.typeSet, TYPE_MAP)
      : new Set()
  )
  const [countrySet, setCountrySet]         = useState(() => initialFromUrl.countrySet ?? new Set())
  const [dietSet, setDietSet]               = useState(() => initialFromUrl.dietSet ?? new Set())
  const [sortMode, setSortMode]             = useState(initialFromUrl.sortMode ?? 'match')
  const [seasonalOnly, setSeasonalOnly]         = useState(initialFromUrl.seasonalOnly ?? false)
  const [healthyOnly, setHealthyOnly]           = useState(initialFromUrl.healthyOnly ?? false)
  const [noCookOnly, setNoCookOnly]             = useState(initialFromUrl.noCookOnly ?? false)
  const [antiWasteOnly, setAntiWasteOnly]       = useState(initialFromUrl.antiWasteOnly ?? false)
  const [freezerFriendlyOnly, setFreezerFriendlyOnly] = useState(initialFromUrl.freezerFriendlyOnly ?? false)
  const [kidsFriendlyOnly, setKidsFriendlyOnly] = useState(initialFromUrl.kidsFriendlyOnly ?? false)
  const [batchCookingOnly, setBatchCookingOnly] = useState(initialFromUrl.batchCookingOnly ?? false)
  // Phase 10b.3 — sliders nutrition + budget (null = pas de filtre)
  const [minProtein, setMinProtein]   = useState(initialFromUrl.minProtein   ?? null)
  const [maxCalories, setMaxCalories] = useState(initialFromUrl.maxCalories  ?? null)
  const [maxBudget, setMaxBudget]     = useState(initialFromUrl.maxBudget    ?? null)

  // Wrapped setter that persists to localStorage
  const setFilter = useCallback((v) => {
    setFilterRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      try { if (VALID_FILTERS.includes(next)) localStorage.setItem(FILTER_KEY, next) } catch {}
      return next
    })
  }, [])

  // Sync filter state → URL (replace history, no new entry).
  // `searchParams` and `setSearchParams` are intentionally omitted from deps:
  // they are stable references from react-router and reading them inside would
  // cause an infinite loop (setSearchParams triggers a re-render → searchParams
  // changes → effect fires again). We snapshot non-filter params via a ref-like
  // pattern instead (iterate once, preserve unknown keys).
  useEffect(() => {
    const sp = serializeFiltersToParams({
      searchQuery, filter,
      typeSet: mapLabelsToKeys(typeSet, TYPE_TO_KEY),
      difficultySet: mapLabelsToKeys(difficultySet, DIFFICULTY_TO_KEY),
      countrySet, dietSet,
      sortMode,
      seasonalOnly, healthyOnly, noCookOnly,
      antiWasteOnly, freezerFriendlyOnly, kidsFriendlyOnly, batchCookingOnly,
      minProtein, maxCalories, maxBudget,
    })
    // Preserve any foreign params not owned by this filter system (e.g. ?crash=1 devtools)
    const ourKeys = new Set(['q','primary','type','diff','country','diet','sort','seasonal','healthy','noCook','antiWaste','freezer','kids','batch','minProt','maxCal','maxBud'])
    const preserved = new URLSearchParams()
    for (const [k, v] of searchParams) {
      if (!ourKeys.has(k)) preserved.set(k, v)
    }
    for (const [k, v] of sp) preserved.set(k, v)
    setSearchParams(preserved, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filter, typeSet, difficultySet, countrySet, dietSet, sortMode, seasonalOnly, healthyOnly, noCookOnly, antiWasteOnly, freezerFriendlyOnly, kidsFriendlyOnly, batchCookingOnly, minProtein, maxCalories, maxBudget])

  const myIds = useMemo(() => new Set(customRecipes.map(r => r.id)), [customRecipes])

  const allRecipes = useMemo(() => {
    const deduplicatedPublic = publicRecipes
      .filter(r => !myIds.has(r.id))
      .map(r => ({ ...r, _isCommunity: true }))
    return [...recipes, ...deduplicatedPublic, ...customRecipes]
  }, [recipes, publicRecipes, customRecipes, myIds])

  // useDeferredValue : le toggle d'ingrédient est rendu immédiatement,
  // et le recalcul lourd de scoreRecipes (~1700 recettes) est reporté
  // au premier instant où le thread principal est libre.
  const deferredStock = useDeferredValue(stock)

  // Garde-manger assumé : sel/poivre/épices/huiles comptés comme toujours
  // présents → une recette n'est pas pénalisée par les basiques manquants.
  const stapleIds = useMemo(() => computeStapleIds(ingredientsById), [ingredientsById])

  const scored = useMemo(
    () => scoreRecipes(allRecipes, deferredStock, groupMaps, stapleIds),
    [allRecipes, deferredStock, groupMaps, stapleIds],
  )

  const priorityIds = useMemo(() => new Set(
    leftovers
      .filter(l => l.ingredient_id && !isLeftoverExpired(l.expires_at))
      .map(l => l.ingredient_id),
  ), [leftovers])

  const getRecipeName    = (r) => r.isCustom ? (r.name ?? '') : (RECIPE_NAMES[r.id]?.[lang] ?? r.id)
  const getRecipeCountry = (r) => r.country
  const getRecipeDiets   = (r) => (r.diet ?? []).filter(d => !HIDDEN_DIETS.includes(d))

  // When stock is empty, stock-dependent filters fall back to 'all' without mutating state
  const effectiveFilter = (stock.size === 0 && ['ready', 'almost', 'priority'].includes(filter))
    ? 'all'
    : filter

  // ── Dimension predicates (used both by `filtered` and by `counts`) ──────────
  // These are helper closures — intentionally defined outside useMemo to keep
  // `filtered` untouched and avoid changing its dependency array.
  const matchesPrimary    = (r) => {
    if (effectiveFilter === 'ready')     return r.matchPercent === 1
    if (effectiveFilter === 'almost')    return r.matchPercent >= 0.6 && r.matchPercent < 1
    if (effectiveFilter === 'favorites') return favorites.has(r.id)
    if (effectiveFilter === 'custom')    return r.isCustom && !r._isCommunity
    if (effectiveFilter === 'priority') {
      if (priorityIds.size === 0) return false
      return getIngredientItemsFlat(r).some(ing => getIngredientIds(ing).some(id => priorityIds.has(id)))
    }
    return true
  }
  const matchesDifficulty = (r, set) => set.size === 0 || set.has(r.difficulty)
  const matchesType       = (r, set) => set.size === 0 || set.has(r.type)
  const matchesCountry    = (r, set) => set.size === 0 || set.has(getRecipeCountry(r))
  const matchesDiet       = (r, set) => set.size === 0 || getRecipeDiets(r).some(d => set.has(d))
  const matchesSeasonal   = (r, on)  => !on || recipeHasSeasonalIngredient(r, ingredientsById)
  const matchesHealthy    = (r, on)  => !on || isHealthyRecipe(r, ingredientsById)
  const matchesNoCook     = (r, on)  => !on || r.cook_time_min === 0
  const matchesAntiWaste  = (r, on)  => !on || (r.functional_tags ?? []).includes('anti_waste')
  const matchesFreezer    = (r, on)  => !on || (r.functional_tags ?? []).includes('freezer_friendly')
  const matchesKids       = (r, on)  => !on || (r.functional_tags ?? []).includes('kids_friendly')
  const matchesBatch      = (r, on)  => !on || (r.functional_tags ?? []).includes('batch_cooking')
  const matchesSearch     = (r, q)   => !q.trim() || norm(getRecipeName(r)).includes(norm(q))
  // Phase 10b.3 — predicates sliders nutrition + budget
  // null = pas de filtre ; sinon compare à la valeur calculée par portion.
  // Perf note : computeRecipeNutrition itère tous les ingrédients de la recette ;
  // pour 41 recettes (~200 calculs) c'est négligeable — pas de memoïzation nécessaire.
  const matchesMinProtein  = (r, min) => {
    if (min == null) return true
    const n = computeRecipeNutrition(r, ingredientsById)
    return n?.protein != null && n.protein >= min
  }
  const matchesMaxCalories = (r, max) => {
    if (max == null) return true
    const n = computeRecipeNutrition(r, ingredientsById)
    return n?.kcal != null && n.kcal <= max
  }
  const matchesMaxBudget   = (r, max) => {
    if (max == null) return true
    const cost = calcRecipeCost(r, lang, 1, ingredientsById)
    return cost != null && cost <= max
  }

  const filtered = useMemo(() => scored
    .filter(r => {
      if (effectiveFilter === 'ready')     return r.matchPercent === 1
      if (effectiveFilter === 'almost')    return r.matchPercent >= 0.6 && r.matchPercent < 1
      if (effectiveFilter === 'favorites') return favorites.has(r.id)
      if (effectiveFilter === 'custom')    return r.isCustom && !r._isCommunity
      if (effectiveFilter === 'priority') {
        if (priorityIds.size === 0) return false
        return getIngredientItemsFlat(r).some(ing => getIngredientIds(ing).some(id => priorityIds.has(id)))
      }
      return true
    })
    .filter(r => difficultySet.size === 0 || difficultySet.has(r.difficulty))
    .filter(r => typeSet.size === 0      || typeSet.has(r.type))
    .filter(r => countrySet.size === 0   || countrySet.has(getRecipeCountry(r)))
    .filter(r => dietSet.size === 0      || getRecipeDiets(r).some(d => dietSet.has(d)))
    .filter(r => !seasonalOnly || recipeHasSeasonalIngredient(r, ingredientsById))
    .filter(r => !healthyOnly  || isHealthyRecipe(r, ingredientsById))
    .filter(r => !noCookOnly           || r.cook_time_min === 0)
    .filter(r => !antiWasteOnly        || (r.functional_tags ?? []).includes('anti_waste'))
    .filter(r => !freezerFriendlyOnly  || (r.functional_tags ?? []).includes('freezer_friendly'))
    .filter(r => !kidsFriendlyOnly     || (r.functional_tags ?? []).includes('kids_friendly'))
    .filter(r => !batchCookingOnly     || (r.functional_tags ?? []).includes('batch_cooking'))
    .filter(r => matchesMinProtein(r, minProtein))
    .filter(r => matchesMaxCalories(r, maxCalories))
    .filter(r => matchesMaxBudget(r, maxBudget))
    .filter(r => matchesSearch(r, searchQuery))
    .sort((a, b) => {
      if (sortMode === 'alpha') return getRecipeName(a).localeCompare(getRecipeName(b), lang)
      if (sortMode === 'quick') return (a.time_min ?? 999) - (b.time_min ?? 999)
      return 0
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [scored, effectiveFilter, difficultySet, typeSet, countrySet, dietSet, seasonalOnly, healthyOnly, noCookOnly, antiWasteOnly, freezerFriendlyOnly, kidsFriendlyOnly, batchCookingOnly, minProtein, maxCalories, maxBudget, searchQuery, sortMode, favorites, priorityIds, ingredientsById, lang])

  // ── Facetted counts (D16) ─────────────────────────────────────────────────
  // For each filter dimension, compute how many recipes match IF that option
  // were activated, holding all OTHER active filters constant.
  // `applyOtherFilters(skipKey)` runs the full chain minus the named dimension.
  // Primary filter (ready/almost/favorites…) and search are always applied.
  const counts = useMemo(() => {
    function applyOtherFilters(skipKey) {
      return scored.filter(r => {
        if (skipKey !== 'primary'    && !matchesPrimary(r))                        return false
        if (skipKey !== 'difficulty' && !matchesDifficulty(r, difficultySet))     return false
        if (skipKey !== 'type'       && !matchesType(r, typeSet))                  return false
        if (skipKey !== 'country'    && !matchesCountry(r, countrySet))            return false
        if (skipKey !== 'diet'       && !matchesDiet(r, dietSet))                  return false
        if (skipKey !== 'seasonal'   && !matchesSeasonal(r, seasonalOnly))         return false
        if (skipKey !== 'healthy'    && !matchesHealthy(r, healthyOnly))           return false
        if (skipKey !== 'noCook'     && !matchesNoCook(r, noCookOnly))             return false
        if (skipKey !== 'antiWaste'  && !matchesAntiWaste(r, antiWasteOnly))       return false
        if (skipKey !== 'freezer'    && !matchesFreezer(r, freezerFriendlyOnly))   return false
        if (skipKey !== 'kids'       && !matchesKids(r, kidsFriendlyOnly))         return false
        if (skipKey !== 'batch'      && !matchesBatch(r, batchCookingOnly))        return false
        // Sliders — appliqués inconditionnellement (pas de facetted counts pour eux)
        if (!matchesMinProtein(r, minProtein))   return false
        if (!matchesMaxCalories(r, maxCalories)) return false
        if (!matchesMaxBudget(r, maxBudget))     return false
        if (!matchesSearch(r, searchQuery))                                        return false
        return true
      })
    }

    // Multi-select dimensions — count per option value
    const typeBase = applyOtherFilters('type')
    const byType = new Map()
    for (const r of typeBase) {
      if (!r.type) continue
      byType.set(r.type, (byType.get(r.type) ?? 0) + 1)
    }

    const difficultyBase = applyOtherFilters('difficulty')
    const byDifficulty = new Map()
    for (const r of difficultyBase) {
      if (!r.difficulty) continue
      byDifficulty.set(r.difficulty, (byDifficulty.get(r.difficulty) ?? 0) + 1)
    }

    const countryBase = applyOtherFilters('country')
    const byCountry = new Map()
    for (const r of countryBase) {
      const c = getRecipeCountry(r)
      if (!c) continue
      byCountry.set(c, (byCountry.get(c) ?? 0) + 1)
    }

    const dietBase = applyOtherFilters('diet')
    const byDiet = new Map()
    for (const r of dietBase) {
      for (const d of getRecipeDiets(r)) {
        byDiet.set(d, (byDiet.get(d) ?? 0) + 1)
      }
    }

    // Boolean toggles — count = subset without this toggle ∩ recipes that match it
    const seasonalBase  = applyOtherFilters('seasonal')
    const healthyBase   = applyOtherFilters('healthy')
    const noCookBase    = applyOtherFilters('noCook')
    const antiWasteBase = applyOtherFilters('antiWaste')
    const freezerBase   = applyOtherFilters('freezer')
    const kidsBase      = applyOtherFilters('kids')
    const batchBase     = applyOtherFilters('batch')

    // Onglets (Toutes / Prêt / Presque / Favoris) : ce que chacun montrerait
    // avec la recherche et les filtres en cours. Avant, ils gardaient leurs
    // nombres globaux — « Toutes 515 » à côté de « Aucune recette » (audit
    // 2026-10-02). `readyCount` & co restent globaux : l'accueil s'en sert.
    const primaryBase = applyOtherFilters('primary')
    const byPrimary = {
      all:       primaryBase.length,
      ready:     primaryBase.filter(r => r.matchPercent === 1).length,
      almost:    primaryBase.filter(r => r.matchPercent >= 0.6 && r.matchPercent < 1).length,
      favorites: primaryBase.filter(r => favorites.has(r.id)).length,
    }

    return {
      byPrimary,
      byType,
      byDifficulty,
      byCountry,
      byDiet,
      seasonal:  seasonalBase.filter(r  => matchesSeasonal(r, true)).length,
      healthy:   healthyBase.filter(r   => matchesHealthy(r, true)).length,
      noCook:    noCookBase.filter(r    => matchesNoCook(r, true)).length,
      antiWaste: antiWasteBase.filter(r => matchesAntiWaste(r, true)).length,
      freezer:   freezerBase.filter(r   => matchesFreezer(r, true)).length,
      kids:      kidsBase.filter(r      => matchesKids(r, true)).length,
      batch:     batchBase.filter(r     => matchesBatch(r, true)).length,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scored, effectiveFilter, difficultySet, typeSet, countrySet, dietSet, seasonalOnly, healthyOnly, noCookOnly, antiWasteOnly, freezerFriendlyOnly, kidsFriendlyOnly, batchCookingOnly, minProtein, maxCalories, maxBudget, searchQuery, favorites, priorityIds, ingredientsById, lang])

  const readyCount    = useMemo(() => scored.filter(r => r.matchPercent === 1).length,                                                                              [scored])
  const almostCount   = useMemo(() => scored.filter(r => r.matchPercent >= 0.6 && r.matchPercent < 1).length,                                                       [scored])
  const favCount      = useMemo(() => scored.filter(r => favorites.has(r.id)).length,                                                                               [scored, favorites])
  const priorityCount = useMemo(() => priorityIds.size === 0 ? 0 : scored.filter(r => getIngredientItemsFlat(r).some(ing => getIngredientIds(ing).some(id => priorityIds.has(id)))).length,  [priorityIds, scored])
  const customCount   = customRecipes.length

  const hasAdvancedFilter = typeSet.size > 0 || countrySet.size > 0 || difficultySet.size > 0 || dietSet.size > 0

  // Signature des CRITÈRES choisis par l'utilisateur — et d'eux seuls. Le
  // panneau s'en sert pour remettre la liste en haut : `filtered` change aussi
  // de référence quand `favorites` ou `stock` bougent, et liker une recette
  // renvoyait la liste en haut (signalé le 2026-10-02).
  const criteriaKey = useMemo(() => JSON.stringify([
    effectiveFilter, searchQuery, sortMode,
    [...difficultySet], [...typeSet], [...countrySet], [...dietSet],
    seasonalOnly, healthyOnly, noCookOnly, antiWasteOnly, freezerFriendlyOnly, kidsFriendlyOnly, batchCookingOnly,
    minProtein, maxCalories, maxBudget,
  ]), [effectiveFilter, searchQuery, sortMode, difficultySet, typeSet, countrySet, dietSet, seasonalOnly, healthyOnly, noCookOnly, antiWasteOnly, freezerFriendlyOnly, kidsFriendlyOnly, batchCookingOnly, minProtein, maxCalories, maxBudget])

  function resetFilters() {
    setFilterRaw('all')
    setSearchQuery('')
    setDifficultySet(new Set())
    setTypeSet(new Set())
    setCountrySet(new Set())
    setDietSet(new Set())
    setSortMode('match')
    setSeasonalOnly(false)
    setHealthyOnly(false)
    setNoCookOnly(false)
    setAntiWasteOnly(false)
    setFreezerFriendlyOnly(false)
    setKidsFriendlyOnly(false)
    setBatchCookingOnly(false)
    setMinProtein(null)
    setMaxCalories(null)
    setMaxBudget(null)
    try { localStorage.removeItem(FILTER_KEY) } catch {}
  }

  return {
    searchQuery, setSearchQuery,
    filter: effectiveFilter, setFilter,
    difficultySet,
    toggleDifficulty: (v) => setDifficultySet(s => toggleInSet(s, v)),
    clearDifficulty:  () => setDifficultySet(new Set()),
    typeSet,
    toggleType:       (v) => setTypeSet(s => toggleInSet(s, v)),
    clearType:        () => setTypeSet(new Set()),
    countrySet,
    toggleCountry:    (v) => setCountrySet(s => toggleInSet(s, v)),
    clearCountry:     () => setCountrySet(new Set()),
    dietSet,
    toggleDiet:       (v) => setDietSet(s => toggleInSet(s, v)),
    clearDiet:        () => setDietSet(new Set()),
    sortMode, setSortMode,
    seasonalOnly, setSeasonalOnly,
    healthyOnly, setHealthyOnly,
    noCookOnly, setNoCookOnly,
    antiWasteOnly, setAntiWasteOnly,
    freezerFriendlyOnly, setFreezerFriendlyOnly,
    kidsFriendlyOnly, setKidsFriendlyOnly,
    batchCookingOnly, setBatchCookingOnly,
    minProtein, setMinProtein,
    maxCalories, setMaxCalories,
    maxBudget, setMaxBudget,
    filtered,
    criteriaKey,
    counts,
    totalCount: scored.length,
    readyCount, almostCount, favCount, customCount, priorityCount,
    priorityIds,
    hasAdvancedFilter,
    getRecipeName, getRecipeCountry, getRecipeDiets,
    resetFilters,
  }
}
