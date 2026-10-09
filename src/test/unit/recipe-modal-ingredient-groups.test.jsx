import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
let mockUser = null
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: mockUser }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({
    frais: [
      { id: 'gp-pates', labels: { fr: 'Pâtes' }, allergens: [] },
      { id: 'fr-beurre', labels: { fr: 'Beurre' }, allergens: ['milk'] },
      { id: 'fr-lait', labels: { fr: 'Lait' }, allergens: ['milk'] },
    ],
  }),
  useBaseRecipes: () => ({ recipeNames: { lasagnes: { fr: 'Lasagnes maison' } }, recipes: [], recipesById: new Map() }),
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

const lasagnesRecipe = {
  id: 'lasagnes', name: { fr: 'Lasagnes maison' },
  ingredients: {
    groups: [
      { name: null, items: [{ id: 'gp-pates', amount: 250, unit: 'g', required: true }] },
      { name: { fr: 'Pour la béchamel' }, items: [
        { id: 'fr-beurre', amount: 40, unit: 'g', required: true },
        { id: 'fr-lait', amount: 500, unit: 'ml', required: true },
      ] },
    ],
  },
  steps: { fr: ['Prépare une béchamel bien lisse.'] },
  time: '1 h 20', difficulty: 'Intermédiaire', type: 'Plat', servings: 6, diet: [], allergens: [],
}

function renderModal(onToggleIngredient = () => {}) {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={lasagnesRecipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        onToggleIngredient={onToggleIngredient}
        variant="page"
      />
    </MemoryRouter>,
  )
}

describe('RecipeModal — ingrédients groupés', () => {
  it('affiche le sous-titre du groupe nommé une seule fois, sans dupliquer les ingrédients', () => {
    renderModal()
    expect(screen.getAllByText('Pour la béchamel')).toHaveLength(1)
    expect(screen.getByText('Pâtes', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('Beurre', { exact: false })).toHaveLength(1)
    expect(screen.getAllByText('Lait', { exact: false })).toHaveLength(1)
  })

  it('préserve le mapping ingrédient → id à travers les frontières de groupe (index plat correct)', () => {
    const onToggleIngredient = vi.fn()
    renderModal(onToggleIngredient)
    fireEvent.click(screen.getByText('Lait', { exact: false }))
    expect(onToggleIngredient).toHaveBeenCalledWith('fr-lait')
  })

  // Les ingrédients manquent tous (stock vide) : le bouton « Substituts IA »
  // (Premium) accompagnait chacun, même pour un visiteur sans compte — qui ne
  // doit rencontrer aucun point d'entrée Premium (ADR 0006 ; audit du
  // 2026-10-04, PREM-08).
  it('visiteur : aucun bouton « Substituts IA »', () => {
    mockUser = null
    renderModal()
    expect(screen.queryAllByRole('button', { name: 'Substituts IA' })).toHaveLength(0)
  })

  it('compte connecté : les boutons « Substituts IA » sont là', () => {
    mockUser = { id: 'u-1' }
    try {
      renderModal()
      expect(screen.getAllByRole('button', { name: 'Substituts IA' }).length).toBeGreaterThan(0)
    } finally {
      mockUser = null
    }
  })
})
