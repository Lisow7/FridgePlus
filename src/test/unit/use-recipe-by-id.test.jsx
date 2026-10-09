import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// useRecipeById — la fiche d'une recette, quelle que soit la façon d'y arriver.
//
// Sources, dans l'ordre :
//   1. le catalogue en mémoire, mais seulement une fois le catalogue ARRIVÉ
//      (`catalogStatus === 'ok'`) : avant, la mémoire ne contient que les
//      100 recettes embarquées sur 515, sans étapes ni descriptions ;
//   2. la recette officielle lue SEULE (`getOfficialRecipeById`, une ligne) ;
//   3. une recette d'utilisateur (`getRecipeById`, table `custom_recipes`).
//
// Audit du 2026-10-04, PERF-02 : un lien direct vers 81 % des recettes
// affichait « Recette introuvable » le temps que le catalogue arrive — ou pour
// toujours s'il n'arrivait pas. La fiche ne dépend plus du catalogue.

vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: vi.fn(),
}))
vi.mock('@features/recipes/api/recipes', () => ({
  getRecipeById: vi.fn(),
  getOfficialRecipeById: vi.fn(),
}))

import { useBaseRecipes } from '@shared/contexts/data-provider'
import { getRecipeById, getOfficialRecipeById } from '@features/recipes/api/recipes'
import { useRecipeById } from '@features/recipes/hooks/use-recipe-by-id'

const registerRecipeName = vi.fn()

function catalogue(recipes, catalogStatus) {
  useBaseRecipes.mockReturnValue({ recipes, catalogStatus, registerRecipeName })
}

describe('useRecipeById', () => {
  beforeEach(() => {
    useBaseRecipes.mockReset()
    getRecipeById.mockReset()
    getOfficialRecipeById.mockReset()
    registerRecipeName.mockReset()
  })

  it('catalogue arrivé : la mémoire fait foi, sans aucune requête', async () => {
    const complete = { id: 'carbonara', steps: { fr: ['Cuire'] } }
    catalogue([complete], 'ok')

    const { result } = renderHook(() => useRecipeById('carbonara'))

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.recipe).toBe(complete)
    expect(getOfficialRecipeById).not.toHaveBeenCalled()
    expect(getRecipeById).not.toHaveBeenCalled()
  })

  // Catalogue mince (PERF-01) : arrivé, il n'a plus les étapes. La recette du
  // catalogue s'affiche tout de suite, et la fiche complète la remplace.
  it('catalogue arrivé mais mince : montrée tout de suite, puis complétée par la fiche', async () => {
    const mince = { id: 'affogato' }
    const complete = { id: 'affogato', steps: { fr: ['Verser'] } }
    catalogue([mince], 'ok')
    let resoudre
    getOfficialRecipeById.mockReturnValue(new Promise((res) => { resoudre = res }))

    const { result } = renderHook(() => useRecipeById('affogato'))

    expect(result.current.recipe).toBe(mince)
    expect(result.current.pending).toBe(true)
    resoudre({ recipe: complete, name: { fr: 'Affogato' } })
    await waitFor(() => expect(result.current.recipe).toBe(complete))
    expect(getRecipeById).not.toHaveBeenCalled()
  })

  // Le catalogue (sans étapes) arrive alors que la fiche complète est déjà à
  // l'écran : elle ne doit pas redevenir, même un instant, sa version mince.
  it('fiche complète affichée, puis le catalogue mince arrive : les étapes ne disparaissent pas', async () => {
    const complete = { id: 'affogato', steps: { fr: ['Verser'] } }
    catalogue([], 'loading')
    getOfficialRecipeById.mockResolvedValue({ recipe: complete, name: { fr: 'Affogato' } })
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const vus = []
    const { result, rerender } = renderHook(() => {
      const etat = useRecipeById('affogato')
      vus.push(etat.recipe)
      return etat
    })
    await waitFor(() => expect(result.current.recipe).toBe(complete))

    vus.length = 0
    catalogue([{ id: 'affogato' }], 'ok')
    rerender()
    await waitFor(() => expect(getOfficialRecipeById).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 10))

    expect(vus.every((recette) => recette === complete)).toBe(true)
  })

  // Un fournisseur qui rend un tableau NEUF à chaque appel (un simulacre de
  // test, ou une valeur recalculée) ne doit pas faire boucler l'effet : vu en
  // CI le 2026-10-05, `recipe-modal-base-recipe-peek` épuisait la mémoire du
  // processus de test (SIGABRT) depuis que l'aperçu passe par ce résolveur.
  it('un catalogue rendu neuf à chaque rendu ne fait pas boucler la lecture', async () => {
    useBaseRecipes.mockImplementation(() => ({ recipes: [], catalogStatus: 'loading', registerRecipeName }))
    getOfficialRecipeById.mockResolvedValue(null)
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })
    let rendus = 0

    const { result } = renderHook(() => { rendus++; return useRecipeById('bechamel-maison') })
    await waitFor(() => expect(result.current.status).toBe('not-found'))
    await new Promise((r) => setTimeout(r, 50))

    expect(rendus).toBeLessThan(10)
    expect(getOfficialRecipeById.mock.calls.length).toBeLessThan(4)
  })

  // Premier rendu : une recette déjà en mémoire est là TOUT DE SUITE. Avant,
  // le premier rendu disait toujours « chargement » : sur une page pré-rendue,
  // il posait un squelette d'une image entre le HTML servi et la fiche
  // (audit du 2026-10-04, PERF-05).
  it('recette en mémoire : dès le premier rendu, pas de « chargement »', () => {
    catalogue([{ id: 'carbonara' }], 'loading')
    getOfficialRecipeById.mockReturnValue(new Promise(() => {}))
    const statuts = []

    renderHook(() => { const etat = useRecipeById('carbonara'); statuts.push(etat.status); return etat })

    expect(statuts[0]).toBe('ok')
  })

  it('recette complète en mémoire, catalogue arrivé : prête dès le premier rendu, sans lecture', () => {
    const complete = { id: 'carbonara', steps: { fr: ['Cuire'] } }
    catalogue([complete], 'ok')
    const vus = []

    renderHook(() => { const etat = useRecipeById('carbonara'); vus.push(etat); return etat })

    expect(vus[0].recipe).toBe(complete)
    expect(vus[0].pending).toBeFalsy()
    expect(getOfficialRecipeById).not.toHaveBeenCalled()
  })

  // Passer d'une recette à une autre sans démonter (page /recipe/:id) : on ne
  // montre jamais la précédente, même le temps d'un rendu.
  it('changer de recette ne montre jamais la précédente', async () => {
    const carbonara = { id: 'carbonara', steps: { fr: ['Cuire'] } }
    catalogue([carbonara], 'ok')
    getOfficialRecipeById.mockReturnValue(new Promise(() => {}))
    getRecipeById.mockReturnValue(new Promise(() => {}))

    const vus = []
    const { result, rerender } = renderHook(({ id }) => {
      const etat = useRecipeById(id)
      vus.push({ id, recette: etat.recipe })
      return etat
    }, { initialProps: { id: 'carbonara' } })
    expect(result.current.recipe).toBe(carbonara)

    rerender({ id: 'affogato' })

    const apresChangement = vus.filter((v) => v.id === 'affogato')
    expect(apresChangement.length).toBeGreaterThan(0)
    expect(apresChangement.every((v) => v.recette !== carbonara)).toBe(true)
    expect(result.current.status).toBe('loading')
  })

  // Le cas de l'audit : `/recipe/affogato`, absente du jeu embarqué.
  it('catalogue pas encore arrivé : une recette officielle hors des 100 embarquées s’ouvre quand même', async () => {
    catalogue([], 'loading')
    const affogato = { id: 'affogato', steps: { fr: ['Verser le café'] } }
    getOfficialRecipeById.mockResolvedValue({ recipe: affogato, name: { fr: 'Affogato' } })
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const { result } = renderHook(() => useRecipeById('affogato'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.recipe).toBe(affogato)
    expect(getOfficialRecipeById).toHaveBeenCalledWith('affogato')
  })

  it('le nom de la recette lue seule est confié au catalogue (titre, modale, impression le lisent là)', async () => {
    catalogue([], 'loading')
    getOfficialRecipeById.mockResolvedValue({ recipe: { id: 'affogato' }, name: { fr: 'Affogato' } })
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const { result } = renderHook(() => useRecipeById('affogato'))

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(registerRecipeName).toHaveBeenCalledWith('affogato', { fr: 'Affogato' })
  })

  it('le catalogue en panne n’empêche pas la fiche de s’ouvrir', async () => {
    catalogue([], 'error')
    const affogato = { id: 'affogato', steps: { fr: ['Verser'] } }
    getOfficialRecipeById.mockResolvedValue({ recipe: affogato, name: { fr: 'Affogato' } })
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const { result } = renderHook(() => useRecipeById('affogato'))

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.recipe).toBe(affogato)
  })

  // Une recette embarquée n'a ni étapes ni description. On la montre TOUT DE
  // SUITE — attendre la lecture, c'était jusqu'à 7 s de squelette sur un réseau
  // qui flanche (supabase-js relance trois fois : 1 s, 2 s, 4 s) — et sa fiche
  // complète la remplace dès qu'elle arrive. `pending` dit qu'elle arrive.
  it('recette embarquée, catalogue pas encore arrivé : montrée tout de suite, puis remplacée par la fiche complète', async () => {
    const embarquee = { id: 'carbonara' }
    const complete = { id: 'carbonara', steps: { fr: ['Cuire les pâtes'] } }
    catalogue([embarquee], 'loading')
    let resoudre
    getOfficialRecipeById.mockReturnValue(new Promise((res) => { resoudre = res }))

    const { result } = renderHook(() => useRecipeById('carbonara'))

    expect(result.current.status).toBe('ok')
    expect(result.current.recipe).toBe(embarquee)
    expect(result.current.pending).toBe(true)

    resoudre({ recipe: complete, name: { fr: 'Pasta Carbonara' } })
    await waitFor(() => expect(result.current.recipe).toBe(complete))
    expect(result.current.pending).toBeFalsy()
    // Une recette embarquée est officielle : inutile d'interroger custom_recipes.
    expect(getRecipeById).not.toHaveBeenCalled()
  })

  it('recette embarquée et lecture en panne : la version embarquée plutôt qu’un écran d’erreur', async () => {
    const embarquee = { id: 'carbonara' }
    catalogue([embarquee], 'loading')
    getOfficialRecipeById.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useRecipeById('carbonara'))

    await waitFor(() => expect(result.current.pending).toBeFalsy())
    expect(result.current.status).toBe('ok')
    expect(result.current.recipe).toBe(embarquee)
  })

  it('catalogue arrivé et id absent : pas une recette officielle, seule custom_recipes est lue', async () => {
    catalogue([{ id: 'carbonara' }], 'ok')
    const customRecipe = { id: 'custom-1', name: 'Ma recette', isCustom: true }
    getRecipeById.mockResolvedValue({ recipe: customRecipe, status: 'ok' })

    const { result } = renderHook(() => useRecipeById('custom-1'))

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.recipe).toBe(customRecipe)
    expect(getOfficialRecipeById).not.toHaveBeenCalled()
  })

  it('une recette d’utilisateur s’ouvre aussi avant le catalogue', async () => {
    catalogue([], 'loading')
    const customRecipe = { id: 'abc-uuid', name: 'Recette user', isCustom: true }
    getOfficialRecipeById.mockResolvedValue(null)
    getRecipeById.mockResolvedValue({ recipe: customRecipe, status: 'ok' })

    const { result } = renderHook(() => useRecipeById('abc-uuid'))

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.recipe).toBe(customRecipe)
    expect(getRecipeById).toHaveBeenCalledWith('abc-uuid')
  })

  it('« introuvable » seulement quand les deux sources ont répondu non', async () => {
    catalogue([], 'loading')
    getOfficialRecipeById.mockResolvedValue(null)
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const { result } = renderHook(() => useRecipeById('inexistant'))

    await waitFor(() => expect(result.current.status).toBe('not-found'))
    expect(result.current.recipe).toBeNull()
  })

  // Une panne n'est pas une absence : « introuvable » ferait croire que le
  // lien est mort et dissuaderait de réessayer.
  it('lecture officielle en panne et rien dans custom_recipes : « indisponible », pas « introuvable »', async () => {
    catalogue([], 'loading')
    getOfficialRecipeById.mockRejectedValue(new Error('network down'))
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const { result } = renderHook(() => useRecipeById('affogato'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.recipe).toBeNull()
  })

  it('custom_recipes en panne et pas de recette officielle : « indisponible »', async () => {
    catalogue([], 'loading')
    getOfficialRecipeById.mockResolvedValue(null)
    getRecipeById.mockResolvedValue({ recipe: null, status: 'error' })

    const { result } = renderHook(() => useRecipeById('abc-uuid'))

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('retourne not-found immédiatement si id manquant', () => {
    catalogue([], 'loading')

    const { result } = renderHook(() => useRecipeById(null))

    expect(result.current.status).toBe('not-found')
    expect(result.current.recipe).toBeNull()
    expect(getRecipeById).not.toHaveBeenCalled()
    expect(getOfficialRecipeById).not.toHaveBeenCalled()
  })

  it('ignore le résultat si le composant a démonté entretemps', async () => {
    catalogue([], 'loading')
    let resoudre
    getOfficialRecipeById.mockReturnValue(new Promise((res) => { resoudre = res }))
    getRecipeById.mockResolvedValue({ recipe: null, status: 'not-found' })

    const { result, unmount } = renderHook(() => useRecipeById('affogato'))
    expect(result.current.status).toBe('loading')

    unmount()
    resoudre({ recipe: { id: 'affogato' }, name: { fr: 'Affogato' } })
    await new Promise((r) => setTimeout(r, 10))
    // Démonté : le nom n'est pas confié au catalogue pour une fiche que
    // personne ne regarde plus.
    expect(registerRecipeName).not.toHaveBeenCalled()
  })

  // `/recipe/:id` est une route PUBLIQUE, atteinte par lien partagé : une
  // panne réseau ne doit pas y laisser un écran mort. Mesuré le 2026-08-07 :
  // supabase-js LÈVE sur une requête avortée au lieu de renseigner `error`.
  it('deux promesses rejetées ne laissent pas la page figée sur « Chargement »', async () => {
    catalogue([], 'loading')
    getOfficialRecipeById.mockRejectedValue(new Error('network down'))
    getRecipeById.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useRecipeById('abc-uuid'))

    await waitFor(() => expect(result.current.status).not.toBe('loading'))
    expect(result.current.status).toBe('error')
    expect(result.current.recipe).toBeNull()
  })

  it('quand le catalogue arrive pendant la lecture, la fiche du catalogue est prise', async () => {
    const complete = { id: 'affogato', steps: { fr: ['Verser'] } }
    catalogue([], 'loading')
    getOfficialRecipeById.mockReturnValue(new Promise(() => {}))
    getRecipeById.mockReturnValue(new Promise(() => {}))

    const { result, rerender } = renderHook(() => useRecipeById('affogato'))
    expect(result.current.status).toBe('loading')

    catalogue([complete], 'ok')
    rerender()

    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.recipe).toBe(complete)
  })
})
