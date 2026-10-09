import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
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
vi.mock('@shared/hooks/use-badge-celebration', () => ({ useBadgeCelebration: () => ({ celebrate: () => {}, BadgeCelebrationModal: () => null }) }))
vi.mock('@features/recipes/hooks/use-quick-rate-prompt', () => ({ useQuickRatePrompt: () => vi.fn() }))
vi.mock('@shared/lib/pricing/open-prices', () => ({ refreshPrices: vi.fn().mockResolvedValue({}), clearPriceCache: vi.fn() }))
const logCookingMock = vi.fn().mockResolvedValue({})
vi.mock('@shared/api/cooking-logs', () => ({ logCooking: (...args) => logCookingMock(...args) }))
vi.mock('@features/recipes/components/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-allergens-banners', () => ({ RecipeAllergenWarning: () => null, RecipeAllergenStrip: () => null }))
vi.mock('@features/recipes/components/recipe-delete-dialog', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-modal-banners', () => ({ AdminModifiedBanner: () => null, WithdrawFeedbackBanner: () => null }))
vi.mock('@features/recipes/components/recipe-jsonld', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-substitute-popover', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-share-sheet', () => ({ default: () => null }))
vi.mock('@shared/lib/ingredients/seasonality', () => ({ isInSeason: () => false }))

import RecipeModal from '@features/recipes/components/recipe-modal'

const bechamelRecipe = {
  id: 'bechamel-maison', name: { fr: 'Béchamel maison' },
  // Un ingrédient avec quantité sert à vérifier que l'état initial des
  // portions part bien de `lockedServings` (via le scaleFactor appliqué à
  // l'affichage), indépendamment de la résolution du nom (INGREDIENT_LOOKUP
  // non mocké ici) — la quantité, elle, se lit directement depuis `ing.qty`.
  ingredients: [{ ids: ['fr-beurre'], qty: { unit: 'g', amount: 40 }, required: true }],
  steps: { fr: [] }, time: '10 min', difficulty: 'Facile', type: 'Sauce & Base',
  servings: 4, diet: [], allergens: [],
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={bechamelRecipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        variant="modal" {...props}
      />
    </MemoryRouter>,
  )
}

describe('RecipeModal — portions verrouillées', () => {
  it('sans lockedServings : sélecteur libre, libellé standard', () => {
    renderModal()
    expect(screen.getByText('4 pers.')).toBeInTheDocument()
    expect(screen.getByLabelText('Moins de portions')).not.toBeDisabled()
  })

  it('avec lockedServings : sélecteur désactivé, libellé de dépendance affiché', () => {
    renderModal({ lockedServings: 4, lockedByLabel: 'Lasagnes aux légumes', lockedOriginServings: 8 })
    expect(screen.getByLabelText('Moins de portions')).toBeDisabled()
    expect(screen.getByLabelText('Plus de portions')).toBeDisabled()
    expect(screen.getByText('Quantité pour 8 pers. de Lasagnes aux légumes')).toBeInTheDocument()
    expect(screen.queryByText('4 pers.')).not.toBeInTheDocument()
    expect(screen.queryByText('4.5 pers.')).not.toBeInTheDocument()
  })

  it('avec lockedServings : l\'état initial des portions part bien de lockedServings (quantités mises à l\'échelle en conséquence)', () => {
    // bechamelRecipe.servings=4, lockedServings=8 → scaleFactor=2 → 40g de beurre
    // affichés à 80g. Si l'état initial n'était pas seedé depuis lockedServings
    // (ex. bug qui garderait recipe.servings=4 par erreur), ce test échouerait
    // (afficherait 40g, pas 80g).
    renderModal({ lockedServings: 8, lockedByLabel: 'Test', lockedOriginServings: 12 })
    expect(screen.getByText(/80/)).toBeInTheDocument()
    expect(screen.queryByText(/^40/)).not.toBeInTheDocument()
  })

  it('lang="en" : libellé de dépendance en anglais', () => {
    renderModal({ lang: 'en', lockedServings: 4, lockedByLabel: 'Vegetable lasagne', lockedOriginServings: 8 })
    expect(screen.getByText('Amount for 8 servings of Vegetable lasagne')).toBeInTheDocument()
  })
})
