import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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
vi.mock('@features/recipes/hooks/use-quick-rate-prompt', () => ({ useQuickRatePrompt: () => vi.fn() }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
vi.mock('@features/recipes/components/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-allergens-banners', () => ({ RecipeAllergenWarning: () => null, RecipeAllergenStrip: () => null }))
vi.mock('@features/recipes/components/recipe-delete-dialog', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-modal-banners', () => ({ AdminModifiedBanner: () => null, WithdrawFeedbackBanner: () => null }))
vi.mock('@features/recipes/components/recipe-jsonld', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-substitute-popover', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-share-sheet', () => ({ default: () => null }))
vi.mock('@shared/lib/ingredients/seasonality', () => ({ isInSeason: () => false }))

import RecipeModal from '@features/recipes/components/recipe-modal'

// Deux ingrédients requis, TOUS les deux en stock : c'est la condition pour que
// « J'ai cuisiné » ouvre l'étape 2 au lieu de la court-circuiter.
const recipe = {
  id: 'bechamel-maison', name: { fr: 'Béchamel maison' },
  ingredients: [
    { ids: ['fr-beurre'], qty: { unit: 'g', amount: 40 }, required: true },
    { ids: ['gp-farine'], qty: { unit: 'g', amount: 30 }, required: true },
  ],
  steps: { fr: [] }, time: '10 min', difficulty: 'Facile', type: 'Sauce & Base',
  servings: 4, diet: [], allergens: [],
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={recipe} stock={new Set(['fr-beurre', 'gp-farine'])} lang="fr"
        onClose={() => {}} favorites={new Set()} onToggleFavorite={() => {}}
        basketRecipeIds={new Set()} onToggleIngredient={() => {}} variant="modal"
        {...props}
      />
    </MemoryRouter>,
  )
}

function ouvrirEtapeRetrait() {
  act(() => {
    fireEvent.click(screen.getByText("J’ai cuisiné cette recette"))
  })
}

describe('RecipeModal — étape de retrait (caractérisation avant découpage)', () => {
  it('« J’ai cuisiné » ouvre l’étape de retrait quand des ingrédients sont en stock', () => {
    renderModal()
    ouvrirEtapeRetrait()
    expect(screen.getByText('Quoi retirer du frigo ?')).toBeInTheDocument()
    // Le bouton nomme l'action (décision du 2026-10-08) : plus « Confirmer ».
    expect(screen.getByText('Retirer du frigo')).toBeInTheDocument()
  })

  it('le header bascule : bouton Retour affiché, actions du mode détail masquées', () => {
    renderModal()
    expect(screen.queryByRole('button', { name: 'Retour' })).not.toBeInTheDocument()
    ouvrirEtapeRetrait()
    expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument()
  })

  it('« Retour » ramène au détail sans fermer la modale', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    ouvrirEtapeRetrait()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    })
    expect(screen.queryByText('Quoi retirer du frigo ?')).not.toBeInTheDocument()
    expect(screen.getByText("J’ai cuisiné cette recette")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('« Tout désélectionner » décoche les lignes, et l’aller-retour vers le détail conserve l’état', () => {
    renderModal()
    ouvrirEtapeRetrait()
    // Au départ, tous les ingrédients sont sélectionnés, donc le bouton affiche « Tout désélectionner »
    expect(screen.getByText('Tout désélectionner')).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByText('Tout désélectionner'))
    })
    // Après décochage, le libellé bascule sur l'action inverse
    expect(screen.getByText('Tout sélectionner')).toBeInTheDocument()

    // Aller-retour : revenir au détail
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    })
    // L'étape de retrait a fermé, le titre n'existe plus
    expect(screen.queryByText('Quoi retirer du frigo ?')).not.toBeInTheDocument()
    expect(screen.getByText("J’ai cuisiné cette recette")).toBeInTheDocument()
  })

  it('« Retirer du frigo » enregistre la cuisson', () => {
    renderModal()
    ouvrirEtapeRetrait()
    act(() => {
      fireEvent.click(screen.getByText('Retirer du frigo'))
    })
    expect(logCookingMock).toHaveBeenCalled()
  })
})
