import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Le statut de chaque ingrédient se dit en mots (audit du 2026-10-04, A11Y-06).
//
// La pastille de chaque ingrédient (✓ ✗ ○) portait `aria-label={ingName}` :
// l'accessibilité annonçait « Beurre, bouton », jamais « dans ton frigo » ni
// « manquant » — l'information centrale du produit (« puis-je cuisiner ça avec
// ce que j'ai ? ») échappait aux lecteurs d'écran, sur les 515 fiches.
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
  useBaseRecipes: () => ({ recipeNames: { 'omelette-test': { fr: 'Omelette test' } }, recipes: [], recipesById: new Map() }),
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

import RecipeModal from '@features/recipes/components/recipe-modal'

const recette = {
  id: 'omelette-test', name: { fr: 'Omelette test' }, time: '10 min', difficulty: 'Facile', type: 'Plat', servings: 2, diet: [], allergens: [],
  steps: { fr: ['Battre les oeufs.'] },
  ingredients: [
    { ids: ['fr-oeufs-test'], labels: { fr: 'Oeufs', en: 'Eggs' }, required: true },
    { ids: ['fr-lait-test'], labels: { fr: 'Lait', en: 'Milk' }, required: true },
    { ids: ['sp-ciboulette-test'], labels: { fr: 'Ciboulette', en: 'Chives' }, required: false },
  ],
}

describe('statut des ingrédients dit en mots', () => {
  it('dans le frigo, manquant, optionnel : chaque pastille le dit', () => {
    render(
      <MemoryRouter>
        <RecipeModal recipe={recette} stock={new Set(['fr-oeufs-test'])} lang="fr" onClose={() => {}}
          favorites={new Set()} onToggleFavorite={() => {}} onToggleIngredient={() => {}} basketRecipeIds={new Set()} variant="page" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /Oeufs.*Dans ton frigo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lait.*Manquant/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ciboulette.*Optionnel/ })).toBeInTheDocument()
  })
})
