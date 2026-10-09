import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))

const bechamelRecipe = {
  id: 'bechamel-maison', name: { fr: 'Béchamel maison' },
  ingredients: [{ ids: ['fr-lait'], required: true }],
  steps: { fr: ['Fais fondre le beurre.'] }, time: '10 min', difficulty: 'Facile',
  type: 'Sauce & Base', servings: 1, diet: [], allergens: [],
}

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({ frais: [{ id: 'fr-lait', labels: { fr: 'Lait' }, allergens: ['milk'] }] }),
  useBaseRecipes: () => ({
    recipeNames: { lasagnes: { fr: 'Lasagnes maison' }, 'bechamel-maison': { fr: 'Béchamel maison' } },
    recipes: [],
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
vi.mock('@shared/lib/pricing/open-prices', () => ({ refreshPrices: vi.fn().mockResolvedValue({}), clearPriceCache: vi.fn() }))
vi.mock('@shared/api/cooking-logs', () => ({ logCooking: vi.fn().mockResolvedValue({}) }))
vi.mock('@features/recipes/components/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-allergens-banners', () => ({
  RecipeAllergenWarning: () => null,
  RecipeAllergenStrip: ({ allergens }) => <div data-testid="allergen-strip">{allergens.join(',')}</div>,
}))
vi.mock('@features/recipes/components/recipe-delete-dialog', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-modal-banners', () => ({ AdminModifiedBanner: () => null, WithdrawFeedbackBanner: () => null }))
vi.mock('@features/recipes/components/recipe-jsonld', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-substitute-popover', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-share-sheet', () => ({ default: () => null }))
vi.mock('@shared/lib/ingredients/seasonality', () => ({ isInSeason: () => false }))
// Bug préexistant hors périmètre (Tâche 3) : recipeToSchemaOrg lit
// `recipe.ingredients` directement (format array legacy) au lieu de passer
// par `getIngredientItemsFlat`, et crashe sur le format groupé `{ groups,
// sub_recipes }`. Mocké ici pour isoler ce test du bug ; signalé dans le
// rapport de tâche, non corrigé (hors des 3 fichiers du brief).
vi.mock('@features/recipes/lib/recipe-to-schema-org', () => ({ recipeToSchemaOrg: () => null }))

import RecipeModal from '@features/recipes/components/recipe-modal'

const lasagnesRecipe = {
  id: 'lasagnes', name: { fr: 'Lasagnes maison' },
  // Cas volontairement dégradé : l'auteur a oublié de dupliquer le lait/beurre
  // de la béchamel dans ses propres groupes. Le filet de sécurité doit quand
  // même faire remonter l'allergène "milk" via sub_recipes.
  ingredients: {
    groups: [{ name: null, items: [{ id: 'gp-pates', amount: 250, unit: 'g', required: true }] }],
    sub_recipes: [{ recipe_id: 'bechamel-maison', scale: 1 }],
  },
  steps: { fr: ['Prépare une béchamel bien lisse.'] },
  time: '1 h 20', difficulty: 'Intermédiaire', type: 'Plat', servings: 6, diet: [], allergens: [],
}

describe('RecipeModal — filet de sécurité allergènes sous-recette', () => {
  it('inclut les allergènes de la sous-recette référencée même sans duplication', () => {
    render(
      <MemoryRouter>
        <RecipeModal
          recipe={lasagnesRecipe} stock={new Set()} lang="fr" onClose={() => {}}
          favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
          variant="page"
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('allergen-strip')).toHaveTextContent('milk')
  })
})
