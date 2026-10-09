import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock ─────────────────────────────────────────────────────────────
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

import {
  loadStockFromDB,
  addToStock,
  removeFromStock,
  clearStock,
  setStockExpiry,
} from '@features/fridge/api/stock'

import {
  loadFavoritesFromDB,
  addFavorite,
  removeFavorite,
} from '@features/recipes/api/favorites'

import {
  getCustomRecipes,
  saveCustomRecipe,
  deleteCustomRecipe,
  getPublicRecipes,
  createRecipeId,
} from '@features/recipes/api/recipes'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

// ─── Helpers chain ────────────────────────────────────────────────────────────
const ok   = (data = null) => Promise.resolve({ data, error: null })
const fail = (msg = 'db error') => Promise.resolve({ data: null, error: { message: msg } })

// ─── stock.js ─────────────────────────────────────────────────────────────────
describe('stock.js', () => {
  describe('loadStockFromDB', () => {
    it('retourne {stock: Set, meta: Map} avec la fraîcheur', async () => {
      mockFrom.mockReturnValue({
        select: () => ({ eq: () => ok([
          { ingredient_id: 'fr-tomate', added_at: '2026-06-01T00:00:00Z', expires_at: null },
          { ingredient_id: 'fr-oeuf', added_at: '2026-06-02T00:00:00Z', expires_at: '2026-06-10T00:00:00Z' },
        ]) }),
      })
      const { stock, meta } = await loadStockFromDB('u-1')
      expect(stock).toBeInstanceOf(Set)
      expect(stock.has('fr-tomate')).toBe(true)
      expect(meta.get('fr-tomate')).toEqual({ addedAt: '2026-06-01T00:00:00Z', expiresAt: null })
      expect(meta.get('fr-oeuf')).toEqual({ addedAt: '2026-06-02T00:00:00Z', expiresAt: '2026-06-10T00:00:00Z' })
    })

    it('retourne {stock vide, meta vide} en cas d\'erreur', async () => {
      mockFrom.mockReturnValue({ select: () => ({ eq: () => fail() }) })
      const { stock, meta } = await loadStockFromDB('u-1')
      expect(stock.size).toBe(0)
      expect(meta.size).toBe(0)
    })

    it('retourne vide si data = []', async () => {
      mockFrom.mockReturnValue({ select: () => ({ eq: () => ok([]) }) })
      const { stock, meta } = await loadStockFromDB('u-1')
      expect(stock.size).toBe(0)
      expect(meta.size).toBe(0)
    })

    it('appelle from("user_stock")', async () => {
      mockFrom.mockReturnValue({ select: () => ({ eq: () => ok([]) }) })
      await loadStockFromDB('u-1')
      expect(mockFrom).toHaveBeenCalledWith('user_stock')
    })
  })

  describe('setStockExpiry', () => {
    it('update expires_at sur la bonne ligne', async () => {
      const eq2 = vi.fn(() => ok())
      const eq1 = vi.fn(() => ({ eq: eq2 }))
      const update = vi.fn(() => ({ eq: eq1 }))
      mockFrom.mockReturnValue({ update })
      await setStockExpiry('u-1', 'fr-tomate', '2026-06-15T00:00:00Z')
      expect(update).toHaveBeenCalledWith({ expires_at: '2026-06-15T00:00:00Z' })
      expect(eq1).toHaveBeenCalledWith('user_id', 'u-1')
      expect(eq2).toHaveBeenCalledWith('ingredient_id', 'fr-tomate')
    })
  })

  describe('addToStock', () => {
    it('appelle upsert avec user_id et ingredient_id', async () => {
      const upsertMock = vi.fn(() => ok())
      mockFrom.mockReturnValue({ upsert: upsertMock })
      await addToStock('u-1', 'fr-tomate')
      expect(upsertMock).toHaveBeenCalledWith(
        { user_id: 'u-1', ingredient_id: 'fr-tomate' },
        expect.objectContaining({ ignoreDuplicates: true })
      )
    })
  })

  describe('removeFromStock', () => {
    it('appelle delete + eq(user_id) + eq(ingredient_id)', async () => {
      const eqIngredient = vi.fn(() => ok())
      const eqUser = vi.fn(() => ({ eq: eqIngredient }))
      const deleteFn = vi.fn(() => ({ eq: eqUser }))
      mockFrom.mockReturnValue({ delete: deleteFn })
      await removeFromStock('u-1', 'fr-tomate')
      expect(deleteFn).toHaveBeenCalled()
      expect(eqUser).toHaveBeenCalledWith('user_id', 'u-1')
      expect(eqIngredient).toHaveBeenCalledWith('ingredient_id', 'fr-tomate')
    })
  })

  describe('clearStock', () => {
    // 🔴 Ce test verrouillait « delete + eq(user_id) SANS filtre ingrédient » —
    // c'est-à-dire le danger lui-même. Audit du 2026-08-28 : combiné à un
    // chargement qui rendait un Set vide en cas d'erreur réseau, ce DELETE
    // supprimait des lignes que personne n'avait jamais lues. Le vidage ne
    // porte donc plus que sur les identifiants réellement chargés.
    it('ne supprime QUE les ingrédients chargés (filtre .in obligatoire)', async () => {
      const inFn = vi.fn(() => ok())
      const eqUser = vi.fn(() => ({ in: inFn }))
      mockFrom.mockReturnValue({ delete: vi.fn(() => ({ eq: eqUser })) })
      await clearStock('u-1', ['fr-oeuf', 'vg-carotte'])
      expect(eqUser).toHaveBeenCalledWith('user_id', 'u-1')
      expect(inFn).toHaveBeenCalledWith('ingredient_id', ['fr-oeuf', 'vg-carotte'])
    })

    it('ne touche à RIEN quand la liste est vide (chargement raté = no-op)', async () => {
      const deleteFn = vi.fn()
      mockFrom.mockReturnValue({ delete: deleteFn })
      const res = await clearStock('u-1', [])
      expect(deleteFn).not.toHaveBeenCalled()
      expect(res).toEqual({ error: null, deleted: 0 })
    })
  })
})

// ─── favorites.js ─────────────────────────────────────────────────────────────
describe('favorites.js', () => {
  describe('loadFavoritesFromDB', () => {
    it('retourne les recipe_id et aucune erreur', async () => {
      mockFrom.mockReturnValue({
        select: () => ({ eq: () => ok([{ recipe_id: 'carbonara' }, { recipe_id: 'omelette' }]) }),
      })
      const { favorites, error } = await loadFavoritesFromDB('u-1')
      expect(favorites.has('carbonara')).toBe(true)
      expect(favorites.has('omelette')).toBe(true)
      expect(error).toBeNull()
    })

    // Un échec doit être DISTINGUABLE d'une absence de favoris : sans ça
    // l'appelant écrasait l'état par du vide après une coupure réseau.
    it('remonte l\'erreur au lieu de la déguiser en liste vide', async () => {
      mockFrom.mockReturnValue({
        select: () => ({ eq: () => fail() }),
      })
      const { favorites, error } = await loadFavoritesFromDB('u-1')
      expect(favorites.size).toBe(0)
      expect(error).toBeTruthy()
    })

    it('appelle from("user_favorites")', async () => {
      mockFrom.mockReturnValue({
        select: () => ({ eq: () => ok([]) }),
      })
      await loadFavoritesFromDB('u-1')
      expect(mockFrom).toHaveBeenCalledWith('user_favorites')
    })
  })

  describe('addFavorite', () => {
    it('appelle upsert avec user_id et recipe_id', async () => {
      const upsertMock = vi.fn(() => ok())
      mockFrom.mockReturnValue({ upsert: upsertMock })
      await addFavorite('u-1', 'carbonara')
      expect(upsertMock).toHaveBeenCalledWith(
        { user_id: 'u-1', recipe_id: 'carbonara' },
        expect.objectContaining({ ignoreDuplicates: true })
      )
    })
  })

  describe('removeFavorite', () => {
    it('appelle delete + eq(user_id) + eq(recipe_id)', async () => {
      const eqRecipe = vi.fn(() => ok())
      const eqUser = vi.fn(() => ({ eq: eqRecipe }))
      const deleteFn = vi.fn(() => ({ eq: eqUser }))
      mockFrom.mockReturnValue({ delete: deleteFn })
      await removeFavorite('u-1', 'carbonara')
      expect(eqUser).toHaveBeenCalledWith('user_id', 'u-1')
      expect(eqRecipe).toHaveBeenCalledWith('recipe_id', 'carbonara')
    })
  })
})

// ─── recipes.js ───────────────────────────────────────────────────────────────
describe('recipes.js', () => {
  const fakeRecipe = {
    id: 'custom-123',
    name: 'Mon plat',
    emoji: '🍳',
    time: '10 min',
    difficulty: 'Facile',
    type: 'Plat principal',
    servings: 2,
    ingredients: [],
    moderation_status: 'private',
    is_public: false,
  }

  describe('mode localStorage (userId = null)', () => {
    it('getCustomRecipes retourne [] par défaut', async () => {
      const result = await getCustomRecipes(null)
      expect(result).toEqual([])
    })

    it('saveCustomRecipe ajoute la recette', async () => {
      await saveCustomRecipe(fakeRecipe, null)
      const result = await getCustomRecipes(null)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('custom-123')
    })

    it('saveCustomRecipe met à jour si id existe déjà', async () => {
      await saveCustomRecipe(fakeRecipe, null)
      await saveCustomRecipe({ ...fakeRecipe, name: 'Modifié' }, null)
      const result = await getCustomRecipes(null)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Modifié')
    })

    it('deleteCustomRecipe retire la recette', async () => {
      await saveCustomRecipe(fakeRecipe, null)
      await deleteCustomRecipe('custom-123', null)
      const result = await getCustomRecipes(null)
      expect(result).toHaveLength(0)
    })
  })

  describe('mode Supabase (userId fourni)', () => {
    it('getCustomRecipes appelle from("custom_recipes")', async () => {
      const chain = {
        select: vi.fn(() => chain),
        eq:     vi.fn(() => chain),
        is:     vi.fn(() => chain),
        order:  vi.fn(() => ok([])),
      }
      mockFrom.mockReturnValue(chain)
      await getCustomRecipes('u-1')
      expect(mockFrom).toHaveBeenCalledWith('custom_recipes')
    })

    it('getCustomRecipes mappe les champs correctement', async () => {
      const row = { id: 'r-1', data: { name: 'Test' }, moderation_status: 'private', is_public: false, admin_modified: false }
      const chain = {
        select: vi.fn(() => chain),
        eq:     vi.fn(() => chain),
        is:     vi.fn(() => chain),
        order:  vi.fn(() => ok([row])),
      }
      mockFrom.mockReturnValue(chain)
      const result = await getCustomRecipes('u-1')
      expect(result[0].id).toBe('r-1')
      expect(result[0].name).toBe('Test')
      expect(result[0].moderation_status).toBe('private')
    })

    it('saveCustomRecipe appelle insert avec les bons champs', async () => {
      // Sprint 5d : custom_recipes est une view ; .upsert remplacé par .insert
      // (l'INSTEAD OF INSERT trigger fait ON CONFLICT en interne).
      const insertMock = vi.fn(() => ok())
      mockFrom.mockImplementation((table) => {
        if (table === 'custom_recipes') return { insert: insertMock }
        return { insert: vi.fn(() => ok()) }
      })
      await saveCustomRecipe(fakeRecipe, 'u-1')
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u-1', title: 'Mon plat' })
      )
    })

    it('deleteCustomRecipe fait un soft-delete (update deleted_at)', async () => {
      const eqId = vi.fn(() => ({ eq: vi.fn(() => ok()) }))
      const updateMock = vi.fn(() => ({ eq: eqId }))
      mockFrom.mockImplementation((table) => {
        if (table === 'custom_recipes') return { update: updateMock }
        return { insert: vi.fn(() => ok()) }
      })
      await deleteCustomRecipe('r-1', 'u-1')
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      )
    })

    it('getPublicRecipes applique les filtres is_public + approved', async () => {
      const chain = {
        select: vi.fn(() => chain),
        eq:     vi.fn(() => chain),
        is:     vi.fn(() => chain),
        order:  vi.fn(() => ok([])),
      }
      mockFrom.mockReturnValue(chain)
      await getPublicRecipes()
      expect(chain.eq).toHaveBeenCalledWith('is_public', true)
      expect(chain.eq).toHaveBeenCalledWith('moderation_status', 'approved')
    })
  })

  describe('createRecipeId', () => {
    it('retourne une chaîne commençant par "custom-"', () => {
      expect(createRecipeId()).toMatch(/^custom-\d+$/)
    })

    it('génère des IDs différents à chaque appel', () => {
      vi.useFakeTimers()
      const id1 = createRecipeId()
      vi.advanceTimersByTime(1)
      const id2 = createRecipeId()
      vi.useRealTimers()
      expect(id1).not.toBe(id2)
    })
  })
})
