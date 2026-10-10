/**
 * P6 — audit d'intuitivité du 2026-10-02 : sur mobile, le panneau Recettes
 * montrait des commandes réduites à une icône (♡, 📖, « % », +, ↺) — sans
 * texte visible, et pour les puces sans nom accessible du tout. Sur un écran
 * tactile, le texte « au survol » de Créer/Vider n'apparaissait jamais.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    barre({ customCount: 2 })
    const favoris = screen.getByRole('button', { name: /Favoris/ })
    expect(favoris).toHaveTextContent('Favoris')
    expect(screen.getByRole('button', { name: /Mes recettes/ })).toHaveTextContent('Mes recettes')
  })

})

// Décision du 2026-10-08 : environ 9 commandes au lieu de 14. Créer, Au hasard et
// Vider passent dans un menu « ⋯ » ; « Mes recettes » n’apparaît que si tu en as
// créé ; le tri ne reste que dans le tiroir des filtres.
describe('panneau Recettes — moins de commandes', () => {
  const actions = () => ({ onClose: vi.fn(), pickRandomRecipe: vi.fn(), openCreateForm: vi.fn(), setShowResetConfirm: vi.fn() })
  const entete = ({ user = { id: 'u-1' }, stock = new Set(['fr-beurre']), a = actions() } = {}) => {
    render(<RecipePanelHeader t={t} stock={stock} user={user} borderPanel="#eee" bgPanel="#fff" actions={a} />)
    return a
  }

  it('« Mes recettes » n’apparaît que si tu en as créé — ou si ce filtre est actif', () => {
    const { unmount } = barre({ customCount: 0 })
    expect(screen.queryByRole('button', { name: /Mes recettes/ })).toBeNull()
    unmount()
    barre({ customCount: 0, filter: 'custom' })
    expect(screen.getByRole('button', { name: /Mes recettes/ })).toBeInTheDocument()
  })

  it('le tri n’est plus dans la barre : il vit dans le tiroir des filtres', () => {
    barre()
    expect(screen.queryByRole('button', { name: /Tri/ })).toBeNull()
  })

  it('un menu « Plus d’actions » porte Créer, Au hasard et Vider, chacun avec son texte', () => {
    const a = entete()
    expect(screen.queryByRole('button', { name: t.createRecipe })).toBeNull()
    const plus = screen.getByRole('button', { name: t.moreActions })
    expect(plus).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.click(plus)
    expect(screen.getAllByRole('menuitem').map((e) => e.textContent)).toEqual([t.createRecipe, t.rouletteLabel, t.resetTitle])
    fireEvent.click(screen.getByRole('menuitem', { name: t.resetTitle }))
    expect(a.setShowResetConfirm).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('sans compte, pas d’« Au hasard » ; frigo vide, pas de « Vider »', () => {
    entete({ user: null, stock: new Set() })
    fireEvent.click(screen.getByRole('button', { name: t.moreActions }))
    expect(screen.getAllByRole('menuitem').map((e) => e.textContent)).toEqual([t.createRecipe])
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
