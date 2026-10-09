import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn(() => ({ error: null }))
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: () => ({ insert: insertMock }) },
}))

import { saveCommunityRecipe } from '@shared/lib/recipes/recipes-repository'

describe('saveCommunityRecipe — colonnes consentement', () => {
  beforeEach(() => insertMock.mockClear())

  it('écrit published_consent_at/version en colonnes dédiées', async () => {
    await saveCommunityRecipe({
      id: 'custom-1', name: 'Test',
      moderation_status: 'pending', is_public: false,
      consent_to_promote: true,
      published_consent_at: '2026-06-13T10:00:00.000Z',
      published_consent_version: '2026-06',
    }, 'user-1')

    const payload = insertMock.mock.calls[0][0]
    expect(payload.published_consent_at).toBe('2026-06-13T10:00:00.000Z')
    expect(payload.published_consent_version).toBe('2026-06')
  })

  it('met NULL quand les champs sont absents (recette legacy/privée)', async () => {
    await saveCommunityRecipe({ id: 'custom-2', name: 'Privée' }, 'user-1')
    const payload = insertMock.mock.calls[0][0]
    expect(payload.published_consent_at).toBeNull()
    expect(payload.published_consent_version).toBeNull()
  })
})
