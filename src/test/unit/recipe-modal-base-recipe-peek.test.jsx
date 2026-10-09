import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))

const bechamelRecipe = {
  id: 'bechamel-maison', name: { fr: 'Béchamel maison' }, ingredients: [],
  steps: { fr: ['Mélange le beurre et la farine.'] }, time: '10 min', difficulty: 'Facile',
  type: 'Sauce', servings: 1, diet: [], allergens: [],
}

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
  // NOTE: recipeNames doit contenir les DEUX recettes (pas seulement la
  // recette de base). RecipeModal résout le titre affiché (h2) via
  // `recipeNames[recipe.id]` pour les recettes non-custom (recipe-modal.jsx
  // ~L335-337) — PAS via `recipe.name` directement (celui-ci n'est utilisé
  // que pour l'aria-label du dialog, L645). Sans ces entrées, le h2 retombe
  // sur l'id brut ("lasagnes", "bechamel-maison") et les assertions sur le
  // texte visible échouent — comportement pré-existant, indépendant du
  // wiring testé ici.
  useBaseRecipes: () => ({
    recipeNames: { lasagnes: { fr: 'Lasagnes maison' }, 'bechamel-maison': { fr: 'Béchamel maison' } },
    // L'aperçu lit la recette de base par useRecipeById (le catalogue n'a plus
    // les étapes, audit du 2026-10-04, PERF-01) : catalogue arrivé, recette
    // complète en mémoire.
    recipes: [bechamelRecipe],
    catalogStatus: 'ok',
    recipesById: new Map([['bechamel-maison', bechamelRecipe]]),
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
  id: 'lasagnes', name: { fr: 'Lasagnes maison' }, ingredients: [],
  steps: { fr: ['Prépare une béchamel bien lisse.'] },
  time: '1 h 20', difficulty: 'Intermédiaire', type: 'Plat', servings: 6, diet: [], allergens: [],
}

function renderModal() {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={lasagnesRecipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        variant="page"
      />
    </MemoryRouter>,
  )
}

describe('RecipeModal — navigation vers une recette de base', () => {
  it('clic sur le lien recette de base ouvre l\'overlay avec la recette de base', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /béchamel/i }))
    expect(screen.getByText('Retour à Lasagnes maison')).toBeInTheDocument()
    expect(screen.getAllByText('Béchamel maison').length).toBeGreaterThan(0)
  })

  it('clic sur le bandeau de retour referme l\'overlay et réaffiche la recette d\'origine', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /béchamel/i }))
    fireEvent.click(screen.getByText('Retour à Lasagnes maison'))
    expect(screen.queryByText('Retour à Lasagnes maison')).not.toBeInTheDocument()
    expect(screen.getByText('Lasagnes maison')).toBeInTheDocument()
  })
})
