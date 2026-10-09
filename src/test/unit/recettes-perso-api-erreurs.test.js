import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))

import * as api from '@features/recipes/api/recipes'

const { saveCustomRecipe, loadCustomRecipes, markAdminModifiedRead } = api

// Trouvé en corrigeant le lot 7 de l'audit du 2026-10-04 (hors audit). Une
// recette tapée en entier — nom, ingrédients, étapes — puis refusée par la base
// à l'enregistrement : `saveCustomRecipe` ne rendait RIEN, le formulaire se
// fermait, le brouillon était purgé. Et la lecture des recettes d'un compte
// rendait une liste vide sur erreur : « Mes recettes » se vidait à l'écran.
const RECETTE = {
  id: 'custom-123', name: 'Mon plat', emoji: '🍳', time: '10 min', difficulty: 'Facile',
  type: 'Plat principal', servings: 2, ingredients: [], moderation_status: 'private', is_public: false,
}
const PANNE = { message: 'Failed to fetch' }

// Une « base » où l'on décide ce que répond l'insertion d'une recette, et qui
// note ce qui part vers le journal d'activité.
function base({ insertion, journal = vi.fn(() => Promise.resolve({ error: null })) }) {
  mockFrom.mockImplementation((table) => {
    if (table === 'custom_recipes') return { insert: insertion }
    if (table === 'activity_logs') return { insert: journal }
    return {}
  })
  return { journal }
}

describe('saveCustomRecipe — dit si la recette est enregistrée', () => {
  beforeEach(() => { mockFrom.mockReset(); localStorage.clear() })

  it('invité, enregistrée sur l’appareil : aucune erreur', async () => {
    expect(await saveCustomRecipe(RECETTE, null)).toEqual({ error: null })
    expect(JSON.parse(localStorage.getItem('fridge-custom-recipes'))).toHaveLength(1)
  })

  it('invité, l’appareil refuse d’écrire (stockage plein) : l’erreur est rendue', async () => {
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    let resultat
    try { resultat = await saveCustomRecipe(RECETTE, null) } finally { ecrire.mockRestore() }
    expect(resultat.error).toBeTruthy()
  })

  it('compte, la base accepte : aucune erreur', async () => {
    base({ insertion: vi.fn(() => Promise.resolve({ error: null })) })
    expect(await saveCustomRecipe(RECETTE, 'u-1')).toEqual({ error: null })
  })

  it('compte, la base refuse : l’erreur est rendue', async () => {
    base({ insertion: vi.fn(() => Promise.resolve({ error: PANNE })) })
    expect(await saveCustomRecipe(RECETTE, 'u-1')).toEqual({ error: PANNE })
  })

  it('une recette validée par la modération (verrouillée) : rendue comme une erreur reconnaissable, sans exception', async () => {
    base({ insertion: vi.fn(() => Promise.resolve({ error: { code: '42501', message: 'permission denied' } })) })
    const resultat = await saveCustomRecipe(RECETTE, 'u-1')
    expect(resultat.error?.code).toBe('approved_recipe_locked')
  })

  it('un appel qui lève (réseau coupé) : l’erreur est rendue, sans exception', async () => {
    base({ insertion: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) })
    const resultat = await saveCustomRecipe(RECETTE, 'u-1')
    expect(resultat.error).toBeTruthy()
  })

  it('une recette proposée à la communauté et refusée par la base n’est PAS notée « soumise » au journal', async () => {
    const { journal } = base({ insertion: vi.fn(() => Promise.resolve({ error: PANNE })) })
    await saveCustomRecipe({ ...RECETTE, moderation_status: 'pending' }, 'u-1')
    expect(journal).not.toHaveBeenCalled()
  })

  it('…et acceptée, elle l’est (témoin)', async () => {
    const { journal } = base({ insertion: vi.fn(() => Promise.resolve({ error: null })) })
    await saveCustomRecipe({ ...RECETTE, moderation_status: 'pending' }, 'u-1')
    expect(journal).toHaveBeenCalledWith(expect.objectContaining({ action: 'recipe_submitted', target_id: 'custom-123' }))
  })
})

describe('loadCustomRecipes — « pas chargé » n’est pas « aucune recette »', () => {
  beforeEach(() => { mockFrom.mockReset(); localStorage.clear() })

  const lecture = (reponse) => {
    const requete = { select: () => requete, eq: () => requete, is: () => requete, order: () => Promise.resolve(reponse) }
    mockFrom.mockReturnValue(requete)
  }

  it('compte, lecture acceptée : les recettes, mises en forme, sans erreur', async () => {
    lecture({ data: [{ id: 'r-1', data: { name: 'Test' }, moderation_status: 'private', is_public: false, admin_modified: true }], error: null })
    const { recipes, error } = await loadCustomRecipes('u-1')
    expect(error).toBeNull()
    expect(recipes).toEqual([expect.objectContaining({ id: 'r-1', name: 'Test', moderation_status: 'private', admin_modified: true })])
  })

  it('compte, lecture refusée : l’erreur est rendue', async () => {
    lecture({ data: null, error: PANNE })
    expect(await loadCustomRecipes('u-1')).toEqual({ recipes: [], error: PANNE })
  })

  it('compte sans recette : une liste vide, SANS erreur', async () => {
    lecture({ data: [], error: null })
    expect(await loadCustomRecipes('u-1')).toEqual({ recipes: [], error: null })
  })

  it('invité : les recettes de l’appareil', async () => {
    localStorage.setItem('fridge-custom-recipes', JSON.stringify([RECETTE]))
    expect(await loadCustomRecipes(null)).toEqual({ recipes: [RECETTE], error: null })
  })

  // `getCustomRecipes` rendait une liste vide sur erreur. Si elle revenait, un
  // écran pourrait de nouveau vider « Mes recettes » sur un chargement raté.
  it('l’ancienne lecture `getCustomRecipes`, qui rendait du vide sur erreur, a disparu', () => {
    expect(Object.keys(api)).not.toContain('getCustomRecipes')
  })
})

describe('markAdminModifiedRead — dit si c’est noté', () => {
  beforeEach(() => { mockFrom.mockReset() })

  const ecriture = (reponse) => {
    const requete = { update: () => requete, eq: vi.fn(() => requete), then: (resolu, rejete) => Promise.resolve(reponse).then(resolu, rejete) }
    mockFrom.mockReturnValue(requete)
  }

  it('acceptée : aucune erreur', async () => {
    ecriture({ error: null })
    expect(await markAdminModifiedRead('r-1', 'u-1')).toEqual({ error: null })
  })

  it('refusée : l’erreur est rendue', async () => {
    ecriture({ error: PANNE })
    expect(await markAdminModifiedRead('r-1', 'u-1')).toEqual({ error: PANNE })
  })
})
