import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock pour supabase.from()
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

import {
  loadShoppingLists,
  getShoppingList,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  countShoppingLists,
  getFrequentIngredients,
  SHOPPING_LISTS_MAX_PER_USER,
  SHOPPING_LIST_NAME_MIN,
  SHOPPING_LIST_NAME_MAX,
} from '@features/cart/api/shopping-lists'

beforeEach(() => {
  vi.clearAllMocks()
})

const ok   = (data = null, count) => Promise.resolve({ data, error: null, ...(count != null ? { count } : {}) })
const fail = (msg = 'db error') => Promise.resolve({ data: null, error: { message: msg } })

function makeChain(terminal) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    order: vi.fn(() => terminal),
    insert: vi.fn(() => c),
    update: vi.fn(() => c),
    delete: vi.fn(() => c),
    single: vi.fn(() => terminal),
    maybeSingle: vi.fn(() => terminal),
    // Permet de finir la chain (`.eq(...)` après update/delete) en awaitant directement
    then: (res, rej) => terminal.then(res, rej),
  }
  return c
}

describe('shoppingLists.js', () => {
  describe('loadShoppingLists', () => {
    it('retourne [] si userId absent', async () => {
      const r = await loadShoppingLists(null)
      expect(r).toEqual([])
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('retourne les listes triées par updated_at DESC', async () => {
      const lists = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
      const chain = makeChain(ok(lists))
      mockFrom.mockReturnValue(chain)

      const r = await loadShoppingLists('user-1')
      expect(mockFrom).toHaveBeenCalledWith('shopping_lists')
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false })
      expect(r).toEqual(lists)
    })

    it('retourne [] en cas d\'erreur BDD', async () => {
      mockFrom.mockReturnValue(makeChain(fail()))
      const r = await loadShoppingLists('user-1')
      expect(r).toEqual([])
    })
  })

  describe('getShoppingList', () => {
    it('retourne null si id absent', async () => {
      expect(await getShoppingList(null)).toBeNull()
      expect(await getShoppingList('')).toBeNull()
    })

    it('retourne la liste trouvée', async () => {
      const list = { id: 'list-1', name: 'Test', items: [] }
      mockFrom.mockReturnValue(makeChain(ok(list)))
      const r = await getShoppingList('list-1')
      expect(r).toEqual(list)
    })

    it('retourne null en cas d\'erreur', async () => {
      mockFrom.mockReturnValue(makeChain(fail()))
      expect(await getShoppingList('list-1')).toBeNull()
    })
  })

  describe('createShoppingList', () => {
    it('error si userId manquant', async () => {
      const r = await createShoppingList(null, 'Test', [])
      expect(r.error).toBeTruthy()
      expect(r.data).toBeNull()
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('error si name manquant', async () => {
      const r = await createShoppingList('user-1', '', [])
      expect(r.error.message).toBe('missing_required_field')
    })

    it('error si name trop long (> 80)', async () => {
      const longName = 'A'.repeat(81)
      const r = await createShoppingList('user-1', longName, [])
      expect(r.error.message).toBe('invalid_name_length')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('error si name vide après trim', async () => {
      const r = await createShoppingList('user-1', '   ', [])
      expect(r.error.message).toBe('invalid_name_length')
    })

    it('insère la liste avec les items snapshot', async () => {
      const created = { id: 'new-1', name: 'Courses semaine', items: [{ x: 1 }] }
      const chain = makeChain(ok(created))
      mockFrom.mockReturnValue(chain)

      const r = await createShoppingList('user-1', '  Courses semaine  ', [{ x: 1 }])
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        name: 'Courses semaine', // trimmed
        items: [{ x: 1 }],
      })
      expect(r.data).toEqual(created)
    })

    it('items non-array → fallback []', async () => {
      const chain = makeChain(ok({ id: 'new', name: 'Test', items: [] }))
      mockFrom.mockReturnValue(chain)

      await createShoppingList('user-1', 'Test', null)
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-1', name: 'Test', items: [],
      })
    })
  })

  describe('updateShoppingList', () => {
    it('error si id manquant', async () => {
      const r = await updateShoppingList(null, { name: 'X' })
      expect(r.error.message).toBe('missing_id')
    })

    it('error si aucun champ valide à update', async () => {
      const r = await updateShoppingList('list-1', {})
      expect(r.error.message).toBe('no_fields_to_update')
    })

    it('rename : update.name avec trim', async () => {
      const chain = makeChain(ok())
      mockFrom.mockReturnValue(chain)

      const r = await updateShoppingList('list-1', { name: '  Nouveau nom  ' })
      expect(chain.update).toHaveBeenCalledWith({ name: 'Nouveau nom' })
      expect(r.error).toBeNull()
    })

    it('error si name trop long', async () => {
      const r = await updateShoppingList('list-1', { name: 'A'.repeat(81) })
      expect(r.error.message).toBe('invalid_name_length')
    })

    it('error si name vide', async () => {
      const r = await updateShoppingList('list-1', { name: '   ' })
      expect(r.error.message).toBe('invalid_name_length')
    })

    it('replace items', async () => {
      const chain = makeChain(ok())
      mockFrom.mockReturnValue(chain)

      const newItems = [{ ingredient_id: 'gp-x' }]
      await updateShoppingList('list-1', { items: newItems })
      expect(chain.update).toHaveBeenCalledWith({ items: newItems })
    })

    it('items non-array → ignoré', async () => {
      // Si seulement items est fourni mais invalide, no_fields_to_update
      const r = await updateShoppingList('list-1', { items: 'not-array' })
      expect(r.error.message).toBe('no_fields_to_update')
    })
  })

  describe('deleteShoppingList', () => {
    it('error si id manquant', async () => {
      const r = await deleteShoppingList(null)
      expect(r.error.message).toBe('missing_id')
    })

    it('appelle delete avec l\'id', async () => {
      const chain = makeChain(ok())
      mockFrom.mockReturnValue(chain)

      const r = await deleteShoppingList('list-1')
      expect(chain.delete).toHaveBeenCalled()
      expect(chain.eq).toHaveBeenCalledWith('id', 'list-1')
      expect(r.error).toBeNull()
    })
  })

  describe('countShoppingLists', () => {
    it('retourne 0 si userId absent', async () => {
      expect(await countShoppingLists(null)).toBe(0)
    })

    it('retourne le count Supabase', async () => {
      mockFrom.mockReturnValue(makeChain(ok(null, 7)))
      expect(await countShoppingLists('user-1')).toBe(7)
    })

    it('retourne 0 en cas d\'erreur', async () => {
      mockFrom.mockReturnValue(makeChain(fail()))
      expect(await countShoppingLists('user-1')).toBe(0)
    })
  })

  describe('constants', () => {
    it('limites alignées avec la BDD', () => {
      expect(SHOPPING_LISTS_MAX_PER_USER).toBe(50)
      expect(SHOPPING_LIST_NAME_MIN).toBe(1)
      expect(SHOPPING_LIST_NAME_MAX).toBe(80)
    })
  })

  describe('getFrequentIngredients (v3.55.0)', () => {
    it('retourne [] si userId absent', async () => {
      expect(await getFrequentIngredients(null)).toEqual([])
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('retourne [] si pas de listes', async () => {
      mockFrom.mockReturnValue(makeChain(ok([])))
      expect(await getFrequentIngredients('user-1')).toEqual([])
    })

    it('retourne [] en cas d\'erreur BDD', async () => {
      mockFrom.mockReturnValue(makeChain(fail()))
      expect(await getFrequentIngredients('user-1')).toEqual([])
    })

    it('agrège et trie par fréquence DESC', async () => {
      const listsData = [
        { items: [{ ingredient_id: 'gp-lait' }, { ingredient_id: 'gp-pain' }] },
        { items: [{ ingredient_id: 'gp-lait' }, { ingredient_id: 'fr-oeuf' }] },
        { items: [{ ingredient_id: 'gp-lait' }] },
      ]
      mockFrom.mockReturnValue(makeChain(ok(listsData)))
      const r = await getFrequentIngredients('user-1', 5)
      expect(r).toEqual([
        { ingredient_id: 'gp-lait', count: 3 },
        { ingredient_id: 'gp-pain', count: 1 },
        { ingredient_id: 'fr-oeuf', count: 1 },
      ])
    })

    it('respecte la limite top-N', async () => {
      const listsData = [
        { items: [
          { ingredient_id: 'a' }, { ingredient_id: 'b' },
          { ingredient_id: 'c' }, { ingredient_id: 'd' },
        ]},
      ]
      mockFrom.mockReturnValue(makeChain(ok(listsData)))
      const r = await getFrequentIngredients('user-1', 2)
      expect(r).toHaveLength(2)
    })

    it('dédoublonne au sein d\'une même liste (1 ingredient = 1 count par liste)', async () => {
      // Une liste contenant 5 fois le même ingrédient ne doit compter que pour 1.
      const listsData = [
        { items: [
          { ingredient_id: 'gp-lait' },
          { ingredient_id: 'gp-lait' },
          { ingredient_id: 'gp-lait' },
        ]},
        { items: [{ ingredient_id: 'gp-pain' }] },
      ]
      mockFrom.mockReturnValue(makeChain(ok(listsData)))
      const r = await getFrequentIngredients('user-1', 5)
      // gp-lait compté pour 1 (pas 3), gp-pain pour 1 → tied
      expect(r.find(x => x.ingredient_id === 'gp-lait').count).toBe(1)
      expect(r.find(x => x.ingredient_id === 'gp-pain').count).toBe(1)
    })

    it('skip les items malformés (null, sans ingredient_id)', async () => {
      const listsData = [
        { items: [
          null,
          {},
          { ingredient_id: '' },
          { ingredient_id: 'gp-valid' },
        ]},
      ]
      mockFrom.mockReturnValue(makeChain(ok(listsData)))
      const r = await getFrequentIngredients('user-1')
      expect(r).toEqual([{ ingredient_id: 'gp-valid', count: 1 }])
    })

    it('skip les listes avec items non-array', async () => {
      const listsData = [
        { items: 'not-an-array' },
        { items: null },
        { items: [{ ingredient_id: 'gp-x' }] },
      ]
      mockFrom.mockReturnValue(makeChain(ok(listsData)))
      const r = await getFrequentIngredients('user-1')
      expect(r).toEqual([{ ingredient_id: 'gp-x', count: 1 }])
    })
  })
})
