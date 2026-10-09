import { describe, it, expect } from 'vitest'
import { buildPublishConsent } from '@features/recipes/lib/recipe-publish-consent'
import { LEGAL_CONSENT_VERSION } from '@shared/lib/legal-version'

describe('buildPublishConsent', () => {
  it('nouveau consentement donné → horodatage frais + version courante', () => {
    const r = buildPublishConsent(true, null)
    expect(r.published_consent_version).toBe(LEGAL_CONSENT_VERSION)
    expect(typeof r.published_consent_at).toBe('string')
    expect(Number.isNaN(Date.parse(r.published_consent_at))).toBe(false)
  })

  it('pas de nouveau consentement, recette neuve → NULL (jamais consenti)', () => {
    expect(buildPublishConsent(false, null)).toEqual({
      published_consent_at: null,
      published_consent_version: null,
    })
  })

  it('pas de nouveau consentement, recette déjà consentie → PRÉSERVE l\'existant', () => {
    const initial = {
      published_consent_at: '2026-05-01T09:00:00.000Z',
      published_consent_version: '2026-05',
    }
    expect(buildPublishConsent(false, initial)).toEqual(initial)
  })

  it('nouveau consentement écrase l\'ancien (re-publication = re-consentement)', () => {
    const initial = { published_consent_at: '2026-05-01T09:00:00.000Z', published_consent_version: '2026-05' }
    const r = buildPublishConsent(true, initial)
    expect(r.published_consent_version).toBe(LEGAL_CONSENT_VERSION)
    expect(r.published_consent_at).not.toBe(initial.published_consent_at)
  })
})
