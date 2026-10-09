import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const addToStock = vi.hoisted(() => vi.fn())
const removeFromStock = vi.hoisted(() => vi.fn())
const clearStock = vi.hoisted(() => vi.fn())

vi.mock('@features/fridge/api/stock', () => ({ addToStock, removeFromStock, clearStock, loadStockFromDB: vi.fn() }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn() }))

import { useFridgeStock } from '@features/fridge/hooks/use-fridge-stock'

// Audit du 2026-10-04, UX-02. L'API du stock remonte ses erreurs depuis le
// 28 août, mais aucun appelant ne les regardait : l'aliment restait coché à
// l'écran, rien n'était enregistré, et il disparaissait au rechargement — sans
// un mot. Sur un téléphone en réseau faible, c'est une saisie perdue.
//
// La règle : une écriture refusée ANNULE ce qu'elle avait affiché, et le dit.
const BOB = { id: 'u-bob' }
const REFUS = { error: { message: 'Failed to fetch' } }
const OK = { error: null }

// Une écriture dont on décide l'issue plus tard, pour jouer les croisements.
function differee() {
  let trancher
  const promesse = new Promise((resolve) => { trancher = resolve })
  return { promesse, trancher }
}

describe('useFridgeStock — écriture refusée par la base', () => {
  const onSaveError = vi.fn()
  const monter = () => renderHook(() => useFridgeStock(BOB, { onSaveError }))

  beforeEach(() => {
    localStorage.clear()
    onSaveError.mockReset()
    addToStock.mockReset(); addToStock.mockResolvedValue(OK)
    removeFromStock.mockReset(); removeFromStock.mockResolvedValue(OK)
    clearStock.mockReset(); clearStock.mockResolvedValue({ error: null, deleted: 0 })
  })

  it('ajout accepté : l’aliment reste, rien n’est signalé', async () => {
    const { result } = monter()
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(true)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('ajout refusé : l’aliment est décoché, et l’échec signalé', async () => {
    addToStock.mockResolvedValue(REFUS)
    const { result } = monter()
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(false)
    expect(result.current.stockMeta.has('fr-tomate')).toBe(false)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('retrait refusé : l’aliment revient, avec sa date d’ajout d’origine', async () => {
    const { result } = monter()
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    const fraicheur = result.current.stockMeta.get('fr-tomate')
    removeFromStock.mockResolvedValue(REFUS)
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(true)
    expect(result.current.stockMeta.get('fr-tomate')).toEqual(fraicheur)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('l’écran change tout de suite, sans attendre la base', () => {
    const attente = differee()
    addToStock.mockReturnValue(attente.promesse)
    const { result } = monter()
    act(() => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(true)
  })

  it('un refus qui arrive APRÈS un nouveau geste sur le même aliment n’annule pas ce geste', async () => {
    // Ajout (lent, refusé), puis retrait, puis nouvel ajout (accepté) : le
    // refus du premier ajout arrive en dernier et ne doit pas décocher.
    const premier = differee()
    addToStock.mockReturnValueOnce(premier.promesse)
    const { result } = monter()
    act(() => { result.current.toggleIngredient('fr-tomate') })
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(true)
    await act(async () => { premier.trancher(REFUS) })
    expect(result.current.stock.has('fr-tomate')).toBe(true)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  // Deux écritures du même aliment qui se croisent — un double-clic suffit.
  // « Remettre l'état d'avant le dernier geste » ne suffit plus : cet état-là
  // est celui que le premier geste venait d'afficher, et que la base a
  // peut-être refusé aussi. L'écran doit revenir à ce que la base CONTIENT.
  describe('deux écritures du même aliment qui se croisent', () => {
    it('ajout puis retrait, tous deux refusés : l’aliment n’est pas au frigo — la base ne l’a jamais eu', async () => {
      const ajout = differee(); const retrait = differee()
      addToStock.mockReturnValueOnce(ajout.promesse)
      removeFromStock.mockReturnValueOnce(retrait.promesse)
      const { result } = monter()
      act(() => { result.current.toggleIngredient('fr-tomate') })
      act(() => { result.current.toggleIngredient('fr-tomate') })
      await act(async () => { ajout.trancher(REFUS) })
      await act(async () => { retrait.trancher(REFUS) })
      expect(result.current.stock.has('fr-tomate')).toBe(false)
      expect(result.current.stockMeta.has('fr-tomate')).toBe(false)
      // La personne voulait l'aliment hors du frigo : il l'est. Rien à dire.
      expect(onSaveError).not.toHaveBeenCalled()
    })

    it('même chose quand le refus du retrait arrive le premier', async () => {
      const ajout = differee(); const retrait = differee()
      addToStock.mockReturnValueOnce(ajout.promesse)
      removeFromStock.mockReturnValueOnce(retrait.promesse)
      const { result } = monter()
      act(() => { result.current.toggleIngredient('fr-tomate') })
      act(() => { result.current.toggleIngredient('fr-tomate') })
      await act(async () => { retrait.trancher(REFUS) })
      await act(async () => { ajout.trancher(REFUS) })
      expect(result.current.stock.has('fr-tomate')).toBe(false)
      expect(onSaveError).not.toHaveBeenCalled()
    })

    it('retrait puis ajout, tous deux refusés : l’aliment reste au frigo, avec sa date d’ajout d’origine — la base l’a toujours', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        vi.setSystemTime(new Date('2026-10-01T10:00:00.000Z'))
        const { result } = monter()
        await act(async () => { result.current.toggleIngredient('fr-tomate') })
        const fraicheur = result.current.stockMeta.get('fr-tomate')
        // Quatre jours plus tard.
        vi.setSystemTime(new Date('2026-10-05T08:00:00.000Z'))
        const retrait = differee(); const ajout = differee()
        removeFromStock.mockReturnValueOnce(retrait.promesse)
        addToStock.mockReturnValueOnce(ajout.promesse)
        act(() => { result.current.toggleIngredient('fr-tomate') })
        act(() => { result.current.toggleIngredient('fr-tomate') })
        await act(async () => { retrait.trancher(REFUS) })
        await act(async () => { ajout.trancher(REFUS) })
        expect(result.current.stock.has('fr-tomate')).toBe(true)
        expect(result.current.stockMeta.get('fr-tomate')).toEqual(fraicheur)
        expect(fraicheur.addedAt).toBe('2026-10-01T10:00:00.000Z')
        expect(onSaveError).not.toHaveBeenCalled()
      } finally { vi.useRealTimers() }
    })

    it('ajout accepté, retrait refusé : l’aliment est au frigo — la base l’a — et l’échec du retrait est signalé', async () => {
      const ajout = differee(); const retrait = differee()
      addToStock.mockReturnValueOnce(ajout.promesse)
      removeFromStock.mockReturnValueOnce(retrait.promesse)
      const { result } = monter()
      act(() => { result.current.toggleIngredient('fr-tomate') })
      act(() => { result.current.toggleIngredient('fr-tomate') })
      await act(async () => { retrait.trancher(REFUS) })
      await act(async () => { ajout.trancher(OK) })
      expect(result.current.stock.has('fr-tomate')).toBe(true)
      expect(onSaveError).toHaveBeenCalledTimes(1)
    })

    it('ajout refusé, retrait accepté : l’aliment n’y est pas, et c’est ce qui était voulu — rien n’est signalé', async () => {
      const ajout = differee(); const retrait = differee()
      addToStock.mockReturnValueOnce(ajout.promesse)
      removeFromStock.mockReturnValueOnce(retrait.promesse)
      const { result } = monter()
      act(() => { result.current.toggleIngredient('fr-tomate') })
      act(() => { result.current.toggleIngredient('fr-tomate') })
      await act(async () => { ajout.trancher(REFUS) })
      await act(async () => { retrait.trancher(OK) })
      expect(result.current.stock.has('fr-tomate')).toBe(false)
      expect(onSaveError).not.toHaveBeenCalled()
    })

    it('ajout groupé refusé pendant qu’un des aliments est retiré à la main (refusé aussi) : aucun ne reste', async () => {
      const lot = differee(); const retrait = differee()
      addToStock.mockReturnValue(lot.promesse)
      removeFromStock.mockReturnValueOnce(retrait.promesse)
      const { result } = monter()
      act(() => { result.current.addBatch(['fr-tomate', 'fr-beurre']) })
      act(() => { result.current.toggleIngredient('fr-tomate') })
      await act(async () => { retrait.trancher(REFUS) })
      await act(async () => { lot.trancher(REFUS) })
      expect([...result.current.stock]).toEqual([])
      // Le beurre, lui, était voulu : son refus est signalé — une seule fois.
      expect(onSaveError).toHaveBeenCalledTimes(1)
    })
  })

  // Même fuite que celle fermée le 28 août pour le chargement : une réponse en
  // retard d'un compte ne doit pas toucher l'écran du suivant.
  it('le compte change pendant qu’une écriture est en vol : son refus ne touche pas le frigo du compte suivant', async () => {
    const ajout = differee()
    addToStock.mockReturnValueOnce(ajout.promesse)
    const { result, rerender } = renderHook(({ user }) => useFridgeStock(user, { onSaveError }), { initialProps: { user: BOB } })
    act(() => { result.current.toggleIngredient('fr-tomate') })
    // Bob se déconnecte, Alice se connecte : son frigo est chargé — elle a des tomates.
    rerender({ user: { id: 'u-alice' } })
    act(() => {
      result.current.setStock(new Set(['fr-tomate']))
      result.current.setStockMeta(new Map([['fr-tomate', { addedAt: '2026-09-01T08:00:00.000Z', expiresAt: null }]]))
    })
    await act(async () => { ajout.trancher(REFUS) })
    expect(result.current.stock.has('fr-tomate')).toBe(true)
    expect(result.current.stockMeta.get('fr-tomate')).toEqual({ addedAt: '2026-09-01T08:00:00.000Z', expiresAt: null })
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('le compte change : les écritures en vol de l’ancien compte ne faussent pas celles du nouveau', async () => {
    const ajoutDeBob = differee()
    addToStock.mockReturnValueOnce(ajoutDeBob.promesse)
    const { result, rerender } = renderHook(({ user }) => useFridgeStock(user, { onSaveError }), { initialProps: { user: BOB } })
    act(() => { result.current.toggleIngredient('fr-tomate') })
    rerender({ user: { id: 'u-alice' } })
    act(() => {
      result.current.setStock(new Set(['fr-tomate']))
      result.current.setStockMeta(new Map([['fr-tomate', { addedAt: '2026-09-01T08:00:00.000Z', expiresAt: null }]]))
    })
    // Alice retire ses tomates ; la base refuse. L'écriture de Bob, elle, est toujours en vol.
    removeFromStock.mockResolvedValueOnce(REFUS)
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    // Le refus est connu tout de suite — sans attendre l'écriture d'un autre compte — et les tomates reviennent.
    expect(result.current.stock.has('fr-tomate')).toBe(true)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('un appel qui lève (réseau coupé) compte comme un refus', async () => {
    addToStock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = monter()
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(false)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('ajout groupé : seuls les aliments refusés sont retirés, et l’échec n’est signalé qu’une fois', async () => {
    addToStock.mockImplementation(async (_uid, id) => (id === 'fr-beurre' ? OK : REFUS))
    const { result } = monter()
    await act(async () => { result.current.addBatch(['fr-tomate', 'fr-beurre', 'fr-oeuf']) })
    expect([...result.current.stock]).toEqual(['fr-beurre'])
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('retrait groupé : les aliments dont le retrait est refusé reviennent', async () => {
    const { result } = monter()
    await act(async () => { result.current.addBatch(['fr-tomate', 'fr-beurre']) })
    removeFromStock.mockImplementation(async (_uid, id) => (id === 'fr-beurre' ? REFUS : OK))
    await act(async () => { result.current.removeBatch(['fr-tomate', 'fr-beurre']) })
    expect([...result.current.stock]).toEqual(['fr-beurre'])
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('« Vider le frigo » refusé : rien n’est vidé à l’écran, l’échec est signalé', async () => {
    const { result } = monter()
    await act(async () => { result.current.addBatch(['fr-tomate', 'fr-beurre']) })
    clearStock.mockResolvedValue({ error: { message: 'Failed to fetch' }, deleted: 0 })
    let retour
    await act(async () => { retour = await result.current.resetStock() })
    expect([...result.current.stock].sort()).toEqual(['fr-beurre', 'fr-tomate'])
    expect(retour.error).toBeTruthy()
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('vidage confirmé (après la fenêtre d’annulation) refusé : le frigo revient', async () => {
    const { result } = monter()
    await act(async () => { result.current.addBatch(['fr-tomate', 'fr-beurre']) })
    act(() => { result.current.emptyFridgeOptimistic() })
    expect(result.current.stock.size).toBe(0)
    clearStock.mockRejectedValue(new TypeError('Failed to fetch'))
    await act(async () => { await result.current.emptyFridgeConfirm() })
    expect([...result.current.stock].sort()).toEqual(['fr-beurre', 'fr-tomate'])
    expect(result.current.stockMeta.size).toBe(2)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('vidage accepté : le frigo est vide, rien n’est signalé', async () => {
    const { result } = monter()
    await act(async () => { result.current.addBatch(['fr-tomate']) })
    await act(async () => { await result.current.resetStock() })
    expect(result.current.stock.size).toBe(0)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('invité : rien ne part vers la base, rien n’est annulé', async () => {
    const { result } = renderHook(() => useFridgeStock(null, { onSaveError }))
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(true)
    expect(addToStock).not.toHaveBeenCalled()
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('sans `onSaveError`, un refus annule quand même l’affichage', async () => {
    addToStock.mockResolvedValue(REFUS)
    const { result } = renderHook(() => useFridgeStock(BOB))
    await act(async () => { result.current.toggleIngredient('fr-tomate') })
    expect(result.current.stock.has('fr-tomate')).toBe(false)
  })
})
