/**
 * P6 — audit d'intuitivité du 2026-10-02 : sur mobile, le panneau Recettes
 * montrait des commandes réduites à une icône (♡, 📖, « % », +, ↺) — sans
 * texte visible, et pour les puces sans nom accessible du tout. Sur un écran
 * tactile, le texte « au survol » de Créer/Vider n'apparaissait jamais.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecipeFiltersBar from '@features/recipes/components/recipe-filters-bar'
import RecipePanelHeader from '@features/recipes/components/recipe-panel-header'
import { PANEL_I18N } from '@shared/static/recipe-panel-i18n'

const t = PANEL_I18N.fr
const filters = {
  totalCount: 515, readyCount: 1, almostCount: 6, favCount: 2, customCount: 0, priorityCount: 0, priorityIds: new Set(),
  searchQuery: '', setSearchQuery: vi.fn(), filter: 'all', setFilter: vi.fn(), sortMode: 'match', setSortMode: vi.fn(),
  typeSet: new Set(), difficultySet: new Set(), dietSet: new Set(), countrySet: new Set(),
  seasonalOnly: false, healthyOnly: false, noCookOnly: false, antiWasteOnly: false,
  freezerFriendlyOnly: false, kidsFriendlyOnly: false, batchCookingOnly: false,
  minProtein: null, maxCalories: null, maxBudget: null,
}
const theme = { darkMode: false, isMobile: true, borderPanel: '#eee' }
const barre = (extra = {}) => render(
  <RecipeFiltersBar filters={{ ...filters, ...extra }} theme={theme} t={t} stock={new Set(['fr-beurre'])} setFiltersDrawerOpen={vi.fn()} />,
)

afterEach(() => { delete window.matchMedia })

describe('panneau Recettes — chaque commande dit ce qu’elle fait, aussi sur mobile', () => {
  it('les puces Favoris et Mes recettes gardent leur texte, même inactives', () => {
    barre()
    const favoris = screen.getByRole('button', { name: /Favoris/ })
    expect(favoris).toHaveTextContent('Favoris')
    expect(screen.getByRole('button', { name: /Mes recettes/ })).toHaveTextContent('Mes recettes')
  })

  it('le tri a un nom qui dit le tri en cours, et une cible d’au moins 32 px', () => {
    barre()
    const tri = screen.getByRole('button', { name: /Tri/ })
    expect(tri).toHaveAccessibleName(/correspondance/)
    expect(parseInt(tri.style.minHeight, 10)).toBeGreaterThanOrEqual(32)
  })

  it('sur un écran sans survol, « Créer » montre son texte', () => {
    window.matchMedia = (q) => ({ matches: q.includes('hover: none'), media: q, addEventListener() {}, removeEventListener() {} })
    render(<RecipePanelHeader t={t} stock={new Set(['fr-beurre'])} user={null} borderPanel="#eee" bgPanel="#fff"
      actions={{ onClose: vi.fn(), pickRandomRecipe: vi.fn(), handleResetPanel: vi.fn(), openCreateForm: vi.fn(), setShowResetConfirm: vi.fn() }} />)
    const libelle = screen.getByText(t.createShort)
    expect(libelle.style.opacity).toBe('1')
  })
})

// Audit du 2026-10-04, « petites vérités » : les trois cartes Toutes / Prêt /
// Presque portaient chacune une phrase (`allRecipesDesc`…) écrite dans le
// dictionnaire et jamais rendue ; et le titre « Recettes » était un `<p>`
// cliquable dont l'infobulle disait « Vider le frigo » alors que le clic
// réinitialisait les filtres — au clavier, rien.
describe('panneau Recettes — ce qui est écrit est dit', () => {
  it('les cartes Toutes / Prêt / Presque décrivent ce qu’elles filtrent', () => {
    barre()
    expect(screen.getByRole('button', { name: /Toutes/ })).toHaveAccessibleDescription(t.allRecipesDesc)
    expect(screen.getByRole('button', { name: /Prêt/ })).toHaveAccessibleDescription(t.readyDesc)
    expect(screen.getByRole('button', { name: /Presque/ })).toHaveAccessibleDescription(t.almostDesc)
  })

  it('« Recettes » est un titre, sans clic ni infobulle qui ment', () => {
    render(<RecipePanelHeader t={t} stock={new Set(['fr-beurre'])} user={null} borderPanel="#eee" bgPanel="#fff"
      actions={{ onClose: vi.fn(), pickRandomRecipe: vi.fn(), openCreateForm: vi.fn(), setShowResetConfirm: vi.fn() }} />)
    const titre = screen.getByRole('heading', { name: t.title })
    expect(titre).not.toHaveAttribute('title')
    expect(titre.className).not.toMatch(/cursor-pointer/)
  })
})
