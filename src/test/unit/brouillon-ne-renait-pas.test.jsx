import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Une recette enregistrée ne doit pas laisser son brouillon derrière elle.
//
// Le formulaire enregistre son brouillon 500 ms après la dernière frappe. Si ce
// minuteur partait entre « enregistrée → brouillon purgé » et la fermeture de
// la fenêtre, il RÉÉCRIVAIT le brouillon d'une recette déjà enregistrée : à la
// prochaine ouverture, « Brouillon restauré » la reproposait — de quoi
// l'enregistrer deux fois. Vu par la fumée de la PR #1302 (2026-10-08) :
// `recette-refusee.spec.js`, brouillon encore là après 5 s, passé au second
// essai.

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
  useFridgeLayouts: () => ({}),
  useCountries: () => ({}),
  useDietTypes: () => ({}),
  useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(),
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@shared/api/moderation-de-contenu', () => ({ moderateContent: vi.fn(() => Promise.resolve({ flagged: false })) }))
vi.mock('@features/recipes/hooks/use-similar-recipes', () => ({ useSimilarRecipes: () => [] }))

import useRecipeFormModal from '@features/recipes/hooks/use-recipe-form-modal'
import { DRAFT_KEY } from '@features/recipes/lib/recipe-draft'

const BROUILLON = {
  name: 'Gratin du dimanche', emoji: '🥘', country: 'fr', time: '45', difficulty: 'Facile',
  type: 'Plat principal', servings: 4, diet: [], allergens: [],
  ingredients: [{ _key: 'ing-1', ingredientId: 'fr-beurre-doux', labels: { fr: 'Beurre doux' }, qty: { amount: 40, unit: 'g' }, required: true }],
  steps: [{ id: 's-1', text: 'Beurrer le plat, puis enfourner 40 minutes.' }],
}

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), payload: BROUILLON }))
})
afterEach(() => {
  vi.useRealTimers()
  window.localStorage.removeItem(DRAFT_KEY)
})

describe('le brouillon d’une recette enregistrée ne renaît pas', () => {
  it('le minuteur d’enregistrement automatique part APRÈS la purge : il ne réécrit rien', async () => {
    const onSave = vi.fn().mockResolvedValue({ error: null })
    const onClose = vi.fn()
    const { result } = renderHook(() => useRecipeFormModal({ initialRecipe: null, onSave, onClose, lang: 'fr' }))
    expect(result.current.draftBanner).not.toBeNull() // le brouillon est bien restauré

    // Le minuteur d'enregistrement automatique est en attente (500 ms après le
    // montage) quand l'enregistrement réussit…
    await act(async () => { await result.current.handleSubmit() })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()

    // … puis il part, la fenêtre n'étant pas encore démontée.
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('refusée : le brouillon reste, et continue de s’enregistrer (témoin)', async () => {
    const onSave = vi.fn().mockResolvedValue({ error: { message: 'réseau' } })
    const { result } = renderHook(() => useRecipeFormModal({ initialRecipe: null, onSave, onClose: vi.fn(), lang: 'fr' }))
    await act(async () => { await result.current.handleSubmit() })
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull()
  })
})
