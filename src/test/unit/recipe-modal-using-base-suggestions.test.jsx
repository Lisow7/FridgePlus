import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))

const lasagnesRecipe = { id: 'lasagnes', emoji: '🍝', name: { fr: 'Lasagnes maison' }, ingredients: [], steps: { fr: [] }, time: '1 h', difficulty: 'Facile', type: 'Plat', servings: 4, diet: [], allergens: [] }

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
  useBaseRecipes: () => ({
    recipeNames: { lasagnes: { fr: 'Lasagnes maison' }, 'bechamel-maison': { fr: 'Béchamel maison' } },
    recipes: [],
    recipesById: new Map([['lasagnes', lasagnesRecipe]]),
  }),
  useCountries: () => ({}), useDietTypes: () => ({}), useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(), useGroupMaps: () => ({ groupMap: {}, parentMap: {} }),
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

const getRecipesUsingBaseMock = vi.fn()
vi.mock('@features/recipes/api/recipes', () => ({
  getRecipesUsingBase: (...args) => getRecipesUsingBaseMock(...args),
}))

import RecipeModal from '@features/recipes/components/recipe-modal'

const bechamelRecipe = { id: 'bechamel-maison', name: { fr: 'Béchamel maison' }, ingredients: [], steps: { fr: [] }, time: '10 min', difficulty: 'Facile', type: 'Sauce & Base', servings: 1, diet: [], allergens: [] }

function renderModal(recipe, onClose = () => {}, variant = 'page') {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={recipe} stock={new Set()} lang="fr" onClose={onClose}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        variant={variant}
      />
    </MemoryRouter>,
  )
}

describe('RecipeModal — suggestions inverses (recettes qui utilisent cette recette)', () => {
  it('masque la section si aucune suggestion', async () => {
    getRecipesUsingBaseMock.mockResolvedValue([])
    renderModal(bechamelRecipe)
    await waitFor(() => expect(getRecipesUsingBaseMock).toHaveBeenCalledWith('bechamel-maison'))
    expect(screen.queryByText('Recettes qui utilisent cette recette')).not.toBeInTheDocument()
  })

  it('affiche une carte cliquable par suggestion', async () => {
    getRecipesUsingBaseMock.mockResolvedValue(['lasagnes'])
    renderModal(bechamelRecipe)
    await waitFor(() => expect(screen.getByText('Recettes qui utilisent cette recette')).toBeInTheDocument())
    expect(screen.getByText('Lasagnes maison', { exact: false })).toBeInTheDocument()
  })

  it('clic sur une suggestion en variant="modal" ferme onClose avant de naviguer', async () => {
    getRecipesUsingBaseMock.mockResolvedValue(['lasagnes'])
    const onClose = vi.fn()
    renderModal(bechamelRecipe, onClose, 'modal')
    await waitFor(() => expect(screen.getByText('Lasagnes maison', { exact: false })).toBeInTheDocument())
    fireEvent.click(screen.getByText('Lasagnes maison', { exact: false }))
    expect(onClose).toHaveBeenCalled()
  })
})
