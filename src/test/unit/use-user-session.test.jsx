import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mocks des chargements BDD (le hook ne doit pas toucher le réseau en test).
vi.mock('@features/fridge/api/stock', () => ({ loadStockFromDB: vi.fn(() => Promise.resolve({ stock: new Set(), meta: new Map() })) }))
vi.mock('@features/recipes/api/favorites', () => ({ loadFavoritesFromDB: vi.fn(() => Promise.resolve(new Set())) }))
vi.mock('@features/recipes/lib/custom-recipes', () => ({ getCustomRecipes: vi.fn(() => Promise.resolve([])) }))
vi.mock('@shared/lib/migration', () => ({ migrateLocalStorageToDB: vi.fn(() => Promise.resolve()) }))

import { useUserSession } from '@app/hooks/use-user-session'

function makeProps(user) {
  return {
    user,
    signOut: vi.fn(),
    setStock: vi.fn(),
    setStockMeta: vi.fn(),
    setFavorites: vi.fn(),
    setCustomRecipes: vi.fn(),
    setShowRecipes: vi.fn(),
    modals: {},
  }
}

describe('useUserSession — reset de session gardé (régression fix invité)', () => {
  beforeEach(() => localStorage.clear())

  it('INVITÉ pur (user null au mount) : NE reset PAS stock/favoris (persistance localStorage)', () => {
    const p = makeProps(null)
    renderHook(() => useUserSession(p))
    expect(p.setStock).not.toHaveBeenCalled()
    expect(p.setFavorites).not.toHaveBeenCalled()
  })

  it('transition connecté → null (logout/expiration) : RESET stock/favoris', () => {
    const p = makeProps({ id: 'u1' })
    const { rerender } = renderHook(({ props }) => useUserSession(props), { initialProps: { props: p } })
    const p2 = { ...p, user: null } // même setters, user passe à null
    rerender({ props: p2 })
    expect(p2.setStock).toHaveBeenCalledWith(new Set())
    expect(p2.setFavorites).toHaveBeenCalledWith(new Set())
  })
})
