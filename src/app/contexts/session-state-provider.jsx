import { useMemo } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { useFridgeStock } from '@features/fridge/hooks/use-fridge-stock'
import { useFavorites } from '@features/recipes/hooks/use-favorites'
import { useBasket } from '@features/cart/hooks/use-basket'
import { StockContext, FavoritesContext, CartContext } from '@shared/contexts/session-state-context'

// SessionStateProvider — Sprint 11 S11.c.2.
//
// Lift le state stock + favorites en context global pour qu'il soit
// accessible depuis n'importe quelle route (RecipePage, ProfilePage,
// futur CommunityPage…) sans avoir à passer par les props depuis App.jsx.
//
// Architecture Bulletproof React :
//   - PRIMITIVES (contexts + consumer hooks) : shared/contexts/session-state-context.js
//   - ORCHESTRATION (composition des feature hooks) : ici (app/ a le
//     droit d'importer features/, shared/ ne l'aurait pas).
//
// Note (chantier DLC/restes) : le pipeline anti-gaspi (recorder d'événements de
// retrait + stats €/carbone) a été retiré avec la DLC des ingrédients. L'anti-gaspi
// vit désormais côté restes (compteur « restes sauvés »).

export function SessionStateProvider({ children }) {
  const { user } = useAuth()

  const stockApi     = useFridgeStock(user)
  const favoritesApi = useFavorites(user)
  const basketApi    = useBasket(user)

  const stockValue     = useMemo(() => stockApi,     [stockApi])
  const favoritesValue = useMemo(() => favoritesApi, [favoritesApi])
  const cartValue      = useMemo(() => basketApi,    [basketApi])

  return (
    <StockContext.Provider value={stockValue}>
      <FavoritesContext.Provider value={favoritesValue}>
        <CartContext.Provider value={cartValue}>
          {children}
        </CartContext.Provider>
      </FavoritesContext.Provider>
    </StockContext.Provider>
  )
}
