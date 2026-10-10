import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
const celebrateMock = vi.fn()
vi.mock('@shared/hooks/use-badge-celebration', () => ({ useBadgeCelebration: () => celebrateMock }))
const signalerMock = vi.fn()
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signalerMock }))
vi.mock('@shared/lib/pricing/open-prices', () => ({ refreshPrices: vi.fn().mockResolvedValue({}), clearPriceCache: vi.fn() }))
const logCookingMock = vi.fn().mockResolvedValue({})
vi.mock('@shared/api/cooking-logs', () => ({ logCooking: (...args) => logCookingMock(...args) }))
const promptQuickRateMock = vi.fn()
vi.mock('@features/recipes/hooks/use-quick-rate-prompt', () => ({ useQuickRatePrompt: () => promptQuickRateMock }))
vi.mock('@features/recipes/components/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-allergens-banners', () => ({ RecipeAllergenWarning: () => null, RecipeAllergenStrip: () => null }))
vi.mock('@features/recipes/components/recipe-delete-dialog', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-modal-banners', () => ({ AdminModifiedBanner: () => null, WithdrawFeedbackBanner: () => null }))
vi.mock('@features/recipes/components/recipe-jsonld', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-substitute-popover', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-share-sheet', () => ({ default: () => null }))
vi.mock('@shared/lib/ingredients/seasonality', () => ({ isInSeason: () => false }))

import RecipeModal from '@features/recipes/components/recipe-modal'

const soloRecipe = {
  id: 'bechamel-maison', name: { fr: 'Béchamel maison' },
  ingredients: [{ ids: ['fr-beurre'], qty: { unit: 'g', amount: 40 }, required: true }],
  steps: { fr: [] }, time: '10 min', difficulty: 'Facile', type: 'Sauce & Base',
  servings: 4, diet: [], allergens: [],
}

function renderModal() {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={soloRecipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        onToggleIngredient={() => {}} variant="modal"
      />
    </MemoryRouter>,
  )
}

// Ce que la fiche affirme une fois le plat noté (écrit par le pied de fiche).
const CONFIRMATION = /Ajoutée à ton journal de cuisine/

describe('RecipeModal — notation rapide post-cuisson', () => {
  beforeEach(() => {
    logCookingMock.mockReset(); logCookingMock.mockResolvedValue({ error: null })
    promptQuickRateMock.mockReset(); celebrateMock.mockReset(); signalerMock.mockReset()
  })

  // Hors audit, trouvé le 2026-10-05 : `logCooking` ne rendait rien, et la
  // suite partait quoi qu'il arrive.
  it('le journal refuse : pas de célébration, pas d’invite à noter, pas de « Ajoutée à ton journal » — et c’est dit', async () => {
    logCookingMock.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    renderModal()
    fireEvent.click(screen.getByText("J’ai cuisiné cette recette"))
    await waitFor(() => expect(signalerMock).toHaveBeenCalledWith('cooking'))
    expect(celebrateMock).not.toHaveBeenCalled()
    expect(promptQuickRateMock).not.toHaveBeenCalled()
    expect(screen.queryByText(CONFIRMATION)).toBeNull()
  })

  it('le journal accepte : la confirmation s’affiche, la célébration part, rien d’autre n’est dit (témoin)', async () => {
    renderModal()
    fireEvent.click(screen.getByText("J’ai cuisiné cette recette"))
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
    expect(celebrateMock).toHaveBeenCalledTimes(1)
    expect(signalerMock).not.toHaveBeenCalled()
  })

  it('la confirmation n’est pas affichée AVANT la réponse de la base', async () => {
    let trancher
    logCookingMock.mockReturnValue(new Promise((resolve) => { trancher = resolve }))
    renderModal()
    fireEvent.click(screen.getByText("J’ai cuisiné cette recette"))
    await waitFor(() => expect(logCookingMock).toHaveBeenCalled())
    expect(screen.queryByText(CONFIRMATION)).toBeNull()
    trancher({ error: null })
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
  })

  it('clic sur "J’ai cuisiné cette recette" (aucun ingrédient en stock) : appelle useQuickRatePrompt après logCooking', async () => {
    renderModal()
    fireEvent.click(screen.getByText("J’ai cuisiné cette recette"))
    await waitFor(() => expect(logCookingMock).toHaveBeenCalled())
    await waitFor(() => expect(promptQuickRateMock).toHaveBeenCalledWith('u1', { recipeId: 'bechamel-maison', recipeSource: 'base', lang: 'fr' }))
  })
})
