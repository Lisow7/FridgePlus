// Tests pour le hook useSubstitutes et le helper fetchSubstitutes.
// Mock supabase.functions.invoke pour isoler la logique.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args) => invokeMock(...args) },
  },
}))

const { fetchSubstitutes } = await import('../../shared/api/substituts.js')

describe('fetchSubstitutes helper', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('appelle Edge Function suggest-substitutes avec le bon payload', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { substitutes: [{ label: 'Yaourt grec', reason: '...', ratio: '1:1' }] },
      error: null,
    })

    const result = await fetchSubstitutes({
      ingredient_label: 'Crème fraîche',
      recipe_context: 'Pâtes à la carbonara',
      lang: 'fr',
    })

    expect(invokeMock).toHaveBeenCalledWith('suggest-substitutes', {
      body: {
        ingredient_label: 'Crème fraîche',
        recipe_context: 'Pâtes à la carbonara',
        lang: 'fr',
      },
    })
    expect(result.substitutes).toHaveLength(1)
    expect(result.substitutes[0].label).toBe('Yaourt grec')
  })

  it('lang par défaut = "fr" si non spécifié', async () => {
    invokeMock.mockResolvedValueOnce({ data: { substitutes: [] }, error: null })
    await fetchSubstitutes({ ingredient_label: 'Test' })
    expect(invokeMock).toHaveBeenCalledWith('suggest-substitutes', {
      body: { ingredient_label: 'Test', recipe_context: undefined, lang: 'fr' },
    })
  })

  it('retourne 3 substituts typiques', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        substitutes: [
          { label: 'Yaourt grec', reason: 'Texture proche', ratio: '1:1' },
          { label: 'Mascarpone', reason: 'Riche en gras', ratio: '1:1' },
          { label: 'Tofu soyeux', reason: 'Vegan', ratio: '1 tasse = 250g' },
        ],
      },
      error: null,
    })
    const result = await fetchSubstitutes({ ingredient_label: 'Crème', lang: 'fr' })
    expect(result.substitutes).toHaveLength(3)
    expect(result.substitutes[2].ratio).toBe('1 tasse = 250g')
  })

  it('throw si Edge Function retourne erreur (ex: rate_limited)', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'rate_limited' } })
    await expect(fetchSubstitutes({ ingredient_label: 'Test' })).rejects.toMatchObject({ message: 'rate_limited' })
  })

  it('throw si lang invalide (validation côté Edge Function)', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'invalid_lang' } })
    await expect(fetchSubstitutes({ ingredient_label: 'Test', lang: 'xx' })).rejects.toMatchObject({ message: 'invalid_lang' })
  })
})
