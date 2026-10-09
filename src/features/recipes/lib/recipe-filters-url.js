// Serialize/deserialize recipe filters state to/from URL search params.
// Refonte Recettes Phase 10b.2.

// Map des clés JS state → clé URL (raccourci)
const URL_KEYS = {
  searchQuery:         'q',
  filter:              'primary',
  typeSet:             'type',
  difficultySet:       'diff',
  countrySet:          'country',
  dietSet:             'diet',
  sortMode:            'sort',
  seasonalOnly:        'seasonal',
  healthyOnly:         'healthy',
  noCookOnly:          'noCook',
  antiWasteOnly:       'antiWaste',
  freezerFriendlyOnly: 'freezer',
  kidsFriendlyOnly:    'kids',
  batchCookingOnly:    'batch',
  // Phase 10b.3 — sliders nutrition + budget
  minProtein:          'minProt',
  maxCalories:         'maxCal',
  maxBudget:           'maxBud',
}

const PRIMARY_VALUES = new Set(['all', 'ready', 'almost', 'priority', 'favorites', 'custom'])
const SORT_VALUES    = new Set(['match', 'alpha', 'quick'])

/**
 * Serialize filters state vers URLSearchParams.
 * Convention : omettre les valeurs par défaut pour garder l'URL propre.
 *
 * @param {Object} state - { searchQuery, filter, typeSet, ... }
 * @returns {URLSearchParams}
 */
export function serializeFiltersToParams(state) {
  const sp = new URLSearchParams()
  if (state.searchQuery?.trim()) sp.set(URL_KEYS.searchQuery, state.searchQuery.trim())
  if (state.filter && state.filter !== 'all') sp.set(URL_KEYS.filter, state.filter)

  if (state.typeSet?.size)        sp.set(URL_KEYS.typeSet,        [...state.typeSet].join(','))
  if (state.difficultySet?.size)  sp.set(URL_KEYS.difficultySet,  [...state.difficultySet].join(','))
  if (state.countrySet?.size)     sp.set(URL_KEYS.countrySet,     [...state.countrySet].join(','))
  if (state.dietSet?.size)        sp.set(URL_KEYS.dietSet,        [...state.dietSet].join(','))

  if (state.sortMode && state.sortMode !== 'match') sp.set(URL_KEYS.sortMode, state.sortMode)

  if (state.seasonalOnly)        sp.set(URL_KEYS.seasonalOnly,        '1')
  if (state.healthyOnly)         sp.set(URL_KEYS.healthyOnly,         '1')
  if (state.noCookOnly)          sp.set(URL_KEYS.noCookOnly,          '1')
  if (state.antiWasteOnly)       sp.set(URL_KEYS.antiWasteOnly,       '1')
  if (state.freezerFriendlyOnly) sp.set(URL_KEYS.freezerFriendlyOnly, '1')
  if (state.kidsFriendlyOnly)    sp.set(URL_KEYS.kidsFriendlyOnly,    '1')
  if (state.batchCookingOnly)    sp.set(URL_KEYS.batchCookingOnly,    '1')

  // Phase 10b.3 — sliders
  if (state.minProtein  != null) sp.set(URL_KEYS.minProtein,  String(state.minProtein))
  if (state.maxCalories != null) sp.set(URL_KEYS.maxCalories, String(state.maxCalories))
  if (state.maxBudget   != null) sp.set(URL_KEYS.maxBudget,   String(state.maxBudget))

  return sp
}

/**
 * Deserialize URLSearchParams vers partial filters state.
 * Retourne undefined pour les clés absentes (pour ne pas overrider les defaults).
 *
 * @param {URLSearchParams} sp
 * @returns {Object} partial state (undefined keys omitted)
 */
export function deserializeFiltersFromParams(sp) {
  const out = {}

  const q = sp.get(URL_KEYS.searchQuery)
  if (q) out.searchQuery = q

  const primary = sp.get(URL_KEYS.filter)
  if (primary && PRIMARY_VALUES.has(primary)) out.filter = primary

  const type = sp.get(URL_KEYS.typeSet)
  if (type) out.typeSet = new Set(type.split(',').filter(Boolean))

  const diff = sp.get(URL_KEYS.difficultySet)
  if (diff) out.difficultySet = new Set(diff.split(',').filter(Boolean))

  const country = sp.get(URL_KEYS.countrySet)
  if (country) out.countrySet = new Set(country.split(',').filter(Boolean))

  const diet = sp.get(URL_KEYS.dietSet)
  if (diet) out.dietSet = new Set(diet.split(',').filter(Boolean))

  const sort = sp.get(URL_KEYS.sortMode)
  if (sort && SORT_VALUES.has(sort)) out.sortMode = sort

  // Booleans : présence = true. Toute autre valeur non-1 = ignorée.
  if (sp.get(URL_KEYS.seasonalOnly)        === '1') out.seasonalOnly = true
  if (sp.get(URL_KEYS.healthyOnly)         === '1') out.healthyOnly = true
  if (sp.get(URL_KEYS.noCookOnly)          === '1') out.noCookOnly = true
  if (sp.get(URL_KEYS.antiWasteOnly)       === '1') out.antiWasteOnly = true
  if (sp.get(URL_KEYS.freezerFriendlyOnly) === '1') out.freezerFriendlyOnly = true
  if (sp.get(URL_KEYS.kidsFriendlyOnly)    === '1') out.kidsFriendlyOnly = true
  if (sp.get(URL_KEYS.batchCookingOnly)    === '1') out.batchCookingOnly = true

  // Phase 10b.3 — sliders (nombres)
  const minProt = sp.get(URL_KEYS.minProtein)
  if (minProt != null && !isNaN(Number(minProt))) out.minProtein = Number(minProt)
  const maxCal = sp.get(URL_KEYS.maxCalories)
  if (maxCal != null && !isNaN(Number(maxCal))) out.maxCalories = Number(maxCal)
  const maxBud = sp.get(URL_KEYS.maxBudget)
  if (maxBud != null && !isNaN(Number(maxBud))) out.maxBudget = Number(maxBud)

  return out
}
