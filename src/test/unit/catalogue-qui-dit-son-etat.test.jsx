import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen, act } from '@testing-library/react'

// Le catalogue dit où il en est, et ne renonce pas au premier raté
// (audit du 2026-10-04, PERF-02, « chemin d'échec »).
//
// Avant : quatre lectures au démarrage, sans try/catch ni nouvel essai. Une
// seule qui échouait — même la petite `fridge_layouts` — et l'app restait
// toute la session sur les 100 recettes embarquées, sans que personne ne le
// sache : le panneau n'en montrait que 100, et 81 % des liens directs
// restaient « Recette introuvable » pour de bon.

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))

import { DataProvider, useBaseRecipes } from '@shared/contexts/data-provider'

// Réponse d'une lecture : un objet { data, error }, ou une exception (supabase-js
// LÈVE sur une requête avortée — mesuré le 2026-08-07).
function builder(reponse) {
  const b = {
    select: () => b, eq: () => b, in: () => b, order: () => b,
    then: (resolve, reject) => (reponse instanceof Error
      ? Promise.reject(reponse).then(resolve, reject)
      : Promise.resolve(reponse).then(resolve, reject)),
  }
  return b
}

const RECETTE = { id: 'affogato', name: { fr: 'Affogato' }, ingredients: [], steps: {}, allergens: [] }
let reponses
let lecturesParTable

function installer() {
  lecturesParTable = {}
  mockFrom.mockImplementation((table) => {
    lecturesParTable[table] = (lecturesParTable[table] ?? 0) + 1
    const file = reponses[table]
    const r = Array.isArray(file) ? (file.length > 1 ? file.shift() : file[0]) : { data: [], error: null }
    return builder(r)
  })
}

// Ce que la sonde a vu à son dernier rendu, lu par les tests.
const vu = {}
function Sonde() {
  const { catalogStatus, recipes, recipeNames, registerRecipeName } = useBaseRecipes()
  useEffect(() => { vu.registerRecipeName = registerRecipeName; vu.recipeNames = recipeNames })
  return (
    <div>
      <span data-testid="etat">{catalogStatus}</span>
      <span data-testid="nombre">{recipes.length}</span>
    </div>
  )
}

// Les réponses passent par plusieurs promesses : on les laisse toutes se régler.
async function vider() {
  await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve() })
}
async function avancer(ms) {
  await act(async () => { vi.advanceTimersByTime(ms) })
  await vider()
}
// Le chargement attend que le navigateur soit au repos : on le déclenche.
async function laisserCharger() {
  await avancer(3100)
}
// Chaque nouvel essai n'est programmé qu'une fois le précédent réglé : on
// avance d'un délai à la fois.
async function laisserToutEssayer() {
  await avancer(2100)
  await avancer(6100)
}

describe('DataProvider — état du catalogue et nouvel essai', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    reponses = {}
    installer()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('« loading » au départ, « ok » quand les recettes arrivent', async () => {
    reponses.recipes_unified = [{ data: [RECETTE], error: null }]
    render(<DataProvider><Sonde /></DataProvider>)

    expect(screen.getByTestId('etat')).toHaveTextContent('loading')
    await laisserCharger()

    expect(screen.getByTestId('etat')).toHaveTextContent('ok')
    expect(screen.getByTestId('nombre')).toHaveTextContent('1')
  })

  it('une lecture des recettes refusée est relancée, et le catalogue finit par arriver', async () => {
    reponses.recipes_unified = [
      { data: null, error: { message: 'timeout' } },
      { data: [RECETTE], error: null },
    ]
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()

    expect(screen.getByTestId('etat')).toHaveTextContent('loading')
    await avancer(2100)

    expect(screen.getByTestId('etat')).toHaveTextContent('ok')
    expect(lecturesParTable.recipes_unified).toBe(2)
  })

  it('seule la lecture qui a échoué est relancée', async () => {
    reponses.recipes_unified = [{ data: [RECETTE], error: null }]
    reponses.fridge_layouts = [
      new Error('Failed to fetch'),
      { data: [], error: null },
    ]
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    await avancer(2100)

    expect(lecturesParTable.fridge_layouts).toBe(2)
    expect(lecturesParTable.recipes_unified).toBe(1)
    expect(lecturesParTable.ingredients).toBe(1)
    expect(lecturesParTable.taxonomies).toBe(1)
  })

  it('une exception (requête avortée) est traitée comme un refus, sans rejet non géré', async () => {
    reponses.recipes_unified = [new Error('Failed to fetch'), { data: [RECETTE], error: null }]
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    await avancer(2100)

    expect(screen.getByTestId('etat')).toHaveTextContent('ok')
  })

  it('après les nouveaux essais, l’échec est DIT : « error »', async () => {
    reponses.recipes_unified = [{ data: null, error: { message: 'boom' } }]
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    await laisserToutEssayer()

    expect(screen.getByTestId('etat')).toHaveTextContent('error')
    // Les 100 recettes embarquées restent affichées : rien n'est vidé.
    expect(Number(screen.getByTestId('nombre').textContent)).toBe(100)
  })

  // Une réponse vide n'est pas un catalogue : la mémoire ne ferait pas foi.
  it('des recettes rendues vides ne comptent pas comme un catalogue arrivé', async () => {
    reponses.recipes_unified = [{ data: [], error: null }]
    render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    await laisserToutEssayer()

    expect(screen.getByTestId('etat')).toHaveTextContent('error')
  })

  it('démonté, il ne relance plus rien', async () => {
    reponses.recipes_unified = [{ data: null, error: { message: 'boom' } }]
    const { unmount } = render(<DataProvider><Sonde /></DataProvider>)
    await laisserCharger()
    const avant = lecturesParTable.recipes_unified
    unmount()
    await avancer(60000)

    expect(lecturesParTable.recipes_unified).toBe(avant)
  })

  it('registerRecipeName ajoute un nom absent, et ne change rien s’il est déjà là', async () => {
    reponses.recipes_unified = [{ data: null, error: { message: 'boom' } }]
    render(<DataProvider><Sonde /></DataProvider>)

    act(() => { vu.registerRecipeName('affogato', { fr: 'Affogato' }) })
    expect(vu.recipeNames.affogato).toEqual({ fr: 'Affogato' })

    const avant = vu.recipeNames
    act(() => { vu.registerRecipeName('affogato', { fr: 'Autre nom' }) })
    expect(vu.recipeNames).toBe(avant)
  })
})
