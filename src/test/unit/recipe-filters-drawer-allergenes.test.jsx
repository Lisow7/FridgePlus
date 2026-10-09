/**
 * P7 — audit d'intuitivité du 2026-10-02 : les allergènes ne se réglaient que
 * dans /profile/preferences, réservé aux comptes — alors que `auth-provider`
 * sait les garder sur l'appareil pour un invité. Sujet de sécurité : il doit
 * être à portée de tous, là où l'on choisit ses recettes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockAuth = vi.hoisted(() => ({ current: { user: null, allergenPrefs: [], updateAllergenPrefs: vi.fn() } }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => mockAuth.current }))
// Le message « Pas enregistré » a ses propres tests (allergen-prefs-chips-ecriture-refusee).
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@shared/contexts/data-provider', () => ({
  useAllergenTypes: () => ({
    gluten: { icon: '🌾', labels: { fr: 'Gluten', en: 'Gluten' } },
    lait:   { icon: '🥛', labels: { fr: 'Lait', en: 'Milk' } },
  }),
}))

import RecipeFiltersDrawer from '@features/recipes/components/filters/recipe-filters-drawer'

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
  i18n: { title: 'Filtres', reset: 'Tout effacer', apply: (n) => `${n} recettes`, type: 'Type', difficulty: 'Niveau', diet: 'Régime', country: 'Pays' },
  getTypeColor: noop, getDifficultyColor: noop, getDietColor: noop,
}

beforeEach(() => {
  mockAuth.current = { user: null, allergenPrefs: [], updateAllergenPrefs: vi.fn() }
})

describe('tiroir des filtres — mes allergènes, pour tous', () => {
  it('un invité voit la section et ses allergènes', () => {
    render(<RecipeFiltersDrawer {...props} />)
    expect(screen.getByText('Mes allergènes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gluten/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/gardés sur cet appareil/)).toBeInTheDocument()
  })

  it('cocher un allergène l’enregistre (appareil pour un invité, profil pour un compte)', async () => {
    const user = userEvent.setup()
    mockAuth.current.allergenPrefs = ['lait']
    render(<RecipeFiltersDrawer {...props} />)
    expect(screen.getByRole('button', { name: /Lait/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Gluten/ }))
    expect(mockAuth.current.updateAllergenPrefs).toHaveBeenCalledWith(['lait', 'gluten'])
  })

  it('un compte lit « enregistrés dans ton profil »', () => {
    mockAuth.current.user = { id: 'u1' }
    mockAuth.current.allergenConsentAt = '2026-10-06T12:00:00Z' // accord donné (décision du 2026-10-06)
    render(<RecipeFiltersDrawer {...props} />)
    expect(screen.getByText(/enregistrés dans ton profil/)).toBeInTheDocument()
  })
})
