import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({
    legumes: [
      { id: 'vg-tomate', labels: { fr: 'Tomate' }, allergens: [] },
      { id: 'vg-tomate-cerise', labels: { fr: 'Tomate cerise' }, allergens: [], group_id: 'vg-tomate' },
      { id: 'vg-tomate-ronde', labels: { fr: 'Tomate ronde' }, allergens: [], group_id: 'vg-tomate' },
    ],
  }),
  useBaseRecipes: () => ({ recipeNames: {}, recipes: [], recipesById: new Map() }),
  useCountries: () => ({}), useDietTypes: () => ({}), useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(),
  // vg-tomate est un parent de groupe : ses enfants concrets sont vg-tomate-cerise
  // ET vg-tomate-ronde — reproduit le cas Guacamole (2026-07-17) où la recette ne
  // liste que ["vg-tomate", "vg-tomate-cerise"] comme alternatives, mais le stock
  // réel de l'utilisateur contient vg-tomate-ronde (satisfait via effectiveStock).
  useGroupMaps: () => ({
    groupMap: { 'vg-tomate': ['vg-tomate-cerise', 'vg-tomate-ronde'] },
    parentMap: { 'vg-tomate-cerise': 'vg-tomate', 'vg-tomate-ronde': 'vg-tomate' },
  }),
}))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: false }) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1024 }))
vi.mock('@features/recipes/api/recipe-reviews', () => ({ listReviews: vi.fn().mockResolvedValue([]), aggregateReviews: vi.fn().mockReturnValue({ avg: 0, count: 0 }) }))
vi.mock('@shared/ui/pricing-test-banner', () => ({ default: () => null }))
vi.mock('@shared/ui/upgrade-gate', () => ({ UpgradeGate: ({ children }) => children }))
vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => char }))
vi.mock('@shared/ui/info-tooltip', () => ({ default: () => null }))
vi.mock('@shared/hooks/use-badge-celebration', () => ({ useBadgeCelebration: () => ({ celebrate: () => {}, BadgeCelebrationModal: () => null }) }))
vi.mock('@features/recipes/hooks/use-quick-rate-prompt', () => ({ useQuickRatePrompt: () => vi.fn() }))
vi.mock('@shared/lib/pricing/open-prices', () => ({ refreshPrices: vi.fn().mockResolvedValue({}), clearPriceCache: vi.fn() }))
vi.mock('@shared/api/cooking-logs', () => ({ logCooking: vi.fn().mockResolvedValue({}) }))
vi.mock('@features/recipes/components/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-allergens-banners', () => ({ RecipeAllergenWarning: () => null, RecipeAllergenStrip: () => null }))
vi.mock('@features/recipes/components/recipe-delete-dialog', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-modal-banners', () => ({ AdminModifiedBanner: () => null, WithdrawFeedbackBanner: () => null }))
vi.mock('@features/recipes/components/recipe-jsonld', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-substitute-popover', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-share-sheet', () => ({ default: () => null }))
vi.mock('@shared/lib/ingredients/seasonality', () => ({ isInSeason: () => false }))

import RecipeModal from '@features/recipes/components/recipe-modal'

const guacamoleRecipe = {
  id: 'guacamole', name: { fr: 'Guacamole' },
  ingredients: {
    groups: [
      { name: null, items: [
        { ids: ['vg-tomate', 'vg-tomate-cerise'], labels: { fr: '1 tomate' }, required: true },
      ] },
    ],
  },
  steps: { fr: ['Mélange tout.'] },
  time: '10 min', difficulty: 'Facile', type: 'Entrée', servings: 4, diet: [], allergens: [],
}

function renderModal(onToggleIngredient, stock) {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={guacamoleRecipe} stock={stock} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        onToggleIngredient={onToggleIngredient}
        variant="page"
      />
    </MemoryRouter>,
  )
}

describe('RecipeModal — toggle d\'un ingrédient satisfait via un parent de groupe', () => {
  it('retire le concret réellement en stock (vg-tomate-ronde), pas une autre alternative jamais possédée', () => {
    const onToggleIngredient = vi.fn()
    // Le stock réel ne contient QUE vg-tomate-ronde (enfant de vg-tomate non
    // listé dans les ids de la recette) — satisfait le slot via expandStock.
    renderModal(onToggleIngredient, new Set(['vg-tomate-ronde']))

    fireEvent.click(screen.getByText('Tomate', { exact: false }))

    expect(onToggleIngredient).toHaveBeenCalledWith('vg-tomate-ronde')
    expect(onToggleIngredient).not.toHaveBeenCalledWith('vg-tomate-cerise')
    expect(onToggleIngredient).toHaveBeenCalledTimes(1)
  })
})
