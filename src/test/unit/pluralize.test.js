import { describe, it, expect } from 'vitest'
import { pluralize, suffixS } from '@shared/lib/i18n/pluralize'

describe('pluralize (v3.231.0)', () => {
  const forms = { one: 'item', other: 'items' }

  describe('FR — singulier pour 0 et 1', () => {
    it('count=0 → singulier', () => expect(pluralize(0, 'fr', forms)).toBe('item'))
    it('count=1 → singulier', () => expect(pluralize(1, 'fr', forms)).toBe('item'))
    it('count=2 → pluriel',   () => expect(pluralize(2, 'fr', forms)).toBe('items'))
    it('count=10 → pluriel',  () => expect(pluralize(10, 'fr', forms)).toBe('items'))
  })

  describe('EN / ES / DE — singulier UNIQUEMENT pour 1', () => {
    it('EN count=0 → pluriel', () => expect(pluralize(0, 'en', forms)).toBe('items'))
    it('EN count=1 → singulier', () => expect(pluralize(1, 'en', forms)).toBe('item'))
    it('EN count=2 → pluriel', () => expect(pluralize(2, 'en', forms)).toBe('items'))
    it('ES count=0 → pluriel', () => expect(pluralize(0, 'es', forms)).toBe('items'))
    it('DE count=0 → pluriel', () => expect(pluralize(0, 'de', forms)).toBe('items'))
  })

  describe('JA — pas de pluriel morphologique', () => {
    it('count=0 → singulier (caller passe la même forme)', () => expect(pluralize(0, 'ja', forms)).toBe('item'))
    it('count=10 → pluriel (au cas où caller distingue)', () => expect(pluralize(10, 'ja', forms)).toBe('items'))
  })

  describe('robustesse', () => {
    it('forms manquant → string vide', () => expect(pluralize(1, 'fr')).toBe(''))
    it('forms.other manquant → fallback sur one', () => {
      expect(pluralize(2, 'en', { one: 'item' })).toBe('item')
    })
    it('forms.one manquant → string vide pour singulier', () => {
      expect(pluralize(1, 'en', { other: 'items' })).toBe('')
    })
  })
})

describe('suffixS (v3.231.0)', () => {
  it('FR count=0 → "" (singulier)', () => expect(suffixS(0, 'fr')).toBe(''))
  it('FR count=1 → "" (singulier)', () => expect(suffixS(1, 'fr')).toBe(''))
  it('FR count=2 → "s"', () => expect(suffixS(2, 'fr')).toBe('s'))
  it('EN count=0 → "s" (pluriel)', () => expect(suffixS(0, 'en')).toBe('s'))
  it('EN count=1 → ""', () => expect(suffixS(1, 'en')).toBe(''))
  it('EN count=2 → "s"', () => expect(suffixS(2, 'en')).toBe('s'))
  it('ES count=0 → "s" (pluriel)', () => expect(suffixS(0, 'es')).toBe('s'))
  it('DE count=0 → "s" (pluriel)', () => expect(suffixS(0, 'de')).toBe('s'))
})
