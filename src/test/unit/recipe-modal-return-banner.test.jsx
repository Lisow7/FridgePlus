import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}), useBaseRecipes: () => ({ recipeNames: {}, recipes: [], recipesById: new Map() }),
  useCountries: () => ({}), useDietTypes: () => ({}), useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(), useGroupMaps: () => ({ groupMap: {}, parentMap: {} }),
}))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: false }) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1024 }))
vi.mock('@features/recipes/api/recipe-reviews', () => ({ listReviews: vi.fn().mockResolvedValue([]), aggregateReviews: vi.fn().mockReturnValue({ avg: 0, count: 0 }) }))
vi.mock('@shared/ui/step-text', () => ({ default: () => null }))
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

const minimalRecipe = {
  id: 'bechamel-maison', ingredients: [], name: { fr: 'Béchamel maison', en: 'Homemade béchamel' },
  steps: { fr: [], en: [] }, time: '10 min', difficulty: 'Facile', type: 'Sauce', servings: 1, diet: [], allergens: [],
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={minimalRecipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        variant="modal" {...props}
      />
    </MemoryRouter>,
  )
}

describe('RecipeModal returnBanner', () => {
  it('sans returnBanner → aucun bandeau', () => {
    renderModal()
    expect(screen.queryByText(/Retour à/)).not.toBeInTheDocument()
  })

  it('avec returnBanner → affiche le libellé et déclenche onClick', () => {
    const onClick = vi.fn()
    renderModal({ returnBanner: { label: 'Retour à Lasagnes maison', onClick } })
    const banner = screen.getByText('Retour à Lasagnes maison')
    fireEvent.click(banner)
    expect(onClick).toHaveBeenCalled()
  })
})
