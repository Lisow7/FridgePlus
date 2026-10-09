import { describe, it, expect } from 'vitest'
import { serializeFiltersToParams, deserializeFiltersFromParams } from '../../features/recipes/lib/recipe-filters-url'

describe('serializeFiltersToParams', () => {
  it('omet les defaults (filter=all, sort=match, sets vides, toggles false)', () => {
    const sp = serializeFiltersToParams({
      searchQuery: '', filter: 'all',
      typeSet: new Set(), difficultySet: new Set(), countrySet: new Set(), dietSet: new Set(),
      sortMode: 'match',
      seasonalOnly: false, healthyOnly: false, noCookOnly: false,
      antiWasteOnly: false, freezerFriendlyOnly: false, kidsFriendlyOnly: false, batchCookingOnly: false,
    })
    expect(sp.toString()).toBe('')
  })

  it('sérialise searchQuery (trim)', () => {
    const sp = serializeFiltersToParams({ searchQuery: '  tomate  ', filter: 'all', typeSet: new Set(), difficultySet: new Set(), countrySet: new Set(), dietSet: new Set(), sortMode: 'match' })
    expect(sp.get('q')).toBe('tomate')
  })

  it('sérialise filter ≠ all', () => {
    const sp = serializeFiltersToParams({ filter: 'ready', typeSet: new Set(), difficultySet: new Set(), countrySet: new Set(), dietSet: new Set(), sortMode: 'match' })
    expect(sp.get('primary')).toBe('ready')
  })

  it('sérialise Sets multi-select en CSV', () => {
    const sp = serializeFiltersToParams({ filter: 'all', typeSet: new Set(['plat', 'dessert']), difficultySet: new Set(), countrySet: new Set(), dietSet: new Set(['vegan']), sortMode: 'match' })
    expect(sp.get('type')).toBe('plat,dessert')
    expect(sp.get('diet')).toBe('vegan')
  })

  it('sérialise sortMode ≠ match', () => {
    const sp = serializeFiltersToParams({ filter: 'all', typeSet: new Set(), difficultySet: new Set(), countrySet: new Set(), dietSet: new Set(), sortMode: 'alpha' })
    expect(sp.get('sort')).toBe('alpha')
  })

  it('sérialise booleans true en "1"', () => {
    const sp = serializeFiltersToParams({ filter: 'all', typeSet: new Set(), difficultySet: new Set(), countrySet: new Set(), dietSet: new Set(), sortMode: 'match', seasonalOnly: true, noCookOnly: true })
    expect(sp.get('seasonal')).toBe('1')
    expect(sp.get('noCook')).toBe('1')
    expect(sp.get('healthy')).toBe(null)
  })
})

describe('deserializeFiltersFromParams', () => {
  it('URL vide → objet vide (no overriding defaults)', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams())
    expect(out).toEqual({})
  })

  it('parse searchQuery', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('q=tomate'))
    expect(out.searchQuery).toBe('tomate')
  })

  it('parse filter valide', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('primary=ready'))
    expect(out.filter).toBe('ready')
  })

  it('ignore filter invalide', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('primary=bogus'))
    expect(out.filter).toBeUndefined()
  })

  it('parse Sets multi-select depuis CSV', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('type=plat,dessert&diet=vegan'))
    expect(out.typeSet).toEqual(new Set(['plat', 'dessert']))
    expect(out.dietSet).toEqual(new Set(['vegan']))
  })

  it('parse sortMode valide', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('sort=alpha'))
    expect(out.sortMode).toBe('alpha')
  })

  it('ignore sortMode invalide', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('sort=random'))
    expect(out.sortMode).toBeUndefined()
  })

  it('parse booleans = 1', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('seasonal=1&noCook=1'))
    expect(out.seasonalOnly).toBe(true)
    expect(out.noCookOnly).toBe(true)
  })

  it('ignore booleans = 0 ou autres valeurs', () => {
    const out = deserializeFiltersFromParams(new URLSearchParams('seasonal=0&noCook=true'))
    expect(out.seasonalOnly).toBeUndefined()
    expect(out.noCookOnly).toBeUndefined()
  })
})

describe('Round-trip serialize → deserialize', () => {
  it('préserve l\'état complet', () => {
    const state = {
      searchQuery: 'tomate', filter: 'ready',
      typeSet: new Set(['plat', 'dessert']),
      difficultySet: new Set(['facile']),
      countrySet: new Set(['FR', 'IT']),
      dietSet: new Set(['vegan']),
      sortMode: 'alpha',
      seasonalOnly: true, healthyOnly: true,
      noCookOnly: true, antiWasteOnly: false,
      freezerFriendlyOnly: true, kidsFriendlyOnly: false, batchCookingOnly: true,
    }
    const sp = serializeFiltersToParams(state)
    const out = deserializeFiltersFromParams(sp)
    expect(out.searchQuery).toBe('tomate')
    expect(out.filter).toBe('ready')
    expect(out.typeSet).toEqual(new Set(['plat', 'dessert']))
    expect(out.difficultySet).toEqual(new Set(['facile']))
    expect(out.countrySet).toEqual(new Set(['FR', 'IT']))
    expect(out.dietSet).toEqual(new Set(['vegan']))
    expect(out.sortMode).toBe('alpha')
    expect(out.seasonalOnly).toBe(true)
    expect(out.healthyOnly).toBe(true)
    expect(out.noCookOnly).toBe(true)
    expect(out.antiWasteOnly).toBeUndefined()  // false n'est pas sérialisé
    expect(out.freezerFriendlyOnly).toBe(true)
    expect(out.kidsFriendlyOnly).toBeUndefined()
    expect(out.batchCookingOnly).toBe(true)
  })

  it('préserve les sliders nutrition + budget (Phase 10b.3)', () => {
    const state = {
      filter: 'all', typeSet: new Set(), difficultySet: new Set(),
      countrySet: new Set(), dietSet: new Set(), sortMode: 'match',
      minProtein: 20, maxCalories: 600, maxBudget: 8,
    }
    const sp = serializeFiltersToParams(state)
    expect(sp.get('minProt')).toBe('20')
    expect(sp.get('maxCal')).toBe('600')
    expect(sp.get('maxBud')).toBe('8')
    const out = deserializeFiltersFromParams(sp)
    expect(out.minProtein).toBe(20)
    expect(out.maxCalories).toBe(600)
    expect(out.maxBudget).toBe(8)
  })

  it('omet les sliders quand null (pas de filtre actif)', () => {
    const state = {
      filter: 'all', typeSet: new Set(), difficultySet: new Set(),
      countrySet: new Set(), dietSet: new Set(), sortMode: 'match',
      minProtein: null, maxCalories: null, maxBudget: null,
    }
    const sp = serializeFiltersToParams(state)
    expect(sp.get('minProt')).toBeNull()
    expect(sp.get('maxCal')).toBeNull()
    expect(sp.get('maxBud')).toBeNull()
    const out = deserializeFiltersFromParams(sp)
    expect(out.minProtein).toBeUndefined()
    expect(out.maxCalories).toBeUndefined()
    expect(out.maxBudget).toBeUndefined()
  })
})
