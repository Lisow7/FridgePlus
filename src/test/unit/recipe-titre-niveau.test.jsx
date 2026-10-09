import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn(), trackOnce: vi.fn() }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
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

function rendre(variant) {
  return render(
    <MemoryRouter>
      <RecipeModal
        recipe={lasagnesRecipe} stock={new Set()} lang="fr" onClose={() => {}}
        favorites={new Set()} onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        onToggleIngredient={() => {}}
        variant={variant}
      />
    </MemoryRouter>,
  )
}


// Le niveau de titre du nom de la recette.
//
// ── Le défaut, mesuré au navigateur le 2026-08-21 ─────────────────────────
// Sur `/recipe/:id`, le nom du plat était rendu en `h2`. Le seul `h1` de la
// page était donc le « Fridge+ » que l'en-tête pose en lecture d'écran seule —
// identique sur les **515 pages recette indexées**.
//
// 🔴 Et le HTML SERVI, lui, porte bien `<h1>{nom}</h1>` (`corpsRecette`, dans
// `scripts/lib/prerender-page.mjs`) : le rendu contredisait donc ce que le
// serveur envoie. Googlebot, qui exécute le JavaScript, voyait la version sans
// `h1` — l'écart exact qu'on a passé la session à supprimer ailleurs.
//
// ── Pourquoi la modale garde son `h2` ─────────────────────────────────────
// En surcouche, le titre de premier niveau appartient à la page qui est
// dessous. Promouvoir le nom du plat en `h1` y créerait deux titres de page
// concurrents. La distinction se fait sur `variant`, que le composant reçoit
// déjà.
//
// 🥇 Test de RENDU et non de source : ce soir, un test qui vérifiait qu'une
// fonction était APPELÉE est resté vert pendant que l'onglet affichait un
// identifiant. On vérifie donc la balise réellement produite.

describe('nom de la recette — niveau de titre', () => {
  it('est un h1 quand la recette occupe sa propre page', () => {
    rendre('page')
    const titre = screen.getByRole('heading', { level: 1, name: 'Lasagnes maison' })
    expect(titre.tagName).toBe('H1')
  })

  it('reste un h2 quand la recette s’affiche en surcouche', () => {
    rendre('modal')
    expect(screen.queryByRole('heading', { level: 1, name: 'Lasagnes maison' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Lasagnes maison' })).toBeInTheDocument()
  })

  it('ne produit jamais DEUX titres pour le même nom', () => {
    // Une balise conditionnelle mal écrite pourrait rendre les deux.
    rendre('page')
    expect(screen.getAllByText('Lasagnes maison').length).toBe(1)
  })
})
