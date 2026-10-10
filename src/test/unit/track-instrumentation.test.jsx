import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockTrack = vi.hoisted(() => vi.fn())
const mockTrackOnce = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/observability/track', () => ({ track: mockTrack, trackOnce: mockTrackOnce }))

// Pas de user → mode invité (les writes DB sont no-op).
vi.mock('@features/fridge/api/stock', () => ({
  addToStock: vi.fn(), removeFromStock: vi.fn(), clearStock: vi.fn(), setStockExpiry: vi.fn(),
}))

// Mocks lourds pour le montage de RecipeModal
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients:    () => ({}),
  useBaseRecipes:    () => ({ recipeNames: {}, recipes: [], recipesById: new Map() }),
  useCountries:      () => ({}),
  useDietTypes:      () => ({}),
  useAllergenTypes:  () => ({}),
  useIngredientsById: () => new Map(),
  useGroupMaps:      () => ({ groupMap: {}, parentMap: {} }),
}))

vi.mock('@shared/hooks/use-subscription', () => ({
  useSubscription: () => ({ hasPremiumAccess: false }),
}))

vi.mock('@shared/hooks/use-window-width', () => ({
  useWindowWidth: () => 1024,
}))

vi.mock('@features/recipes/api/recipe-reviews', () => ({
  listReviews:      vi.fn().mockResolvedValue([]),
  aggregateReviews: vi.fn().mockReturnValue({ avg: 0, count: 0 }),
}))

// Stub composants lourds / sous-composants
vi.mock('@shared/ui/step-text', () => ({ default: () => null }))
vi.mock('@features/recipes/components/base-recipe-overlay', () => ({ default: () => null }))
vi.mock('@shared/ui/pricing-test-banner', () => ({ default: () => null }))
vi.mock('@shared/ui/upgrade-gate', () => ({ UpgradeGate: ({ children }) => children }))
vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => char }))
vi.mock('@shared/ui/info-tooltip', () => ({ default: () => null }))
vi.mock('@shared/hooks/use-badge-celebration', () => ({ useBadgeCelebration: () => ({ celebrate: () => {}, BadgeCelebrationModal: () => null }) }))
vi.mock('@features/recipes/hooks/use-quick-rate-prompt', () => ({ useQuickRatePrompt: () => vi.fn() }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
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

import { useFridgeStock } from '@features/fridge/hooks/use-fridge-stock'
import RecipeModal from '@features/recipes/components/recipe-modal'
import { useAhaTick } from '@features/recipes/hooks/use-aha-tick'

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 : ingredient_added (use-fridge-stock)
// ─────────────────────────────────────────────────────────────────────────────
describe('ingredient_added (use-fridge-stock)', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('toggleIngredient (ajout) émet ingredient_added', () => {
    const { result } = renderHook(() => useFridgeStock(null))
    act(() => { result.current.toggleIngredient('fr-oeuf') })
    expect(mockTrack).toHaveBeenCalledWith('ingredient_added', { ingredientId: 'fr-oeuf' })
  })

  it('toggleIngredient (retrait) n\'émet PAS ingredient_added', () => {
    const { result } = renderHook(() => useFridgeStock(null))
    act(() => { result.current.toggleIngredient('fr-oeuf') }) // add
    mockTrack.mockClear()
    act(() => { result.current.toggleIngredient('fr-oeuf') }) // remove
    expect(mockTrack).not.toHaveBeenCalled()
  })

  it('addBatch émet ingredient_added par id réellement ajouté', () => {
    const { result } = renderHook(() => useFridgeStock(null))
    act(() => { result.current.addBatch(['fr-oeuf', 'vg-tomate']) })
    expect(mockTrack).toHaveBeenCalledWith('ingredient_added', { ingredientId: 'fr-oeuf' })
    expect(mockTrack).toHaveBeenCalledWith('ingredient_added', { ingredientId: 'vg-tomate' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 : recipe_opened (RecipeModal)
// ─────────────────────────────────────────────────────────────────────────────
const minimalRecipe = {
  id: 'carbonara',
  ingredients: [],
  name: { fr: 'Carbonara', en: 'Carbonara' },
  steps: { fr: [], en: [] },
  time: '20 min',
  difficulty: 'Facile',
  type: 'Plat',
  servings: 2,
  diet: [],
  allergens: [],
}

function renderRecipeModal(recipeOverride = {}) {
  const recipe = { ...minimalRecipe, ...recipeOverride }
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={recipe}
        stock={new Set()}
        lang="fr"
        onClose={() => {}}
        onToggle={() => {}}
        isFavorite={false}
        onFavorite={() => {}}
        basketRecipeIds={new Set()}
        onAddToCart={() => {}}
        onRemoved={() => {}}
        variant="modal"
      />
    </MemoryRouter>
  )
}

describe('recipe_opened (RecipeModal)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('RecipeModal au mount émet recipe_opened', () => {
    renderRecipeModal({ id: 'carbonara' })
    expect(mockTrack).toHaveBeenCalledWith('recipe_opened', { recipeId: 'carbonara' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 : cookable_recipe_viewed (useAhaTick)
// ─────────────────────────────────────────────────────────────────────────────
describe('cookable_recipe_viewed (useAhaTick)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('émet trackOnce quand readyCount>0, panneau ouvert, hors recherche', () => {
    renderHook(() => useAhaTick({ open: true, stockSize: 3, readyCount: 2, searchQuery: '', onSuggestionOpen: vi.fn() }))
    expect(mockTrackOnce).toHaveBeenCalledWith('fridge-aha-tracked', 'cookable_recipe_viewed', { count: 2 })
  })

  it("n'émet pas si readyCount=0", () => {
    renderHook(() => useAhaTick({ open: true, stockSize: 3, readyCount: 0, searchQuery: '', onSuggestionOpen: vi.fn() }))
    expect(mockTrackOnce).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 : cook_completed (RecipeModal — invité)
// ─────────────────────────────────────────────────────────────────────────────
const recipeWithIngredient = {
  ...minimalRecipe,
  id: 'carbonara',
  // Fournir des étapes pour que le footer (et le bouton cookRecipe) soit affiché :
  // footer conditionné par (recipeSteps.length > 0 || user?.id).
  steps: { fr: ['Étape 1'], en: ['Step 1'] },
  ingredients: [{ ids: ['fr-oeuf'], required: true, qty: 2 }],
}

describe('cook_completed (RecipeModal)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('confirmWithdraw émet cook_completed même pour un invité', () => {
    // Monter en mode invité avec fr-oeuf dans le stock → hasStockIngredients = true
    render(
      <MemoryRouter>
        <RecipeModal
          recipe={recipeWithIngredient}
          stock={new Set(['fr-oeuf'])}
          lang="fr"
          onClose={() => {}}
          onToggle={() => {}}
          isFavorite={false}
          onFavorite={() => {}}
          basketRecipeIds={new Set()}
          onAddToCart={() => {}}
          onRemoved={() => {}}
          onToggleIngredient={() => {}}
          variant="modal"
        />
      </MemoryRouter>
    )
    // Clic "J'ai cuisiné cette recette" → enterWithdraw → step 'withdraw'
    // Le bouton contient un icône + texte, on cherche par texte partiel
    fireEvent.click(screen.getByText("J'ai cuisiné cette recette", { exact: false }))
    // Clic « Retirer du frigo » → confirmWithdraw (canConfirm = true car 1 seul ID en stock)
    fireEvent.click(screen.getByRole('button', { name: 'Retirer du frigo' }))
    expect(mockTrack).toHaveBeenCalledWith('cook_completed', { recipeId: 'carbonara' })
  })
})
