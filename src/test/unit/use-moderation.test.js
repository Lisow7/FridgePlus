// Tests des appels à la modération : moderateContent et submitPhotoPost.
// Mock supabase.functions.invoke pour isoler la logique.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args) => invokeMock(...args) },
  },
}))

const { moderateContent } = await import('../../shared/hooks/use-moderation.js')

describe('moderateContent helper', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('appelle Edge Function moderate-content avec le bon payload', async () => {
    invokeMock.mockResolvedValueOnce({ data: { flagged: false, categories: {}, category_scores: {} }, error: null })

    const result = await moderateContent('Recette délicieuse', 'recipe')

    expect(invokeMock).toHaveBeenCalledWith('moderate-content', {
      body: { content: 'Recette délicieuse', feature: 'recipe' },
    })
    expect(result.flagged).toBe(false)
  })

  it('retourne flagged=true quand le contenu est inapproprié', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        flagged: true,
        categories: { hate: true },
        category_scores: { hate: 0.95 },
      },
      error: null,
    })

    const result = await moderateContent('contenu inapproprié', 'profile-bio')
    expect(result.flagged).toBe(true)
    expect(result.categories.hate).toBe(true)
  })

  it('throw si Edge Function retourne une erreur', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'rate_limited' } })
    await expect(moderateContent('test', 'review')).rejects.toMatchObject({ message: 'rate_limited' })
  })

  // `ticket` n'est plus une fonctionnalité : une demande au support ne passe
  // plus par OpenAI (RGPD-02, cf. demandes-hors-openai.test.js).
  it('transmet le texte et la fonctionnalité tels quels', async () => {
    invokeMock.mockResolvedValueOnce({ data: { flagged: false, categories: {}, category_scores: {} }, error: null })
    await moderateContent('Un avis sur la recette', 'review')
    expect(invokeMock).toHaveBeenCalledWith('moderate-content', {
      body: { content: 'Un avis sur la recette', feature: 'review' },
    })
  })
})

describe('submitPhotoPost helper', () => {
  beforeEach(() => { invokeMock.mockReset() })

  it('envoie content + feature + image_base64 + recipe_id + title', async () => {
    invokeMock.mockResolvedValueOnce({ data: { flagged: false, post: { id: 'p1' } }, error: null })
    const { submitPhotoPost } = await import('../../shared/hooks/use-moderation.js')
    const result = await submitPhotoPost({ content: 'Super plat', imageBase64: 'abc123', recipeId: 'r1', title: 'J\'ai testé cette recette !' })
    expect(invokeMock).toHaveBeenCalledWith('moderate-content', {
      body: { content: 'Super plat', feature: 'community-post', image_base64: 'abc123', recipe_id: 'r1', title: 'J\'ai testé cette recette !' },
    })
    expect(result.post.id).toBe('p1')
  })

  it('throw si Edge Function retourne une erreur', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'image_too_large' } })
    const { submitPhotoPost } = await import('../../shared/hooks/use-moderation.js')
    await expect(submitPhotoPost({ content: '', imageBase64: 'abc', recipeId: 'r1', title: 't' })).rejects.toMatchObject({ message: 'image_too_large' })
  })
})
