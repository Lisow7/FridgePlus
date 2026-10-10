import { describe, it, expect, beforeEach } from 'vitest'
import {
  DRAFT_KEY, DRAFT_VERSION, DRAFT_TTL_MS,
  loadDraft, saveDraft, clearDraft, isEmptyFormState, formatRelativeAge,
} from '@features/recipes/lib/recipe-draft'

// jsdom = window.localStorage natif. On reset entre chaque test.

const VALID_PAYLOAD = {
  name: 'Mon gratin',
  emoji: '🧀',
  country: 'fr',
  time: '40',
  difficulty: 'Facile',
  type: 'Plat principal',
  servings: 4,
  diet: ['vegetarian'],
  allergens: ['milk'],
  ingredients: [{ _key: 'k1', ingredientId: 'fr-fromage', labels: {}, qty: { amount: 200, unit: 'g' }, required: true }],
  steps: [{ id: 's1', text: 'Préchauffer le four' }],
}

const EMPTY_FORM = {
  name: '', emoji: '', country: '', time: '', difficulty: '', type: '',
  servings: 4, diet: ['vegetarian'], allergens: [], ingredients: [], steps: [],
}

describe('recipe-draft', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('isEmptyFormState', () => {
    it('détecte un form initial comme vide', () => {
      expect(isEmptyFormState(EMPTY_FORM)).toBe(true)
    })
    it('considère vide un form null/undefined', () => {
      expect(isEmptyFormState(null)).toBe(true)
      expect(isEmptyFormState(undefined)).toBe(true)
    })
    it('détecte un form rempli comme non vide', () => {
      expect(isEmptyFormState(VALID_PAYLOAD)).toBe(false)
    })
    it('détecte un form avec uniquement un nom comme non vide', () => {
      expect(isEmptyFormState({ ...EMPTY_FORM, name: 'X' })).toBe(false)
    })
    it('détecte un form avec uniquement un ingrédient comme non vide', () => {
      expect(isEmptyFormState({ ...EMPTY_FORM, ingredients: [{}] })).toBe(false)
    })
  })

  describe('saveDraft → loadDraft', () => {
    it('saveDraft skip silencieusement un form vide', () => {
      saveDraft(EMPTY_FORM)
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    })

    it('saveDraft puis loadDraft retourne le payload identique + savedAt', () => {
      const now = 1717948800000
      saveDraft(VALID_PAYLOAD, now)
      const draft = loadDraft(now)
      expect(draft).not.toBeNull()
      expect(draft.savedAt).toBe(now)
      expect(draft.payload).toEqual(VALID_PAYLOAD)
    })

    it('loadDraft retourne null si rien stocké', () => {
      expect(loadDraft()).toBeNull()
    })

    it('loadDraft purge et retourne null en cas de JSON corrompu', () => {
      window.localStorage.setItem(DRAFT_KEY, '{not json')
      expect(loadDraft()).toBeNull()
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    })

    it('loadDraft purge et retourne null si version mismatch', () => {
      const wrapper = { version: DRAFT_VERSION + 1, savedAt: Date.now(), payload: VALID_PAYLOAD }
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(wrapper))
      expect(loadDraft()).toBeNull()
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    })

    it('loadDraft purge et retourne null si savedAt absent ou invalide', () => {
      const wrapper = { version: DRAFT_VERSION, savedAt: 'oops', payload: VALID_PAYLOAD }
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(wrapper))
      expect(loadDraft()).toBeNull()
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    })

    it('loadDraft purge et retourne null après expiration (> 7 jours)', () => {
      const savedAt = 1000
      const now = savedAt + DRAFT_TTL_MS + 1
      saveDraft(VALID_PAYLOAD, savedAt)
      expect(loadDraft(now)).toBeNull()
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    })

    it('loadDraft retourne le draft juste avant expiration', () => {
      const savedAt = 1000
      const now = savedAt + DRAFT_TTL_MS - 1
      saveDraft(VALID_PAYLOAD, savedAt)
      expect(loadDraft(now)).not.toBeNull()
    })
  })

  describe('clearDraft', () => {
    it('supprime un draft existant', () => {
      saveDraft(VALID_PAYLOAD)
      expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull()
      clearDraft()
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    })
    it('no-op s’il n’y a rien', () => {
      expect(() => clearDraft()).not.toThrow()
    })
  })

  describe('formatRelativeAge', () => {
    const now = 1717948800000
    it('renvoie « à l’instant » / « just now » sous 60 s', () => {
      expect(formatRelativeAge(now - 30_000, 'fr', now)).toBe('à l’instant')
      expect(formatRelativeAge(now - 30_000, 'en', now)).toBe('just now')
    })
    it('renvoie en minutes entre 1 et 59 min', () => {
      expect(formatRelativeAge(now - 5 * 60_000, 'fr', now)).toBe('il y a 5 min')
      expect(formatRelativeAge(now - 5 * 60_000, 'en', now)).toBe('5 min ago')
    })
    it('renvoie en heures entre 1 h et 23 h', () => {
      expect(formatRelativeAge(now - 3 * 60 * 60_000, 'fr', now)).toBe('il y a 3 h')
      expect(formatRelativeAge(now - 3 * 60 * 60_000, 'en', now)).toBe('3 h ago')
    })
    it('renvoie en jours au-delà de 24 h', () => {
      expect(formatRelativeAge(now - 2 * 24 * 60 * 60_000, 'fr', now)).toBe('il y a 2 j')
      expect(formatRelativeAge(now - 2 * 24 * 60 * 60_000, 'en', now)).toBe('2 d ago')
    })
    it('renvoie une chaîne vide si savedAt invalide', () => {
      expect(formatRelativeAge(null, 'fr')).toBe('')
      expect(formatRelativeAge('oops', 'fr')).toBe('')
      expect(formatRelativeAge(undefined, 'fr')).toBe('')
    })
    it('défaut FR si lang n’est pas \'en\'', () => {
      expect(formatRelativeAge(now - 30_000, 'es', now)).toBe('à l’instant')
      expect(formatRelativeAge(now - 30_000, undefined, now)).toBe('à l’instant')
    })
  })
})
