import { describe, it, expect, vi, beforeEach } from 'vitest'

// La fiche d'une recette officielle, lue SEULE (audit du 2026-10-04, PERF-02).
// Une ligne de `recipes_unified` (≈ 3 Ko) au lieu d'attendre le catalogue
// entier : c'est ce qui permet à un lien direct de s'ouvrir. Et depuis que le
// catalogue n'a plus les étapes (PERF-01), c'est aussi la source de chaque
// fiche ouverte — gardée pour la session, comme le catalogue.

const appels = vi.hoisted(() => [])
const reponse = vi.hoisted(() => ({ valeur: { data: null, error: null } }))

vi.mock('@shared/lib/supabase/client', () => {
  function builder(table) {
    const b = {
      select: (cols) => { appels.push(['select', table, cols]); return b },
      eq: (col, val) => { appels.push(['eq', col, val]); return b },
      is: (col, val) => { appels.push(['is', col, val]); return b },
      maybeSingle: () => { appels.push(['maybeSingle']); return Promise.resolve(reponse.valeur) },
    }
    return b
  }
  return { supabase: { from: (table) => { appels.push(['from', table]); return builder(table) } } }
})

import { OFFICIAL_RECIPE_FULL_COLUMNS } from '@shared/lib/recipes/official-recipe-rows'

const LIGNE = {
  id: 'affogato',
  name: { fr: 'Affogato', en: 'Affogato' },
  description: { fr: 'Une boule de glace noyée de café.' },
  emoji: '🍨',
  time_min: 5,
  difficulty: 'very-easy',
  type: 'dessert',
  servings: 2,
  ingredients: [{ ids: ['gp-cafe'], required: true }],
  steps: { fr: ['Verser le café sur la glace.'] },
  image_url: 'https://exemple.test/affogato.webp',
  status: 'published',
}

// Chaque test part d'un module neuf : la mémoire de session est vide.
let getOfficialRecipeById
beforeEach(async () => {
  appels.length = 0
  reponse.valeur = { data: null, error: null }
  vi.resetModules()
  ;({ getOfficialRecipeById } = await import('@features/recipes/api/recipes'))
})

const lectures = () => appels.filter((a) => a[0] === 'maybeSingle').length

describe('getOfficialRecipeById', () => {
  it('lit UNE ligne officielle de recipes_unified, avec les colonnes complètes', async () => {
    reponse.valeur = { data: LIGNE, error: null }

    await getOfficialRecipeById('affogato')

    expect(appels).toContainEqual(['from', 'recipes_unified'])
    expect(appels).toContainEqual(['select', 'recipes_unified', OFFICIAL_RECIPE_FULL_COLUMNS])
    expect(appels).toContainEqual(['eq', 'id', 'affogato'])
    expect(appels).toContainEqual(['eq', 'origin', 'official'])
    expect(appels).toContainEqual(['maybeSingle'])
  })

  it('rend la recette sous la forme du catalogue, et son nom à part', async () => {
    reponse.valeur = { data: LIGNE, error: null }

    const resultat = await getOfficialRecipeById('affogato')

    expect(resultat.name).toEqual({ fr: 'Affogato', en: 'Affogato' })
    expect(resultat.recipe).toMatchObject({
      id: 'affogato',
      time: '5 min',
      difficulty: 'Très facile',
      type: 'Dessert & Petit-déj',
      steps: { fr: ['Verser le café sur la glace.'] },
      description: { fr: 'Une boule de glace noyée de café.' },
    })
  })

  it('rend null quand la base n’a pas cette recette publiée', async () => {
    reponse.valeur = { data: null, error: null }

    expect(await getOfficialRecipeById('inexistante')).toBeNull()
  })

  // Une panne n'est pas une absence : l'appelant doit pouvoir dire
  // « momentanément indisponible » plutôt que « introuvable ».
  it('LÈVE sur une panne au lieu de rendre null', async () => {
    reponse.valeur = { data: null, error: { message: 'boom', code: '500' } }

    await expect(getOfficialRecipeById('affogato')).rejects.toMatchObject({ message: 'boom' })
  })

  it('sans id, ne lit rien', async () => {
    expect(await getOfficialRecipeById('')).toBeNull()
    expect(appels).toHaveLength(0)
  })

  // Rouvrir une fiche dans la session ne la relit pas.
  it('une fiche lue est gardée pour la session : la rouvrir ne la relit pas', async () => {
    reponse.valeur = { data: LIGNE, error: null }

    const premiere = await getOfficialRecipeById('affogato')
    const seconde = await getOfficialRecipeById('affogato')

    expect(lectures()).toBe(1)
    expect(seconde).toEqual(premiere)
  })

  it('une lecture en panne n’est pas gardée : la suivante relit', async () => {
    reponse.valeur = { data: null, error: { message: 'boom' } }
    await expect(getOfficialRecipeById('affogato')).rejects.toBeTruthy()

    reponse.valeur = { data: LIGNE, error: null }
    const resultat = await getOfficialRecipeById('affogato')

    expect(lectures()).toBe(2)
    expect(resultat.recipe.id).toBe('affogato')
  })

  it('une absence n’est pas gardée non plus (une recette peut être publiée entre-temps)', async () => {
    reponse.valeur = { data: null, error: null }
    await getOfficialRecipeById('affogato')
    reponse.valeur = { data: LIGNE, error: null }

    expect((await getOfficialRecipeById('affogato')).recipe.id).toBe('affogato')
    expect(lectures()).toBe(2)
  })
})
