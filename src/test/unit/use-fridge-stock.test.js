import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode, createElement } from 'react'
import { renderHook, act } from '@testing-library/react'

// Mock l'API stock (DB calls) AVANT l'import du hook.
const mockAddToStock = vi.fn().mockResolvedValue({ error: null })
const mockRemoveFromStock = vi.fn().mockResolvedValue({ error: null })
const mockClearStock = vi.fn().mockResolvedValue({ error: null })

vi.mock('@features/fridge/api/stock', () => ({
  addToStock: (...args) => mockAddToStock(...args),
  removeFromStock: (...args) => mockRemoveFromStock(...args),
  clearStock: (...args) => mockClearStock(...args),
  loadStockFromDB: vi.fn(),
}))

import { useFridgeStock } from '@features/fridge/hooks/use-fridge-stock'

describe('useFridgeStock (v3.233.0)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockAddToStock.mockClear()
    mockRemoveFromStock.mockClear()
    mockClearStock.mockClear()
  })
  afterEach(() => { localStorage.clear() })

  describe('initial state', () => {
    it('lit le localStorage au mount', () => {
      localStorage.setItem('fridge-stock', JSON.stringify(['fr-tomate', 'gp-farine-ble']))
      const { result } = renderHook(() => useFridgeStock(null))
      expect(result.current.stock.has('fr-tomate')).toBe(true)
      expect(result.current.stock.has('gp-farine-ble')).toBe(true)
      expect(result.current.stock.size).toBe(2)
    })

    it('Set vide si localStorage absent', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      expect(result.current.stock.size).toBe(0)
    })

    it('Set vide si localStorage corrompu', () => {
      localStorage.setItem('fridge-stock', '{not-json}')
      const { result } = renderHook(() => useFridgeStock(null))
      expect(result.current.stock.size).toBe(0)
    })
  })

  describe('toggleIngredient (guest)', () => {
    it('ajoute un id si absent → persist localStorage (nouveau format objet)', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      expect(result.current.stock.has('fr-tomate')).toBe(true)
      const saved = JSON.parse(localStorage.getItem('fridge-stock'))
      expect(saved).toHaveLength(1)
      expect(saved[0].id).toBe('fr-tomate')
      expect(saved[0].expiresAt).toBe(null)
      expect(typeof saved[0].addedAt).toBe('string')
      // stockMeta exposé
      expect(result.current.stockMeta.get('fr-tomate').expiresAt).toBe(null)
    })

    it('retire un id si présent → persist localStorage', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      act(() => { result.current.toggleIngredient('fr-tomate') })
      expect(result.current.stock.has('fr-tomate')).toBe(false)
    })

    it('n\'appelle pas l\'API DB', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      expect(mockAddToStock).not.toHaveBeenCalled()
    })
  })

  describe('toggleIngredient (user connecté)', () => {
    const user = { id: 'user-123' }

    it('ajoute → appelle addToStock DB', () => {
      const { result } = renderHook(() => useFridgeStock(user))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      expect(mockAddToStock).toHaveBeenCalledWith('user-123', 'fr-tomate')
    })

    it('retire → appelle removeFromStock DB', () => {
      const { result } = renderHook(() => useFridgeStock(user))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      act(() => { result.current.toggleIngredient('fr-tomate') })
      expect(mockRemoveFromStock).toHaveBeenCalledWith('user-123', 'fr-tomate')
    })

    it('n\'écrit pas dans localStorage', () => {
      const { result } = renderHook(() => useFridgeStock(user))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      expect(localStorage.getItem('fridge-stock')).toBe(null)
    })

    // v0.120 — régression constatée en E2E le 2026-08-06 : un seul clic
    // envoyait DEUX upserts `user_stock`. Cause : l'appel réseau était fait
    // DANS l'updater de `setStock`, or React invoque les updaters deux fois
    // en StrictMode (actif en dev, cf. main.jsx) pour débusquer précisément
    // ce genre d'effet de bord impur.
    //
    // Les tests ci-dessus vérifiaient AVEC QUELS ARGUMENTS l'appel partait,
    // jamais COMBIEN DE FOIS — d'où l'angle mort. On compte désormais.
    describe('pureté des updaters (StrictMode)', () => {
      // Fichier .js : pas de JSX, d'ou createElement.
      const inStrictMode = ({ children }) => createElement(StrictMode, null, children)

      it('ajoute → un seul appel addToStock même en StrictMode', () => {
        const { result } = renderHook(() => useFridgeStock(user), { wrapper: inStrictMode })
        act(() => { result.current.toggleIngredient('fr-tomate') })
        expect(mockAddToStock).toHaveBeenCalledTimes(1)
      })

      it('retire → un seul appel removeFromStock même en StrictMode', () => {
        const { result } = renderHook(() => useFridgeStock(user), { wrapper: inStrictMode })
        act(() => { result.current.toggleIngredient('fr-tomate') })
        act(() => { result.current.toggleIngredient('fr-tomate') })
        expect(mockRemoveFromStock).toHaveBeenCalledTimes(1)
      })

      // 2026-08-28 — le correctif de v0.120 n'a couvert que `toggleIngredient`.
      // `addBatch` et `removeBatch` gardaient leurs appels DB DANS l'updater :
      // le commentaire ci-dessus nommait l'angle mort (« avec quels arguments,
      // jamais combien de fois ») et les tests de ces deux-là le reproduisaient
      // deux blocs plus bas, en `toHaveBeenCalledWith` seulement.
      it('addBatch → un appel par ingrédient, pas deux, même en StrictMode', () => {
        const { result } = renderHook(() => useFridgeStock(user), { wrapper: inStrictMode })
        act(() => { result.current.addBatch(['fr-tomate', 'vg-carotte']) })
        expect(mockAddToStock).toHaveBeenCalledTimes(2)
      })

      it('removeBatch → un appel par ingrédient, pas deux, même en StrictMode', () => {
        const { result } = renderHook(() => useFridgeStock(user), { wrapper: inStrictMode })
        act(() => { result.current.addBatch(['fr-tomate', 'vg-carotte']) })
        mockRemoveFromStock.mockClear()
        act(() => { result.current.removeBatch(['fr-tomate', 'vg-carotte']) })
        expect(mockRemoveFromStock).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('resetStock', () => {
    it('guest : vide le Set + retire localStorage', async () => {
      localStorage.setItem('fridge-stock', JSON.stringify(['fr-tomate']))
      const { result } = renderHook(() => useFridgeStock(null))
      await act(async () => { await result.current.resetStock() })
      expect(result.current.stock.size).toBe(0)
      expect(localStorage.getItem('fridge-stock')).toBe(null)
    })

    it('user : vide le Set et ne supprime QUE les ingrédients chargés', async () => {
      const { result } = renderHook(() => useFridgeStock({ id: 'u' }))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      await act(async () => { await result.current.resetStock() })
      expect(result.current.stock.size).toBe(0)
      // Le second argument est la garantie de sûreté (audit 2026-08-28) : sur
      // un chargement raté, cette liste est vide et rien n'est supprimé.
      const [userId, ids] = mockClearStock.mock.calls.at(-1)
      expect(userId).toBe('u')
      expect([...ids]).toEqual(['fr-tomate'])
    })
  })

  describe('empty optimistic / confirm / undo', () => {
    it('optimistic vide en mémoire SANS toucher persistence', () => {
      localStorage.setItem('fridge-stock', JSON.stringify(['fr-tomate']))
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.emptyFridgeOptimistic() })
      expect(result.current.stock.size).toBe(0)
      // localStorage encore présent — l'optimistic ne touche pas la persistence
      expect(localStorage.getItem('fridge-stock')).not.toBe(null)
    })

    it('confirm efface bien la persistence après optimistic', async () => {
      localStorage.setItem('fridge-stock', JSON.stringify(['fr-tomate']))
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.emptyFridgeOptimistic() })
      await act(async () => { await result.current.emptyFridgeConfirm() })
      expect(localStorage.getItem('fridge-stock')).toBe(null)
    })

    it('undo restaure le state à partir d\'un snapshot', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      const stashed = new Set(['fr-tomate', 'gp-farine-ble'])
      act(() => { result.current.emptyFridgeUndo(stashed) })
      expect(result.current.stock.has('fr-tomate')).toBe(true)
      expect(result.current.stock.has('gp-farine-ble')).toBe(true)
    })

    it('undo accepte un array (compat)', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.emptyFridgeUndo(['fr-tomate']) })
      expect(result.current.stock.has('fr-tomate')).toBe(true)
    })
  })

  describe('addBatch / removeBatch', () => {
    it('addBatch ajoute plusieurs ids, ignore les doublons existants', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      act(() => { result.current.addBatch(['fr-tomate', 'gp-farine-ble', 'vg-carotte']) })
      expect(result.current.stock.size).toBe(3)
    })

    // 2026-08-28 — les tests de lot vérifiaient `result.current.stock` (mémoire)
    // mais jamais la PERSISTANCE invité : le chemin localStorage d'`addBatch` et
    // `removeBatch` n'était couvert par rien. Trou constaté en réécrivant ces
    // deux fonctions pour sortir leurs effets de bord des updaters.
    it('addBatch invité → persiste le lot dans localStorage', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.addBatch(['fr-tomate', 'vg-carotte']) })
      const ecrit = JSON.parse(localStorage.getItem('fridge-stock'))
      expect(ecrit.map(e => e.id).sort()).toEqual(['fr-tomate', 'vg-carotte'])
      expect(ecrit.every(e => typeof e.addedAt === 'string')).toBe(true)
    })

    it('removeBatch invité → retire le lot du localStorage', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.addBatch(['fr-tomate', 'vg-carotte', 'gp-farine-ble']) })
      act(() => { result.current.removeBatch(['fr-tomate', 'vg-carotte']) })
      const ecrit = JSON.parse(localStorage.getItem('fridge-stock'))
      expect(ecrit.map(e => e.id)).toEqual(['gp-farine-ble'])
    })

    // Composition dans un MÊME tick. Tous les autres tests enveloppent une
    // seule mutation par `act()`, ce qui reflushe et resynchronise les refs
    // entre les appels — ils ne peuvent donc pas voir ce cas. Deux mutations
    // groupées lisent le même état commité : si la persistance se calcule
    // depuis les refs plutôt qu'en composant, la seconde écrase la première
    // et l'invité perd un ingrédient au rechargement.
    it('deux addBatch dans le même tick → localStorage garde les deux', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => {
        result.current.addBatch(['fr-tomate'])
        result.current.addBatch(['vg-carotte'])
      })
      expect(result.current.stock.size).toBe(2)
      const ecrit = JSON.parse(localStorage.getItem('fridge-stock'))
      expect(ecrit.map(e => e.id).sort()).toEqual(['fr-tomate', 'vg-carotte'])
    })

    it('deux toggleIngredient dans le même tick → localStorage garde les deux', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => {
        result.current.toggleIngredient('fr-tomate')
        result.current.toggleIngredient('vg-carotte')
      })
      expect(result.current.stock.size).toBe(2)
      const ecrit = JSON.parse(localStorage.getItem('fridge-stock'))
      expect(ecrit.map(e => e.id).sort()).toEqual(['fr-tomate', 'vg-carotte'])
    })

    // Les chemins qui changent le stock SANS passer par la projection :
    // `emptyFridgeOptimistic`, `emptyFridgeUndo` et le `setStock` brut exporte.
    // Dans le meme tick, la projection ne verrait pas leur effet et
    // ressusciterait le frigo d'avant dans le localStorage de l'invite.
    it('vidage optimiste puis ajout dans le meme tick -> le localStorage ne ressuscite pas le frigo', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.addBatch(['fr-tomate', 'vg-carotte']) })
      act(() => {
        result.current.emptyFridgeOptimistic()
        result.current.addBatch(['gp-farine-ble'])
      })
      const ecrit = JSON.parse(localStorage.getItem('fridge-stock'))
      expect(ecrit.map(e => e.id)).toEqual(['gp-farine-ble'])
    })

    it('undo puis retrait dans le meme tick -> le localStorage suit la restauration', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.addBatch(['fr-tomate']) })
      act(() => {
        result.current.emptyFridgeUndo(new Set(['vg-carotte', 'gp-farine-ble']))
        result.current.removeBatch(['vg-carotte'])
      })
      const ecrit = JSON.parse(localStorage.getItem('fridge-stock'))
      expect(ecrit.map(e => e.id)).toEqual(['gp-farine-ble'])
    })

    it('addBatch user → appelle addToStock pour les nouveaux ids uniquement', () => {
      const { result } = renderHook(() => useFridgeStock({ id: 'u' }))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      mockAddToStock.mockClear()
      act(() => { result.current.addBatch(['fr-tomate', 'gp-farine-ble']) })
      expect(mockAddToStock).toHaveBeenCalledTimes(1)
      expect(mockAddToStock).toHaveBeenCalledWith('u', 'gp-farine-ble')
    })

    it('addBatch [] → no-op', () => {
      const { result } = renderHook(() => useFridgeStock({ id: 'u' }))
      act(() => { result.current.addBatch([]) })
      expect(mockAddToStock).not.toHaveBeenCalled()
    })

    it('removeBatch retire plusieurs ids', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.addBatch(['fr-tomate', 'gp-farine-ble', 'vg-carotte']) })
      act(() => { result.current.removeBatch(['fr-tomate', 'vg-carotte']) })
      expect(result.current.stock.has('fr-tomate')).toBe(false)
      expect(result.current.stock.has('vg-carotte')).toBe(false)
      expect(result.current.stock.has('gp-farine-ble')).toBe(true)
    })

    it('removeBatch user → appelle removeFromStock', () => {
      const { result } = renderHook(() => useFridgeStock({ id: 'u' }))
      act(() => { result.current.addBatch(['fr-tomate', 'gp-farine-ble']) })
      mockRemoveFromStock.mockClear()
      act(() => { result.current.removeBatch(['fr-tomate']) })
      expect(mockRemoveFromStock).toHaveBeenCalledWith('u', 'fr-tomate')
    })
  })

  describe('fraîcheur (stockMeta)', () => {
    it('migre l\'ancien format localStorage (strings) en objets avec addedAt', () => {
      localStorage.setItem('fridge-stock', JSON.stringify(['fr-tomate']))
      const { result } = renderHook(() => useFridgeStock(null))
      expect(result.current.stock.has('fr-tomate')).toBe(true)
      expect(result.current.stockMeta.get('fr-tomate').expiresAt).toBe(null)
      expect(typeof result.current.stockMeta.get('fr-tomate').addedAt).toBe('string')
    })

    it('lit le nouveau format localStorage (objets)', () => {
      localStorage.setItem('fridge-stock', JSON.stringify([{ id: 'fr-tomate', addedAt: '2026-06-01T00:00:00Z', expiresAt: '2026-06-09T00:00:00Z' }]))
      const { result } = renderHook(() => useFridgeStock(null))
      expect(result.current.stock.has('fr-tomate')).toBe(true)
      expect(result.current.stockMeta.get('fr-tomate')).toEqual({ addedAt: '2026-06-01T00:00:00Z', expiresAt: '2026-06-09T00:00:00Z' })
    })

  })

  describe('onRemoved (anti-gaspi 1B-i)', () => {
    it('appelle onRemoved au retrait (toggle) avec la meta fraîcheur', () => {
      const onRemoved = vi.fn()
      const { result } = renderHook(() => useFridgeStock(null, { onRemoved }))
      act(() => { result.current.toggleIngredient('fr-tomate') }) // add
      onRemoved.mockClear()
      act(() => { result.current.toggleIngredient('fr-tomate') }) // remove
      expect(onRemoved).toHaveBeenCalledTimes(1)
      expect(onRemoved).toHaveBeenCalledWith([expect.objectContaining({ id: 'fr-tomate' })])
    })
    it('n\'appelle PAS onRemoved à l\'ajout', () => {
      const onRemoved = vi.fn()
      const { result } = renderHook(() => useFridgeStock(null, { onRemoved }))
      act(() => { result.current.toggleIngredient('fr-tomate') })
      expect(onRemoved).not.toHaveBeenCalled()
    })
    it('removeBatch appelle onRemoved avec les ids présents', () => {
      const onRemoved = vi.fn()
      const { result } = renderHook(() => useFridgeStock(null, { onRemoved }))
      act(() => { result.current.addBatch(['fr-tomate', 'vg-carotte']) })
      onRemoved.mockClear()
      act(() => { result.current.removeBatch(['fr-tomate', 'absent']) })
      expect(onRemoved).toHaveBeenCalledWith([expect.objectContaining({ id: 'fr-tomate' })])
    })
  })

  describe('setStock raw setter', () => {
    it('expose setStock pour orchestration externe', () => {
      const { result } = renderHook(() => useFridgeStock(null))
      act(() => { result.current.setStock(new Set(['fr-tomate', 'gp-farine-ble'])) })
      expect(result.current.stock.size).toBe(2)
    })
  })
})
