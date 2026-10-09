import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Les recettes publiques de la communauté ne servent qu'au panneau de recettes
// et aux restes : lues à la première ouverture de l'un d'eux, plus à chaque
// démarrage sur chaque page — deux requêtes (avec leur pré-vol) que la FAQ et
// l'accueil payaient pour rien (audit du 2026-10-04, PERF-07).

vi.mock('@features/recipes/lib/custom-recipes', () => ({ getPublicRecipes: vi.fn() }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: vi.fn() }))

import { getPublicRecipes } from '@features/recipes/lib/custom-recipes'
import { logError } from '@shared/lib/observability/sentry'
import { usePublicRecipesOnDemand } from '@app/hooks/use-public-recipes-on-demand'

describe('usePublicRecipesOnDemand', () => {
  beforeEach(() => {
    getPublicRecipes.mockReset()
    logError.mockReset()
  })

  it('tant que rien ne les demande, rien n’est lu', () => {
    const { result } = renderHook(() => usePublicRecipesOnDemand(false))

    expect(getPublicRecipes).not.toHaveBeenCalled()
    expect(result.current).toEqual([])
  })

  it('à la première ouverture, elles sont lues et rendues', async () => {
    const publiques = [{ id: 'p1', isCustom: true }]
    getPublicRecipes.mockResolvedValue(publiques)

    const { result, rerender } = renderHook(({ voulu }) => usePublicRecipesOnDemand(voulu), { initialProps: { voulu: false } })
    rerender({ voulu: true })

    await waitFor(() => expect(result.current).toEqual(publiques))
    expect(getPublicRecipes).toHaveBeenCalledTimes(1)
  })

  it('refermer puis rouvrir ne les relit pas', async () => {
    getPublicRecipes.mockResolvedValue([{ id: 'p1' }])
    const { result, rerender } = renderHook(({ voulu }) => usePublicRecipesOnDemand(voulu), { initialProps: { voulu: true } })
    await waitFor(() => expect(result.current).toHaveLength(1))

    rerender({ voulu: false })
    rerender({ voulu: true })

    expect(getPublicRecipes).toHaveBeenCalledTimes(1)
    expect(result.current).toHaveLength(1)
  })

  it('une lecture ratée est journalisée, et la prochaine ouverture réessaie', async () => {
    getPublicRecipes.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([{ id: 'p1' }])
    const { result, rerender } = renderHook(({ voulu }) => usePublicRecipesOnDemand(voulu), { initialProps: { voulu: true } })
    await waitFor(() => expect(logError).toHaveBeenCalledTimes(1))

    rerender({ voulu: false })
    rerender({ voulu: true })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(getPublicRecipes).toHaveBeenCalledTimes(2)
  })
})
