import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

// Un écran vide propose de quoi repartir (audit du 2026-10-04, UX-12 ; décision
// « 2 ou 3 actions » d'Antoine, maquettes de la décision du 2026-10-08 tranchées le
// 2026-10-08, `etats_vides = comme_montre`) : favoris, journal de cuisine et
// notifications n'offraient qu'une phrase.
//
// « Voir les recettes prêtes » n'a de sens qu'avec un frigo non vide : le
// filtre « Prêt » retombe sinon sur toutes les recettes. Frigo vide, le bouton
// dit « Voir les recettes » et ouvre toutes les recettes.

const mockStock = vi.hoisted(() => ({ current: new Set() }))
vi.mock('@shared/contexts/session-state-context', () => ({ useStockSession: () => ({ stock: mockStock.current }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({ recipes: [], recipeNames: {} }),
  useCountries: () => ({}),
}))
vi.mock('@features/profile/hooks/use-profile-state', () => ({
  useProfileState: () => ({ journalLogs: [], journalCount: 0, statsLogs: [] }),
}))
vi.mock('@shared/api/community', () => ({ getMyCustomRecipesForResolution: () => Promise.resolve([]) }))
vi.mock('@features/profile/components/cooking-stats-section', () => ({ default: () => null }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useOutletContext: () => ({ lang: 'fr', darkMode: false, user: { id: 'u1' } }) }
})
vi.mock('@features/notifications/hooks/use-notifications', () => ({
  useNotifications: () => ({
    notifications: [], loading: false, loadError: null, refresh: vi.fn(),
    markRead: vi.fn(), markAllRead: vi.fn(), deleteNotif: vi.fn(), deleteAllRead: vi.fn(),
  }),
}))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1280 }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))

import { EmptyFavorites } from '@features/recipes/components/recipe-empty-state'
import { PANEL_I18N } from '@shared/static/recipe-panel-i18n'
import ProfileActivityPage from '@features/profile/pages/profile-activity-page'
import NotificationsPanel from '@features/notifications/components/notifications-panel'

function Arrivee() {
  const l = useLocation()
  return <p data-testid="arrivee">{l.pathname + l.search + l.hash}</p>
}

beforeEach(() => { mockStock.current = new Set() })

describe('favoris vides', () => {
  it('frigo garni : « Voir les recettes prêtes » ouvre le filtre Prêt, « Chercher une recette » la recherche', () => {
    const onShowRecipes = vi.fn()
    const onSearch = vi.fn()
    render(<EmptyFavorites t={PANEL_I18N.fr} darkMode={false} stockSize={3} onShowRecipes={onShowRecipes} onSearch={onSearch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Voir les recettes prêtes' }))
    expect(onShowRecipes).toHaveBeenCalledWith('ready')
    fireEvent.click(screen.getByRole('button', { name: 'Chercher une recette' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('frigo vide : « Voir les recettes » ouvre toutes les recettes', () => {
    const onShowRecipes = vi.fn()
    render(<EmptyFavorites t={PANEL_I18N.fr} darkMode={false} stockSize={0} onShowRecipes={onShowRecipes} onSearch={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Voir les recettes prêtes' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voir les recettes' }))
    expect(onShowRecipes).toHaveBeenCalledWith('all')
  })

  it('en anglais', () => {
    render(<EmptyFavorites t={PANEL_I18N.en} darkMode={false} stockSize={3} onShowRecipes={vi.fn()} onSearch={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'See ready recipes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search for a recipe' })).toBeInTheDocument()
  })
})

describe('journal de cuisine vide', () => {
  function monter() {
    render(
      <MemoryRouter initialEntries={['/profile/activite']}>
        <Routes>
          <Route path="/profile/activite" element={<ProfileActivityPage />} />
          <Route path="/" element={<Arrivee />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('frigo garni : « Voir les recettes prêtes » ouvre le panneau sur le filtre Prêt', () => {
    mockStock.current = new Set(['fr-oeuf'])
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Voir les recettes prêtes' }))
    expect(screen.getByTestId('arrivee')).toHaveTextContent('/?recettes=1&primary=ready')
  })

  // Sans `primary`, le panneau reprendrait le filtre ENREGISTRÉ (Favoris, Mes
  // recettes…) : « Voir les recettes » pourrait rouvrir un écran vide.
  it('frigo vide : « Voir les recettes » ouvre le panneau sur toutes les recettes, quel que soit le filtre enregistré', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Voir les recettes' }))
    expect(screen.getByTestId('arrivee').textContent).toBe('/?recettes=1&primary=all')
  })
})

describe('notifications vides', () => {
  // Depuis le 2026-10-08, les notifications se règlent dans Profil → Préférences.
  it('« Régler les notifications » mène au bloc Notifications des Préférences, et ferme le panneau', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<NotificationsPanel lang="fr" onClose={onClose} />} />
          <Route path="/profile/preferences" element={<Arrivee />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Régler les notifications' }))
    expect(onClose).toHaveBeenCalled()
    expect(screen.getByTestId('arrivee')).toHaveTextContent('/profile/preferences#notifications')
  })
})
