import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const addToStock = vi.hoisted(() => vi.fn())
const addFavorite = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u-bob' } }) }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: 'fr', setLang: vi.fn() }) }))
vi.mock('@features/fridge/api/stock', () => ({
  addToStock, removeFromStock: vi.fn(), clearStock: vi.fn(), loadStockFromDB: vi.fn(),
}))
vi.mock('@features/recipes/api/favorites', () => ({ addFavorite, removeFavorite: vi.fn(), loadFavoritesFromDB: vi.fn() }))
vi.mock('@features/cart/api/basket', () => ({
  loadBasketFromDB: vi.fn().mockResolvedValue({ data: [], error: null }), addBasketItems: vi.fn(), updateBasketItem: vi.fn(),
  removeBasketItem: vi.fn(), removeBasketByRecipe: vi.fn(), clearBasket: vi.fn(),
}))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn() }))

import { ToastProvider } from '@shared/ui/toast/toast-provider'
import { SessionStateProvider } from '@app/contexts/session-state-provider'
import { useStockSession, useFavoritesSession } from '@shared/contexts/session-state-context'
import { SAVE_ERROR_MESSAGES } from '@shared/hooks/use-save-error-toast'

// Le branchement de bout en bout, dans l'app : le crochet qui annule, et le
// message qui le dit. Chacun est testé seul ; ici on vérifie qu'ils se parlent.
// Rappel `onReady` plutôt qu'une écriture dans une variable externe : le
// compilateur React refuse qu'un composant modifie une valeur déclarée hors de lui.
let frigo
let favoris
function Sonde({ onReady }) {
  const stock = useStockSession()
  const favorites = useFavoritesSession()
  onReady({ stock, favorites })
  return <p data-testid="etat">{[...stock.stock].join(',')}|{[...favorites.favorites].join(',')}</p>
}
const monter = () => render(
  <ToastProvider>
    <SessionStateProvider>
      <Sonde onReady={(v) => { frigo = v.stock; favoris = v.favorites }} />
    </SessionStateProvider>
  </ToastProvider>,
)

describe('SessionStateProvider — une écriture refusée se voit et se lit', () => {
  beforeEach(() => {
    localStorage.clear()
    addToStock.mockReset()
    addFavorite.mockReset()
  })

  it('frigo : l’aliment est décoché et le message s’affiche', async () => {
    addToStock.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    monter()
    await act(async () => { frigo.toggleIngredient('fr-tomate') })
    expect(screen.getByTestId('etat')).toHaveTextContent('|')
    expect(screen.getByTestId('etat').textContent).toBe('|')
    expect(screen.getByText(SAVE_ERROR_MESSAGES.fr.fridge)).toBeInTheDocument()
  })

  it('favori : il est retiré et le message s’affiche', async () => {
    addFavorite.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    monter()
    await act(async () => { favoris.toggleFavorite('pasta') })
    expect(screen.getByTestId('etat').textContent).toBe('|')
    expect(screen.getByText(SAVE_ERROR_MESSAGES.fr.favorite)).toBeInTheDocument()
  })

  it('écriture acceptée : rien n’est dit', async () => {
    addToStock.mockResolvedValue({ error: null })
    monter()
    await act(async () => { frigo.toggleIngredient('fr-tomate') })
    expect(screen.getByTestId('etat').textContent).toBe('fr-tomate|')
    expect(screen.queryByText(SAVE_ERROR_MESSAGES.fr.fridge)).toBeNull()
  })
})
