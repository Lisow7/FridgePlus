import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, screen, act, waitFor, fireEvent } from '@testing-library/react'

const loadStockFromDB = vi.hoisted(() => vi.fn())
const loadFavoritesFromDB = vi.hoisted(() => vi.fn())
const loadCustomRecipes = vi.hoisted(() => vi.fn())
const migrateLocalStorageToDB = vi.hoisted(() => vi.fn())

vi.mock('@features/fridge/api/stock', () => ({ loadStockFromDB }))
vi.mock('@features/recipes/api/favorites', () => ({ loadFavoritesFromDB }))
vi.mock('@features/recipes/lib/custom-recipes', () => ({ loadCustomRecipes }))
vi.mock('@shared/lib/migration', () => ({ migrateLocalStorageToDB }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: 'fr', setLang: vi.fn() }) }))

import { ToastProvider } from '@shared/ui/toast/toast-provider'
import { useUserSession } from '@app/hooks/use-user-session'

// Audit du 2026-10-04, UX-02. À la connexion, un chargement en échec laissait
// l'écran tel quel — c'est voulu depuis le 28 août, rien n'est détruit — mais
// sans un mot : la personne voyait un frigo vide et le croyait vidé. Le support
// le savait (« un rafraîchissement de la page suffit le plus souvent »).
const BOB = { id: 'u-bob' }
const FRIGO = { stock: new Set(['fr-tomate']), meta: new Map(), error: null }
const FAVORIS = { favorites: new Set(['pasta']), error: null }
const TARTE = { id: 'r-tarte', name: 'Tarte' }
const PANNE = { message: 'Failed to fetch' }

function proprietes(user) {
  return {
    user, signOut: vi.fn(),
    setStock: vi.fn(), setStockMeta: vi.fn(), setFavorites: vi.fn(), setCustomRecipes: vi.fn(),
    setShowRecipes: vi.fn(), setDeletingRecipe: vi.fn(), setActiveSubcat: vi.fn(),
    modals: { admin: { close: vi.fn() }, support: { close: vi.fn() }, cart: { close: vi.fn() } },
  }
}
const monter = (props) => renderHook(({ p }) => useUserSession(p), { initialProps: { p: props }, wrapper: ToastProvider })
const message = () => screen.queryByText(/n'(a|ont) pas pu être chargé/i)

describe('useUserSession — chargement des données du compte', () => {
  beforeEach(() => {
    localStorage.clear()
    migrateLocalStorageToDB.mockReset(); migrateLocalStorageToDB.mockResolvedValue()
    loadStockFromDB.mockReset(); loadStockFromDB.mockResolvedValue(FRIGO)
    loadFavoritesFromDB.mockReset(); loadFavoritesFromDB.mockResolvedValue(FAVORIS)
    loadCustomRecipes.mockReset(); loadCustomRecipes.mockResolvedValue({ recipes: [TARTE], error: null })
  })

  it('tout se charge : l’écran est rempli, rien n’est dit', async () => {
    const p = proprietes(BOB)
    monter(p)
    await waitFor(() => expect(p.setStock).toHaveBeenCalledWith(FRIGO.stock))
    expect(p.setFavorites).toHaveBeenCalledWith(FAVORIS.favorites)
    expect(message()).toBeNull()
  })

  it('le frigo ne se charge pas : l’état est gardé tel quel, et un message le dit', async () => {
    loadStockFromDB.mockResolvedValue({ stock: new Set(), meta: new Map(), error: PANNE })
    const p = proprietes(BOB)
    monter(p)
    await waitFor(() => expect(message()).not.toBeNull())
    expect(message()).toHaveTextContent(/ton frigo/i)
    // Rien n'est écrasé par du vide (règle du 28 août).
    expect(p.setStock).not.toHaveBeenCalled()
    // Les favoris, eux, sont arrivés.
    expect(p.setFavorites).toHaveBeenCalledWith(FAVORIS.favorites)
  })

  it('les favoris ne se chargent pas : le message parle des favoris', async () => {
    loadFavoritesFromDB.mockResolvedValue({ favorites: new Set(), error: PANNE })
    monter(proprietes(BOB))
    await waitFor(() => expect(message()).not.toBeNull())
    expect(message()).toHaveTextContent(/tes favoris/i)
    expect(message()).not.toHaveTextContent(/ton frigo/i)
  })

  // Hors audit, trouvé le 2026-10-05 : la lecture des recettes rendait une
  // liste vide sur erreur, posée telle quelle à l'écran — « Mes recettes » se
  // vidait, sans un mot.
  it('les recettes du compte se chargent : elles sont posées à l’écran', async () => {
    const p = proprietes(BOB)
    monter(p)
    await waitFor(() => expect(p.setCustomRecipes).toHaveBeenCalledWith([TARTE]))
    expect(message()).toBeNull()
  })

  it('les recettes ne se chargent pas : la liste affichée est gardée, et le message parle des recettes', async () => {
    loadCustomRecipes.mockResolvedValue({ recipes: [], error: PANNE })
    const p = proprietes(BOB)
    monter(p)
    await waitFor(() => expect(message()).not.toBeNull())
    expect(message()).toHaveTextContent('Tes recettes n\'ont pas pu être chargées.')
    expect(p.setCustomRecipes).not.toHaveBeenCalled()
    // Le frigo, lui, est arrivé.
    expect(p.setStock).toHaveBeenCalledWith(FRIGO.stock)
  })

  it('frigo et recettes en échec : le message nomme les deux', async () => {
    loadStockFromDB.mockResolvedValue({ stock: new Set(), meta: new Map(), error: PANNE })
    loadCustomRecipes.mockResolvedValue({ recipes: [], error: PANNE })
    monter(proprietes(BOB))
    await waitFor(() => expect(message()).not.toBeNull())
    expect(message()).toHaveTextContent('Ton frigo et tes recettes n\'ont pas pu être chargés.')
  })

  it('tout en échec : le message nomme les trois', async () => {
    loadStockFromDB.mockResolvedValue({ stock: new Set(), meta: new Map(), error: PANNE })
    loadFavoritesFromDB.mockResolvedValue({ favorites: new Set(), error: PANNE })
    loadCustomRecipes.mockResolvedValue({ recipes: [], error: PANNE })
    monter(proprietes(BOB))
    await waitFor(() => expect(message()).not.toBeNull())
    expect(message()).toHaveTextContent('Ton frigo, tes favoris et tes recettes n\'ont pas pu être chargés.')
  })

  it('« Réessayer » relance le chargement ; une fois réussi, le message disparaît', async () => {
    loadStockFromDB.mockResolvedValueOnce({ stock: new Set(), meta: new Map(), error: PANNE })
    const p = proprietes(BOB)
    monter(p)
    await waitFor(() => expect(message()).not.toBeNull())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Réessayer' })) })
    await waitFor(() => expect(p.setStock).toHaveBeenCalledWith(FRIGO.stock))
    expect(loadStockFromDB).toHaveBeenCalledTimes(2)
    expect(message()).toBeNull()
  })

  // Sans cela, un second échec laissait le même message à l'écran : impossible
  // de savoir si le bouton avait fait quelque chose.
  it('« Réessayer » : le message s’efface le temps de la nouvelle tentative, et revient si elle échoue aussi', async () => {
    let trancher
    loadStockFromDB
      .mockResolvedValueOnce({ stock: new Set(), meta: new Map(), error: PANNE })
      .mockReturnValueOnce(new Promise((resolve) => { trancher = resolve }))
    monter(proprietes(BOB))
    await waitFor(() => expect(message()).not.toBeNull())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Réessayer' })) })
    expect(message()).toBeNull()
    await act(async () => { trancher({ stock: new Set(), meta: new Map(), error: PANNE }) })
    await waitFor(() => expect(message()).not.toBeNull())
  })

  it('le message reste tant que la personne n’a rien fait (il ne s’efface pas tout seul)', async () => {
    // Faux minuteurs AVANT l'affichage : c'est la minuterie posée à l'affichage
    // qu'il faut pouvoir avancer. (Posés après, le test passait même avec un
    // message qui s'efface au bout de cinq secondes.)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      loadStockFromDB.mockResolvedValue({ stock: new Set(), meta: new Map(), error: PANNE })
      monter(proprietes(BOB))
      await waitFor(() => expect(message()).not.toBeNull())
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(message()).not.toBeNull()
    } finally { vi.useRealTimers() }
  })

  it('un chargement qui lève (réseau coupé) est signalé aussi', async () => {
    loadStockFromDB.mockRejectedValue(new TypeError('Failed to fetch'))
    const p = proprietes(BOB)
    monter(p)
    await waitFor(() => expect(message()).not.toBeNull())
    expect(p.setStock).not.toHaveBeenCalled()
  })

  it('déconnexion : le message d’un compte ne reste pas affiché au suivant', async () => {
    loadStockFromDB.mockResolvedValue({ stock: new Set(), meta: new Map(), error: PANNE })
    const p = proprietes(BOB)
    const { rerender } = monter(p)
    await waitFor(() => expect(message()).not.toBeNull())
    rerender({ p: { ...p, user: null } })
    await waitFor(() => expect(message()).toBeNull())
  })

  it('invité : aucun chargement, aucun message', async () => {
    monter(proprietes(null))
    await act(async () => {})
    expect(loadStockFromDB).not.toHaveBeenCalled()
    expect(message()).toBeNull()
  })
})
