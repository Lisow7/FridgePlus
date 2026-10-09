import { useState, useCallback } from 'react'
import { addFavorite, removeFavorite } from '@features/recipes/api/favorites'

// Sprint 6 PR S6.f — Custom hook `useFavorites`.
//
// Encapsule le state `favorites` (Set d'ids de recettes favoris) avec
// le pattern hybride DB / localStorage. Strictement similaire à
// `useFridgeStock` (v3.233.0) mais sur la table favorites.
//
// API exposée :
//   const { favorites, setFavorites, toggleFavorite } = useFavorites(user)
//
//   - `setFavorites` (raw setter) exposé pour orchestration externe
//     (logout reset, load post-login depuis App.jsx).
//   - `toggleFavorite` : ajoute si absent, retire si présent, sync persistence.

const LOCALSTORAGE_KEY = 'fridge-favorites'

function loadInitialFavorites() {
  try {
    const saved = localStorage.getItem(LOCALSTORAGE_KEY)
    return new Set(saved ? JSON.parse(saved) : [])
  } catch {
    return new Set()
  }
}

function persistLocalStorage(set) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // localStorage indisponible — silent
  }
}

export function useFavorites(user) {
  const [favorites, setFavorites] = useState(loadInitialFavorites)

  const toggleFavorite = useCallback((id) => {
    setFavorites(prev => {
      const next = new Set(prev)
      const removing = next.has(id)
      if (removing) next.delete(id)
      else next.add(id)
      if (user) {
        if (removing) removeFavorite(user.id, id)
        else addFavorite(user.id, id)
      } else {
        persistLocalStorage(next)
      }
      return next
    })
  }, [user])

  return { favorites, setFavorites, toggleFavorite }
}
