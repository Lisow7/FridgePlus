import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { renderHook, act } from '@testing-library/react'

const saveCustomRecipe = vi.hoisted(() => vi.fn())
const loadCustomRecipes = vi.hoisted(() => vi.fn())
const markAdminModifiedRead = vi.hoisted(() => vi.fn())
const signaler = vi.hoisted(() => vi.fn())

vi.mock('@features/recipes/lib/custom-recipes', () => ({ saveCustomRecipe, loadCustomRecipes, markAdminModifiedRead }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))

import { useCustomRecipesHandlers } from '@app/hooks/use-custom-recipes-handlers'

// Hors audit, trouvé en corrigeant le lot 7 (2026-10-05). Ces gestionnaires
// jetaient le résultat de l'enregistrement, et rechargeaient « Mes recettes »
// avec une lecture qui rend du vide sur erreur : une recette refusée passait
// pour enregistrée, et un rechargement raté vidait la liste à l'écran.
const BOB = { id: 'u-bob' }
const PANNE = { message: 'Failed to fetch' }
const TARTE = { id: 'r-tarte', name: 'Tarte', admin_modified: true }
const SOUPE = { id: 'r-soupe', name: 'Soupe', admin_modified: false }
const NOUVELLE = { id: 'r-neuve', name: 'Gratin' }

const setDeletingRecipe = vi.fn()
function monter(depart = [TARTE, SOUPE]) {
  return renderHook(() => {
    const [customRecipes, setCustomRecipes] = useState(depart)
    return { customRecipes, ...useCustomRecipesHandlers({ user: BOB, customRecipes, setCustomRecipes, setDeletingRecipe }) }
  })
}

describe('useCustomRecipesHandlers — enregistrer une recette', () => {
  beforeEach(() => {
    saveCustomRecipe.mockReset(); saveCustomRecipe.mockResolvedValue({ error: null })
    loadCustomRecipes.mockReset(); loadCustomRecipes.mockResolvedValue({ recipes: [NOUVELLE, TARTE, SOUPE], error: null })
    markAdminModifiedRead.mockReset(); markAdminModifiedRead.mockResolvedValue({ error: null })
    signaler.mockReset(); setDeletingRecipe.mockReset()
  })

  it('acceptée : la liste est rechargée, aucune erreur n’est rendue', async () => {
    const { result } = monter()
    let retour
    await act(async () => { retour = await result.current.handleSaveCustomRecipe(NOUVELLE) })
    expect(retour).toEqual({ error: null })
    expect(result.current.customRecipes).toEqual([NOUVELLE, TARTE, SOUPE])
  })

  it('refusée : l’erreur est rendue à l’appelant, la liste n’est pas touchée, rien n’est rechargé', async () => {
    saveCustomRecipe.mockResolvedValue({ error: PANNE })
    const { result } = monter()
    let retour
    await act(async () => { retour = await result.current.handleSaveCustomRecipe(NOUVELLE) })
    expect(retour).toEqual({ error: PANNE })
    expect(result.current.customRecipes).toEqual([TARTE, SOUPE])
    expect(loadCustomRecipes).not.toHaveBeenCalled()
  })

  it('enregistrée, mais le rechargement échoue : la liste garde ce qu’elle montrait, plus la nouvelle recette', async () => {
    loadCustomRecipes.mockResolvedValue({ recipes: [], error: PANNE })
    const { result } = monter()
    let retour
    await act(async () => { retour = await result.current.handleSaveCustomRecipe(NOUVELLE) })
    expect(retour).toEqual({ error: null })
    expect(result.current.customRecipes.map((r) => r.id)).toEqual(['r-neuve', 'r-tarte', 'r-soupe'])
  })

  it('modifiée, mais le rechargement échoue : la recette est remplacée à sa place', async () => {
    loadCustomRecipes.mockResolvedValue({ recipes: [], error: PANNE })
    const { result } = monter()
    await act(async () => { await result.current.handleSaveCustomRecipe({ ...SOUPE, name: 'Soupe au pistou' }) })
    expect(result.current.customRecipes).toEqual([TARTE, { ...SOUPE, name: 'Soupe au pistou' }])
  })

  it('un enregistrement qui lève : rendu comme une erreur, sans exception', async () => {
    saveCustomRecipe.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = monter()
    let retour
    await act(async () => { retour = await result.current.handleSaveCustomRecipe(NOUVELLE) })
    expect(retour.error).toBeTruthy()
    expect(result.current.customRecipes).toEqual([TARTE, SOUPE])
  })
})

describe('useCustomRecipesHandlers — après une suppression', () => {
  beforeEach(() => {
    loadCustomRecipes.mockReset(); setDeletingRecipe.mockReset(); signaler.mockReset()
  })

  it('rechargement accepté : la liste est celle de la base', async () => {
    loadCustomRecipes.mockResolvedValue({ recipes: [SOUPE], error: null })
    const { result } = monter()
    await act(async () => { await result.current.handleRecipeDeletionConfirmed({ ok: true }, 'r-tarte') })
    expect(result.current.customRecipes).toEqual([SOUPE])
    expect(setDeletingRecipe).toHaveBeenCalledWith(null)
  })

  it('rechargement raté : la recette supprimée quitte la liste, les autres restent (la liste n’est pas vidée)', async () => {
    loadCustomRecipes.mockResolvedValue({ recipes: [], error: PANNE })
    const { result } = monter()
    await act(async () => { await result.current.handleRecipeDeletionConfirmed({ ok: true }, 'r-tarte') })
    expect(result.current.customRecipes).toEqual([SOUPE])
  })
})

describe('useCustomRecipesHandlers — « modifiée par l’admin », lu', () => {
  beforeEach(() => { markAdminModifiedRead.mockReset(); signaler.mockReset() })

  it('écriture acceptée : le bandeau disparaît, rien n’est dit', async () => {
    markAdminModifiedRead.mockResolvedValue({ error: null })
    const { result } = monter()
    await act(async () => { await result.current.handleMarkAdminModifiedRead('r-tarte') })
    expect(result.current.customRecipes[0].admin_modified).toBe(false)
    expect(signaler).not.toHaveBeenCalled()
  })

  it('écriture refusée : le bandeau reste — il reviendrait au rechargement —, et c’est dit', async () => {
    markAdminModifiedRead.mockResolvedValue({ error: PANNE })
    const { result } = monter()
    await act(async () => { await result.current.handleMarkAdminModifiedRead('r-tarte') })
    expect(result.current.customRecipes[0].admin_modified).toBe(true)
    expect(signaler).toHaveBeenCalledTimes(1)
  })
})
