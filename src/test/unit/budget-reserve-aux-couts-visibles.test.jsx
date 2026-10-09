import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null, allergenPrefs: [], updateAllergenPrefs: vi.fn() }) }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@shared/contexts/data-provider', () => ({ useAllergenTypes: () => ({}) }))

import RecipeFiltersDrawer from '@features/recipes/components/filters/recipe-filters-drawer'

// Audit du 2026-10-04, UX-07 : le curseur « Budget maximum » s'affichait pour
// tous, alors que les coûts ne se voient qu'avec l'accès Premium — un réglage
// en euros sans un seul prix à l'écran, et une porte vers une fonction payante.
const noop = () => {}
const props = {
  isOpen: true, onClose: noop, isMobile: true, darkMode: false, lang: 'fr', counts: null,
  typeSet: new Set(), toggleType: noop, difficultySet: new Set(), toggleDifficulty: noop,
  dietSet: new Set(), toggleDiet: noop, countrySet: new Set(), toggleCountry: noop, clearCountry: noop,
  sortMode: 'match', setSortMode: noop,
  seasonalOnly: false, setSeasonalOnly: noop, healthyOnly: false, setHealthyOnly: noop,
  noCookOnly: false, setNoCookOnly: noop, antiWasteOnly: false, setAntiWasteOnly: noop,
  freezerFriendlyOnly: false, setFreezerFriendlyOnly: noop, kidsFriendlyOnly: false, setKidsFriendlyOnly: noop,
  batchCookingOnly: false, setBatchCookingOnly: noop,
  minProtein: null, setMinProtein: noop, maxCalories: null, setMaxCalories: noop, maxBudget: null, setMaxBudget: noop,
  resetFilters: vi.fn(),
  typeOptions: [], difficultyOptions: [], dietOptions: [], countryOptions: [], sortOptions: [],
  resultsCount: 10,
  i18n: {
    title: 'Filtres', reset: 'Tout effacer', apply: (n) => `${n} recettes`, type: 'Type', difficulty: 'Niveau', diet: 'Régime', country: 'Pays',
    nutritionBudgetLabel: 'Nutrition & Budget', nutritionLabel: 'Nutrition',
    minProtein: 'Protéines minimum', maxCalories: 'Calories maximum', maxBudget: 'Budget maximum', maxBudgetDesc: 'Au plus X € par portion',
  },
  getTypeColor: noop, getDifficultyColor: noop, getDietColor: noop,
}

describe('tiroir des filtres — le budget, pour qui voit les coûts', () => {
  it('sans accès aux coûts : pas de curseur de budget, la section s’appelle « Nutrition »', () => {
    render(<RecipeFiltersDrawer {...props} />)
    expect(screen.queryByText('Budget maximum')).toBeNull()
    expect(screen.getByText('Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Calories maximum')).toBeInTheDocument()
  })

  it('avec accès aux coûts : le curseur est là', () => {
    render(<RecipeFiltersDrawer {...props} budgetVisible />)
    expect(screen.getByText('Budget maximum')).toBeInTheDocument()
    expect(screen.getByText('Nutrition & Budget')).toBeInTheDocument()
  })
})
