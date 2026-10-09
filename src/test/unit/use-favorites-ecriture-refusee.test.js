import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode, createElement } from 'react'
import { renderHook, act } from '@testing-library/react'

const addFavorite = vi.hoisted(() => vi.fn())
const removeFavorite = vi.hoisted(() => vi.fn())

vi.mock('@features/recipes/api/favorites', () => ({ addFavorite, removeFavorite, loadFavoritesFromDB: vi.fn() }))

import { useFavorites } from '@features/recipes/hooks/use-favorites'

// Audit du 2026-10-04, UX-02 — même cause que pour le frigo : le résultat de
// l'écriture était jeté. Un favori « ajouté » sans réseau restait affiché, puis
// disparaissait au rechargement, sans un mot.
const BOB = { id: 'u-bob' }
const REFUS = { error: { message: 'Failed to fetch' } }
const OK = { error: null }

describe('useFavorites — écriture refusée par la base', () => {
  const onSaveError = vi.fn()
  const monter = (options) => renderHook(() => useFavorites(BOB, { onSaveError }), options)

  beforeEach(() => {
    localStorage.clear()
    onSaveError.mockReset()
    addFavorite.mockReset(); addFavorite.mockResolvedValue(OK)
    removeFavorite.mockReset(); removeFavorite.mockResolvedValue(OK)
  })

  it('ajout accepté : le favori reste, rien n’est signalé', async () => {
    const { result } = monter()
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(true)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('ajout refusé : le favori est retiré, et l’échec signalé', async () => {
    addFavorite.mockResolvedValue(REFUS)
    const { result } = monter()
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(false)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('retrait refusé : le favori revient', async () => {
    const { result } = monter()
    await act(async () => { result.current.toggleFavorite('pasta') })
    removeFavorite.mockResolvedValue(REFUS)
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(true)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('l’écran change tout de suite, sans attendre la base', () => {
    addFavorite.mockReturnValue(new Promise(() => {}))
    const { result } = monter()
    act(() => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(true)
  })

  it('un refus qui arrive après un nouveau geste sur la même recette n’annule pas ce geste', async () => {
    let trancher
    addFavorite.mockReturnValueOnce(new Promise((resolve) => { trancher = resolve }))
    const { result } = monter()
    act(() => { result.current.toggleFavorite('pasta') })
    await act(async () => { result.current.toggleFavorite('pasta') })
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(true)
    await act(async () => { trancher(REFUS) })
    expect(result.current.favorites.has('pasta')).toBe(true)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  // Deux écritures de la même recette qui se croisent (double-clic sur le
  // cœur) : l'écran revient à ce que la base contient, pas à l'état — jamais
  // enregistré — que le premier geste venait d'afficher.
  describe('deux écritures de la même recette qui se croisent', () => {
    function differee() {
      let trancher
      const promesse = new Promise((resolve) => { trancher = resolve })
      return { promesse, trancher }
    }

    it('ajout puis retrait, tous deux refusés : la recette n’est pas en favori — la base ne l’a jamais eue', async () => {
      const ajout = differee(); const retrait = differee()
      addFavorite.mockReturnValueOnce(ajout.promesse)
      removeFavorite.mockReturnValueOnce(retrait.promesse)
      const { result } = monter()
      act(() => { result.current.toggleFavorite('pasta') })
      act(() => { result.current.toggleFavorite('pasta') })
      await act(async () => { ajout.trancher(REFUS) })
      await act(async () => { retrait.trancher(REFUS) })
      expect(result.current.favorites.has('pasta')).toBe(false)
      expect(onSaveError).not.toHaveBeenCalled()
    })

    it('retrait puis ajout, tous deux refusés : le favori reste — la base l’a toujours', async () => {
      const { result } = monter()
      await act(async () => { result.current.toggleFavorite('pasta') })
      const retrait = differee(); const ajout = differee()
      removeFavorite.mockReturnValueOnce(retrait.promesse)
      addFavorite.mockReturnValueOnce(ajout.promesse)
      act(() => { result.current.toggleFavorite('pasta') })
      act(() => { result.current.toggleFavorite('pasta') })
      await act(async () => { ajout.trancher(REFUS) })
      await act(async () => { retrait.trancher(REFUS) })
      expect(result.current.favorites.has('pasta')).toBe(true)
      expect(onSaveError).not.toHaveBeenCalled()
    })

    it('ajout accepté, retrait refusé : le favori est là — la base l’a — et l’échec du retrait est signalé', async () => {
      const ajout = differee(); const retrait = differee()
      addFavorite.mockReturnValueOnce(ajout.promesse)
      removeFavorite.mockReturnValueOnce(retrait.promesse)
      const { result } = monter()
      act(() => { result.current.toggleFavorite('pasta') })
      act(() => { result.current.toggleFavorite('pasta') })
      await act(async () => { retrait.trancher(REFUS) })
      await act(async () => { ajout.trancher(OK) })
      expect(result.current.favorites.has('pasta')).toBe(true)
      expect(onSaveError).toHaveBeenCalledTimes(1)
    })
  })

  it('le compte change pendant qu’une écriture est en vol : son refus ne touche pas les favoris du compte suivant', async () => {
    let trancher
    addFavorite.mockReturnValueOnce(new Promise((resolve) => { trancher = resolve }))
    const { result, rerender } = renderHook(({ user }) => useFavorites(user, { onSaveError }), { initialProps: { user: BOB } })
    act(() => { result.current.toggleFavorite('pasta') })
    // Bob se déconnecte, Alice se connecte : ses favoris sont chargés — elle a « pasta ».
    rerender({ user: { id: 'u-alice' } })
    act(() => { result.current.setFavorites(new Set(['pasta'])) })
    await act(async () => { trancher(REFUS) })
    expect(result.current.favorites.has('pasta')).toBe(true)
    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('le compte change : l’écriture en vol de l’ancien compte ne fausse pas celles du nouveau', async () => {
    addFavorite.mockReturnValueOnce(new Promise(() => {}))
    const { result, rerender } = renderHook(({ user }) => useFavorites(user, { onSaveError }), { initialProps: { user: BOB } })
    act(() => { result.current.toggleFavorite('pasta') })
    rerender({ user: { id: 'u-alice' } })
    act(() => { result.current.setFavorites(new Set(['pasta'])) })
    removeFavorite.mockResolvedValueOnce(REFUS)
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(true)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  it('un appel qui lève (réseau coupé) compte comme un refus', async () => {
    addFavorite.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = monter()
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(false)
    expect(onSaveError).toHaveBeenCalledTimes(1)
  })

  // L'appel partait DEPUIS l'updater de `setFavorites` : React rejoue les
  // updaters en mode strict, donc deux requêtes par clic en développement.
  it('une seule requête par geste, même en mode strict', async () => {
    const { result } = monter({ wrapper: ({ children }) => createElement(StrictMode, null, children) })
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(addFavorite).toHaveBeenCalledTimes(1)
  })

  it('deux gestes dans le même tick se composent', async () => {
    const { result } = monter()
    await act(async () => {
      result.current.toggleFavorite('pasta')
      result.current.toggleFavorite('pizza')
    })
    expect([...result.current.favorites].sort()).toEqual(['pasta', 'pizza'])
  })

  it('invité : rien ne part vers la base, rien n’est annulé', async () => {
    const { result } = renderHook(() => useFavorites(null, { onSaveError }))
    await act(async () => { result.current.toggleFavorite('pasta') })
    expect(result.current.favorites.has('pasta')).toBe(true)
    expect(JSON.parse(localStorage.getItem('fridge-favorites'))).toEqual(['pasta'])
    expect(addFavorite).not.toHaveBeenCalled()
  })
})
