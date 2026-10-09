import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// L'onglet « Coût » demandait les prix à Open Prices (Open Food Facts) dès
// son ouverture, Premium ou non : un compte gratuit, qui ne voit que le
// verrou, envoyait quand même son adresse IP à un tiers pour rien (audit du
// 2026-10-04, « petits gains et vérités », RGPD). Sous le verrou, rien ne part.

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({
    frais: [
      { id: 'gp-pates', labels: { fr: 'Pâtes' }, allergens: [] },
      { id: 'fr-beurre', labels: { fr: 'Beurre' }, allergens: ['milk'] },
    ],
  }),
  useBaseRecipes: () => ({ recipeNames: { lasagnes: { fr: 'Lasagnes maison' } }, recipes: [], recipesById: new Map() }),
  useCountries: () => ({}), useDietTypes: () => ({}), useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(), useGroupMaps: () => ({ groupMap: {}, parentMap: {} }),
}))
let mockAbonnement = { hasPremiumAccess: false }
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => mockAbonnement }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1024 }))
vi.mock('@features/recipes/api/recipe-reviews', () => ({ listReviews: vi.fn().mockResolvedValue([]), aggregateReviews: vi.fn().mockReturnValue({ avg: 0, count: 0 }) }))
vi.mock('@shared/ui/pricing-test-banner', () => ({ default: () => null }))
vi.mock('@shared/ui/upgrade-gate', () => ({ UpgradeGate: () => <div data-testid="verrou" /> }))
vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => char }))
vi.mock('@shared/ui/info-tooltip', () => ({ default: () => null }))
vi.mock('@shared/hooks/use-badge-celebration', () => ({ useBadgeCelebration: () => ({ celebrate: () => {}, BadgeCelebrationModal: () => null }) }))
vi.mock('@features/recipes/hooks/use-quick-rate-prompt', () => ({ useQuickRatePrompt: () => vi.fn() }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
const mockRefreshPrices = vi.hoisted(() => vi.fn().mockResolvedValue({}))
vi.mock('@shared/lib/pricing/open-prices', () => ({ refreshPrices: mockRefreshPrices, clearPriceCache: vi.fn() }))
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

const recette = {
  id: 'lasagnes', name: { fr: 'Lasagnes maison' },
  ingredients: { groups: [{ name: null, items: [{ id: 'gp-pates', amount: 250, unit: 'g', required: true }, { id: 'fr-beurre', amount: 40, unit: 'g', required: true }] }] },
  steps: { fr: ['Prépare une béchamel bien lisse.'] },
  time: '1 h 20', difficulty: 'Intermédiaire', type: 'Plat', servings: 6, diet: [], allergens: [],
}

function ouvrirLOngletCout() {
  render(
    <MemoryRouter>
      <RecipeModal recipe={recette} stock={new Set()} lang="fr" onClose={() => {}} favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()} onToggleIngredient={() => {}} variant="page" />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('tab', { name: /Coût/ }))
}

beforeEach(() => { mockRefreshPrices.mockClear() })

describe('onglet « Coût » : les prix ne partent pas sous le verrou', () => {
  it('compte gratuit : le verrou, et aucune demande à Open Prices', () => {
    mockAbonnement = { hasPremiumAccess: false }
    ouvrirLOngletCout()
    expect(screen.getAllByTestId('verrou').length).toBeGreaterThan(0)
    expect(mockRefreshPrices).not.toHaveBeenCalled()
  })

  it('Premium : les prix sont demandés', () => {
    mockAbonnement = { hasPremiumAccess: true }
    ouvrirLOngletCout()
    expect(mockRefreshPrices).toHaveBeenCalledTimes(1)
  })
})
