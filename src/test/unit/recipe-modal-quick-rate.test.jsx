import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: false }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
  useBaseRecipes: () => ({ recipeNames: {}, recipes: [], recipesById: new Map() }),
  useCountries: () => ({}), useDietTypes: () => ({}), useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(), useGroupMaps: () => ({ groupMap: {}, parentMap: {} }),
}))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: false }) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1024 }))
vi.mock('@features/recipes/api/recipes', () => ({ getRecipesUsingBase: vi.fn().mockResolvedValue([]) }))
vi.mock('@features/recipes/api/recipe-reviews', () => ({ listReviews: vi.fn().mockResolvedValue([]), aggregateReviews: vi.fn().mockReturnValue({ avg: 0, count: 0 }) }))
vi.mock('@shared/ui/pricing-test-banner', () => ({ default: () => null }))
vi.mock('@shared/ui/upgrade-gate', () => ({ UpgradeGate: ({ children }) => children }))
vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => char }))
vi.mock('@shared/ui/info-tooltip', () => ({ default: () => null }))
vi.mock('@shared/hooks/use-badge-celebration', () => ({ useBadgeCelebration: () => vi.fn() }))
vi.mock('@shared/lib/pricing/open-prices', () => ({ refreshPrices: vi.fn().mockResolvedValue({}), clearPriceCache: vi.fn() }))
const logCookingMock = vi.fn().mockResolvedValue({})
vi.mock('@shared/api/cooking-logs', () => ({ logCooking: (...args) => logCookingMock(...args) }))
const promptQuickRateMock = vi.fn()
vi.mock('@features/recipes/hooks/use-quick-rate-prompt', () => ({ useQuickRatePrompt: () => promptQuickRateMock }))
vi.mock('@features/recipes/components/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-allergens-banners', () => ({ RecipeAllergenWarning: () => null, RecipeAllergenStrip: () => null }))
vi.mock('@features/recipes/components/recipe-delete-dialog', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-modal-banners', () => ({ AdminModifiedBanner: () => null, WithdrawFeedbackBanner: () => null }))
vi.mock('@features/recipes/components/recipe-jsonld', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-substitute-popover', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-share-sheet', () => ({ default: () => null }))
vi.mock('@shared/lib/ingredients/seasonality', () => ({ isInSeason: () => false }))

import RecipeModal from '@features/recipes/components/recipe-modal'

const soloRecipe = {
  id: 'bechamel-maison', name: { fr: 'Béchamel maison' },
  ingredients: [{ ids: ['fr-beurre'], qty: { unit: 'g', amount: 40 }, required: true }],
  steps: { fr: [] }, time: '10 min', difficulty: 'Facile', type: 'Sauce & Base',
  servings: 4, diet: [], allergens: [],
}

function renderModal() {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={soloRecipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        onToggleIngredient={() => {}} variant="modal"
      />
    </MemoryRouter>,
  )
}

describe('RecipeModal — notation rapide post-cuisson', () => {
  it('clic sur "J\'ai cuisiné cette recette" (aucun ingrédient en stock) : appelle useQuickRatePrompt après logCooking', async () => {
    renderModal()
    fireEvent.click(screen.getByText("J'ai cuisiné cette recette"))
    await waitFor(() => expect(logCookingMock).toHaveBeenCalled())
    await waitFor(() => expect(promptQuickRateMock).toHaveBeenCalledWith('u1', { recipeId: 'bechamel-maison', recipeSource: 'base', lang: 'fr' }))
  })
})
