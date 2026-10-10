import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const etat = vi.hoisted(() => ({ valeur: null }))
const reloadCookingLogs = vi.hoisted(() => vi.fn())

vi.mock('@features/profile/hooks/use-profile-state', () => ({ useProfileState: () => etat.valeur }))
vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({ recipes: [{ id: 'r1', emoji: '🥧' }], recipeNames: { r1: { fr: 'Tarte aux pommes', en: 'Apple pie' } } }),
  useCountries: () => ({}),
}))
vi.mock('@shared/api/community', () => ({ getMyCustomRecipesForResolution: () => Promise.resolve([]) }))
// Le journal vide propose les recettes selon le frigo (lot 13d, UX-12).
vi.mock('@shared/contexts/session-state-context', () => ({ useStockSession: () => ({ stock: new Set() }) }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ updateProfile: vi.fn() }) }))
vi.mock('@features/profile/components/cooking-stats-section', () => ({
  default: ({ logs }) => <div data-testid="cooking-stats">{logs.length} log(s)</div>,
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useOutletContext: () => ({ lang: 'fr', darkMode: false, user: { id: 'u1' }, profile: { id: 'u1', unlocked_banners: [] } }),
  }
})

import ProfileActivityPage from '@features/profile/pages/profile-activity-page'
import ProfileRewardsPage from '@features/profile/pages/profile-rewards-page'

// Audit du 2026-10-04, CPT-11. Pendant le chargement ou après un échec, les
// deux onglets affichaient leur état VIDE : « Aucune statistique pour
// l'instant. Cuisine quelques recettes… », « Cuisine ta première recette pour
// débloquer ta série ». La personne croyait avoir perdu son historique.
const LOG = { id: 'l1', recipe_id: 'r1', recipe_source: 'base', servings: 2, cooked_at: '2026-05-10T10:00:00Z' }
function profil(surcharge = {}) {
  return {
    journalLogs: [LOG], journalCount: 1, statsLogs: [LOG],
    journalError: false, statsError: false, reloadCookingLogs,
    ...surcharge,
  }
}
const activite = () => render(<MemoryRouter><ProfileActivityPage /></MemoryRouter>)
const recompenses = () => render(<MemoryRouter><ProfileRewardsPage /></MemoryRouter>)
const VIDE_STATS = /Aucune statistique pour l'instant/
// La grille des paliers : avec un journal vide, quatorze paliers tous verrouillés.
const progression = () => screen.queryByRole('heading', { name: 'Progression' })

describe('Activité — chargement, échec, vide : trois écrans différents', () => {
  beforeEach(() => { reloadCookingLogs.mockReset() })

  it('chargé : les statistiques et le journal (témoin)', () => {
    etat.valeur = profil()
    activite()
    expect(screen.getByTestId('cooking-stats')).toHaveTextContent('1 log(s)')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('statistiques en cours de chargement : ni statistiques vides, ni erreur', () => {
    etat.valeur = profil({ statsLogs: null })
    activite()
    expect(screen.queryByTestId('cooking-stats')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('statistiques pas chargées : le dit, propose de réessayer — pas de statistiques vides', () => {
    etat.valeur = profil({ statsLogs: null, statsError: true })
    activite()
    expect(screen.queryByTestId('cooking-stats')).toBeNull()
    expect(screen.queryByText(VIDE_STATS)).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(/n'a pas pu être chargée/i)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(reloadCookingLogs).toHaveBeenCalledTimes(1)
  })

  it('journal pas chargé : le dit — pas « elle apparaît ici »', () => {
    etat.valeur = profil({ journalLogs: null, journalError: true })
    activite()
    expect(screen.queryByText(/elle apparaît ici/)).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(/n'a pas pu être chargée/i)
  })

  it('journal chargé et vide : « elle apparaît ici » (témoin)', () => {
    etat.valeur = profil({ journalLogs: [], journalCount: 0 })
    activite()
    expect(screen.getByText(/elle apparaît ici/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Récompenses — chargement, échec, vide : trois écrans différents', () => {
  beforeEach(() => { reloadCookingLogs.mockReset() })

  it('chargé, rien cuisiné : la progression est là, tout reste à débloquer (témoin)', () => {
    etat.valeur = profil({ statsLogs: [], journalLogs: [] })
    recompenses()
    expect(progression()).not.toBeNull()
    expect(screen.getByText(/Cuisine cette semaine pour démarrer ta série/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // Sans cette garde, quelqu'un qui a dix badges les voyait TOUS verrouillés le
  // temps du chargement — et pour de bon si le chargement échouait.
  it('en cours de chargement : pas de grille « tout verrouillé », pas d’erreur', () => {
    etat.valeur = profil({ statsLogs: null })
    recompenses()
    expect(progression()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('pas chargé : le dit, propose de réessayer — pas de grille « tout verrouillé »', () => {
    etat.valeur = profil({ statsLogs: null, statsError: true })
    recompenses()
    expect(progression()).toBeNull()
    expect(screen.queryByText(/Cuisine cette semaine pour démarrer ta série/)).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(/n'a pas pu être chargée/i)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(reloadCookingLogs).toHaveBeenCalledTimes(1)
  })
})
