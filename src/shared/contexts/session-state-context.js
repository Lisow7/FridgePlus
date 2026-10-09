import { createContext, useContext } from 'react'

// Session state contexts — Sprint 11 S11.c.2.
//
// PRIMITIVES (contexts + consumer hooks) en shared/ pour rester
// consommable depuis n'importe quelle feature (RecipePage, ProfilePage,
// futur CommunityPage…) en respectant le flux Bulletproof React.
//
// La logique d'instanciation (useFridgeStock + useFavorites) vit dans
// app/contexts/session-state-provider.jsx — couche app autorisée à
// composer des feature hooks. Les consommateurs n'importent que les
// hooks (useStockSession / useFavoritesSession) depuis ici.

export const StockContext     = createContext(null)
export const FavoritesContext = createContext(null)
export const CartContext      = createContext(null)

// Hook d'accès au stock (Set d'ids d'ingrédients dans le frigo).
// API exposée :
//   const { stock, setStock, toggleIngredient, resetStock,
//           emptyFridgeOptimistic, emptyFridgeConfirm, emptyFridgeUndo,
//           addBatch, removeBatch } = useStockSession()
//
// Throw si appelé hors SessionStateProvider — défaut sain pour repérer
// un oubli d'wrapper plutôt que de retourner null et crasher plus tard
// sur stock.has(...).
export function useStockSession() {
  const ctx = useContext(StockContext)
  if (!ctx) {
    throw new Error('useStockSession must be used within <SessionStateProvider>')
  }
  return ctx
}

// Hook d'accès aux favoris (Set d'ids de recettes).
// API exposée :
//   const { favorites, setFavorites, toggleFavorite } = useFavoritesSession()
export function useFavoritesSession() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) {
    throw new Error('useFavoritesSession must be used within <SessionStateProvider>')
  }
  return ctx
}

// Hook d'accès au panier (state + helpers), lifté pour être consommable
// depuis les routes (ex : /recipe/:id qui doit pouvoir ajouter au panier).
// API exposée = retour de useBasket : { basket, basketRecipeIds, refresh,
//   toggleItem, removeItem, removeRecipe, clear, … }.
export function useCartSession() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCartSession must be used within <SessionStateProvider>')
  }
  return ctx
}
