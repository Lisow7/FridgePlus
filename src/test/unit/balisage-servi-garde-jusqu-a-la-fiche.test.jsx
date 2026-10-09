import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Le balisage Recipe SERVI n'est remplacé que par une version au moins aussi
// complète (audit du 2026-10-04, SEO-06).
//
// Le HTML pré-rendu porte désormais ingrédients et étapes. Au montage, la fiche
// en mémoire n'a pas encore ses étapes (le catalogue n'en porte plus, PERF-01) :
// remplacer le nœud à ce moment-là le dégradait — et pour de bon si la lecture
// de la fiche échouait (mesuré au navigateur : 5 étapes servies, 0 après
// montage). Repère du dépôt pour « fiche complète » : la clé `steps`.

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
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))
vi.mock('@shared/lib/pricing/open-prices', () => ({ refreshPrices: vi.fn().mockResolvedValue({}), clearPriceCache: vi.fn() }))
vi.mock('@shared/api/cooking-logs', () => ({ logCooking: vi.fn().mockResolvedValue({}) }))
vi.mock('@features/recipes/components/recipe-reviews-section', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-allergens-banners', () => ({ RecipeAllergenWarning: () => null, RecipeAllergenStrip: () => null }))
vi.mock('@features/recipes/components/recipe-delete-dialog', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-modal-banners', () => ({ AdminModifiedBanner: () => null, WithdrawFeedbackBanner: () => null }))
vi.mock('@features/recipes/components/recipe-substitute-popover', () => ({ default: () => null }))
vi.mock('@features/recipes/components/recipe-share-sheet', () => ({ default: () => null }))
vi.mock('@shared/lib/ingredients/seasonality', () => ({ isInSeason: () => false }))

import RecipeModal from '@features/recipes/components/recipe-modal'

const SERVI = JSON.stringify({ '@type': 'Recipe', name: 'Pasta Carbonara', recipeInstructions: [{ '@type': 'HowToStep', text: 'Cuire.' }] })

const MINCE = {
  id: 'carbonara', name: { fr: 'Pasta Carbonara' },
  ingredients: [{ ids: ['gp-spaghetti'], qty: { unit: 'g', amount: 200 }, required: true }],
  time: '20 min', difficulty: 'Facile', type: 'plat', servings: 2, diet: [], allergens: [],
}
const COMPLETE = { ...MINCE, steps: { fr: ['Cuire les pâtes.', 'Mélanger hors du feu.'] } }

const noeud = () => document.getElementById('recipe-jsonld')

function poserLeBalisageServi() {
  const s = document.createElement('script')
  s.id = 'recipe-jsonld'
  s.type = 'application/ld+json'
  s.textContent = SERVI
  document.head.appendChild(s)
}

function monter(recipe) {
  return render(
    <MemoryRouter>
      <RecipeModal recipe={recipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()} variant="page" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  noeud()?.remove()
})

describe('le balisage servi est gardé jusqu’à la fiche complète', () => {
  it('fiche encore mince (sans étapes) : le nœud servi reste tel quel', () => {
    poserLeBalisageServi()
    monter(MINCE)
    expect(noeud()?.textContent).toBe(SERVI)
  })

  it('fiche complète : le client pose sa version, étapes comprises', () => {
    poserLeBalisageServi()
    monter(COMPLETE)
    const pose = JSON.parse(noeud().textContent)
    expect(pose.recipeInstructions).toHaveLength(2)
    expect(document.querySelectorAll('#recipe-jsonld')).toHaveLength(1)
  })

  it('la fiche arrive après coup : la version complète remplace alors le nœud servi', () => {
    poserLeBalisageServi()
    const { rerender } = monter(MINCE)
    expect(noeud().textContent).toBe(SERVI)
    rerender(
      <MemoryRouter>
        <RecipeModal recipe={COMPLETE} stock={new Set()} lang="fr" onClose={() => {}}
          favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()} variant="page" />
      </MemoryRouter>,
    )
    expect(JSON.parse(noeud().textContent).recipeInstructions).toHaveLength(2)
  })

  // Une recette communautaire n'est pas pré-rendue : son balisage client est le
  // seul. La règle « fiche complète » ne vise que le catalogue officiel mince.
  it('recette communautaire, même sans clé `steps` : son balisage est posé', () => {
    monter({ ...MINCE, id: 'perso-1', isCustom: true })
    expect(noeud()).not.toBeNull()
    expect(JSON.parse(noeud().textContent).name).toBeTruthy()
  })

  it('on quitte la fiche : le balisage part avec elle', () => {
    monter(COMPLETE)
    expect(noeud()).not.toBeNull()
    cleanup()
    expect(noeud()).toBeNull()
  })
})
