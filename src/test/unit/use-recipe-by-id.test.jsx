import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// useRecipeById — Sprint 11 S11.c.1.
//
// Le hook résout un id depuis 3 sources :
//   1. Base recipes en mémoire (préfixe `r-` mais détecté via lookup,
//      pas via le préfixe — le préfixe n'est qu'une convention)
//   2. Custom recipes / public (Supabase async via getRecipeById)
//
// On vérifie le contrat (loading → ok/not-found) et la priorité base
// recipes > Supabase (pas de fetch inutile si trouvé en mémoire).

vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: vi.fn(),
}))
vi.mock('@features/recipes/api/recipes', () => ({
  getRecipeById: vi.fn(),
}))

import { useBaseRecipes } from '@shared/contexts/data-provider'
import { getRecipeById } from '@features/recipes/api/recipes'
import { useRecipeById } from '@features/recipes/hooks/use-recipe-by-id'

describe('useRecipeById', () => {
  beforeEach(() => {
    useBaseRecipes.mockReset()
    getRecipeById.mockReset()
  })

  it('résout depuis baseRecipes sans appeler Supabase', async () => {
    const baseRecipe = { id: 'r-pasta-pesto', name: { fr: 'Pâtes pesto' } }
    useBaseRecipes.mockReturnValue({ recipes: [baseRecipe] })

    const { result } = renderHook(() => useRecipeById('r-pasta-pesto'))

    await waitFor(() => {
      expect(result.current.status).toBe('ok')
    })
    expect(result.current.recipe).toEqual(baseRecipe)
    expect(getRecipeById).not.toHaveBeenCalled()
  })

  it('fetch Supabase si pas trouvé en mémoire (custom/public)', async () => {
    useBaseRecipes.mockReturnValue({ recipes: [] })
    const customRecipe = { id: 'abc-uuid', name: { fr: 'Recette user' } }
    getRecipeById.mockResolvedValue({ recipe: customRecipe, status: 'ok' })

    const { result } = renderHook(() => useRecipeById('abc-uuid'))

    await waitFor(() => {
      expect(result.current.status).toBe('ok')
    })
    expect(result.current.recipe).toEqual(customRecipe)
    expect(getRecipeById).toHaveBeenCalledWith('abc-uuid')
  })

  it('retourne not-found si Supabase ne renvoie rien', async () => {
    useBaseRecipes.mockReturnValue({ recipes: [] })
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const { result } = renderHook(() => useRecipeById('inexistant-uuid'))

    await waitFor(() => {
      expect(result.current.status).toBe('not-found')
    })
    expect(result.current.recipe).toBeNull()
  })

  it('retourne not-found immédiatement si id manquant', () => {
    useBaseRecipes.mockReturnValue({ recipes: [] })

    const { result } = renderHook(() => useRecipeById(null))

    expect(result.current.status).toBe('not-found')
    expect(result.current.recipe).toBeNull()
    expect(getRecipeById).not.toHaveBeenCalled()
  })

  it('ignore le résultat si le composant a démonté entretemps', async () => {
    useBaseRecipes.mockReturnValue({ recipes: [] })
    let resolveSupabase
    getRecipeById.mockReturnValue(new Promise((res) => { resolveSupabase = res }))

    const { result, unmount } = renderHook(() => useRecipeById('abc-uuid'))
    expect(result.current.status).toBe('loading')

    unmount()
    resolveSupabase({ recipe: { id: 'abc-uuid' }, status: 'ok' })

    await new Promise((r) => setTimeout(r, 10))
    // Pas d'assertion bruyante — vérifie juste qu'on ne crash pas
    // (setState après unmount = warning React). Le `cancelled` du hook
    // doit empêcher l'update.
  })

  // `/recipe/:id` est une route PUBLIQUE, atteinte par lien partagé : une
  // panne réseau ne doit pas y laisser un écran mort. Mesuré le 2026-08-07 :
  // supabase-js LÈVE sur une requête avortée au lieu de renseigner `error`,
  // et le `.then()` sans `.catch()` laissait `status` à 'loading' pour
  // toujours — même défaut que celui corrigé sur la liste de courses partagée.
  it('une promesse rejetée ne laisse pas la page figée sur « Chargement »', async () => {
    useBaseRecipes.mockReturnValue({ recipes: [] })
    getRecipeById.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useRecipeById('abc-uuid'))

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading')
    })
    // 'error' et non 'not-found' : annoncer « recette introuvable » sur une
    // panne technique est un diagnostic faux, qui dissuade de réessayer.
    expect(result.current.status).toBe('error')
    expect(result.current.recipe).toBeNull()
  })
})
