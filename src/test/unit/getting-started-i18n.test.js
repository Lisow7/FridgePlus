import { describe, it, expect } from 'vitest'
import { GETTING_STARTED_I18N } from '@features/onboarding/i18n/getting-started-i18n'

const LANGS = ['fr', 'en', 'es', 'de', 'ja']

describe('GETTING_STARTED_I18N (coach)', () => {
  it('a les 5 langues', () => {
    LANGS.forEach((l) => expect(GETTING_STARTED_I18N[l]).toBeTruthy())
  })
  it('chaque langue a EXACTEMENT les mêmes clés que fr', () => {
    const ref = Object.keys(GETTING_STARTED_I18N.fr).sort()
    LANGS.forEach((l) => expect(Object.keys(GETTING_STARTED_I18N[l]).sort()).toEqual(ref))
  })
  it('chaque langue a tous les états et clés non vides', () => {
    LANGS.forEach((l) => {
      const t = GETTING_STARTED_I18N[l]
      expect(t.title && t.dismiss).toBeTruthy()
      expect(t.s1.title && t.s1.text && t.s1.addAll).toBeTruthy()
      expect(t.s2b.title && t.s2b.cta).toBeTruthy()
      expect(t.s3.title && t.s3.cta).toBeTruthy()
      expect(t.finGuest.title && t.finGuest.cta).toBeTruthy()
      expect(t.finCook.title && t.finCook.cta).toBeTruthy()
      expect(typeof t.s2a.text).toBe('function')
      expect(t.s2a.text('Carbonara')).toContain('Carbonara')
    })
  })
})
