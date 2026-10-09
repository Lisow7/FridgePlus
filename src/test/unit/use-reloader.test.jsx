import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useReloader } from '@shared/hooks/use-reloader'

// Onze écrans d'administration réécrivaient le même chargement — et AUCUN
// n'avait de `finally` (audit 2026-08-28, compté sur le dépôt : 11 sections,
// 0 occurrence). Une exception réseau laissait donc le voyant de chargement
// allumé indéfiniment, onze fois, sans message ni moyen de reprendre autrement
// qu'en rechargeant la page.
//
// La documentation React 19 ajoute une seconde exigence au chargement écrit à
// la main : se protéger des réponses OBSOLÈTES. Ces écrans ont tous des
// filtres ; enchaîner deux filtres rapidement laissait la réponse la plus
// ancienne écraser la plus récente.
//
// Ce hook possède le CYCLE (chargement, erreur, obsolescence) et laisse chaque
// écran posséder SES données — c'est ce qui lui permet de couvrir les onze,
// dont les corps posent de deux à cinq états différents.

describe('useReloader — cycle de chargement sûr', () => {
  it('éteint le voyant même quand la tâche ÉCHOUE (le défaut d’origine)', async () => {
    const boum = vi.fn().mockRejectedValue(new Error('réseau coupé'))
    const { result } = renderHook(() => useReloader(boum, []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error.message).toBe('réseau coupé')
  })

  it('éteint le voyant quand la tâche réussit, sans erreur', async () => {
    const { result } = renderHook(() => useReloader(async () => {}, []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it('lance le chargement au montage, sans que l’écran ait à l’appeler', async () => {
    const tache = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useReloader(tache, []))
    await waitFor(() => expect(tache).toHaveBeenCalledTimes(1))
  })

  it('signale l’obsolescence : une réponse en retard ne doit pas écrire', async () => {
    // Deux appels se chevauchent. Le premier apprend qu'il est dépassé.
    let resoudrePremier
    const premier = new Promise(r => { resoudrePremier = r })
    let vuObsolete = null
    let appel = 0
    const tache = vi.fn(async (estObsolete) => {
      appel += 1
      if (appel === 1) { await premier; vuObsolete = estObsolete() }
    })
    const { result } = renderHook(() => useReloader(tache, []))
    await act(async () => { result.current.reload() })   // 2e appel, plus récent
    await act(async () => { resoudrePremier() })          // le 1er répond enfin
    expect(vuObsolete, 'la réponse en retard doit se savoir obsolète').toBe(true)
  })

  it('relance à la demande via reload()', async () => {
    const tache = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useReloader(tache, []))
    await waitFor(() => expect(tache).toHaveBeenCalledTimes(1))
    await act(async () => { await result.current.reload() })
    expect(tache).toHaveBeenCalledTimes(2)
  })

  it('n’écrit plus rien après démontage (pas de fuite d’état)', async () => {
    let resoudre
    const tache = vi.fn(async (estObsolete) => {
      await new Promise(r => { resoudre = r })
      expect(estObsolete()).toBe(true)
    })
    const { unmount } = renderHook(() => useReloader(tache, []))
    unmount()
    await act(async () => { resoudre() })
  })
})
