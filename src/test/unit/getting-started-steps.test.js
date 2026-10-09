import { describe, it, expect } from 'vitest'
import { computeSteps, deriveCoachState } from '@features/onboarding/lib/getting-started-steps'

const S = (o) => ({ step1: false, step2: false, step3: false, total: 2, doneCount: 0, completed: false, ...o })

describe('deriveCoachState', () => {
  it('frigo vide → s1', () => {
    expect(deriveCoachState({ steps: S(), isGuest: true, hasReadyRecipe: false })).toBe('s1')
  })
  it('rempli + recette prête → s2a', () => {
    expect(deriveCoachState({ steps: S({ step1: true }), isGuest: true, hasReadyRecipe: true })).toBe('s2a')
  })
  it('rempli sans recette prête → s2b', () => {
    expect(deriveCoachState({ steps: S({ step1: true }), isGuest: true, hasReadyRecipe: false })).toBe('s2b')
  })
  it('connecté : étapes 1+2 faites, pas cuisiné → s3', () => {
    expect(deriveCoachState({ steps: S({ step1: true, step2: true, total: 3 }), isGuest: false, hasReadyRecipe: false })).toBe('s3')
  })
  it('invité complété → fin', () => {
    expect(deriveCoachState({ steps: S({ step1: true, step2: true, completed: true }), isGuest: true, hasReadyRecipe: false })).toBe('fin')
  })
  it('connecté complété → fin', () => {
    expect(deriveCoachState({ steps: S({ step1: true, step2: true, step3: true, total: 3, completed: true }), isGuest: false, hasReadyRecipe: true })).toBe('fin')
  })
})

describe('computeSteps', () => {
  it('INVITÉ : 2 étapes (stock + Aha), completed à 2/2, favori ignoré', () => {
    const s = computeSteps({ hasStock: true, suggestionOpened: true, hasCooked: false, isGuest: true })
    expect(s.total).toBe(2)
    expect(s.doneCount).toBe(2)
    expect(s.completed).toBe(true)
  })
  it('CONNECTÉ : 3 étapes, PAS completed à 2/3 (pas cuisiné)', () => {
    const s = computeSteps({ hasStock: true, suggestionOpened: true, hasCooked: false, isGuest: false })
    expect(s.total).toBe(3)
    expect(s.doneCount).toBe(2)
    expect(s.step3).toBe(false)
    expect(s.completed).toBe(false)
  })
  it('CONNECTÉ : completed à 3/3 (a cuisiné)', () => {
    const s = computeSteps({ hasStock: true, suggestionOpened: true, hasCooked: true, isGuest: false })
    expect(s.doneCount).toBe(3)
    expect(s.completed).toBe(true)
  })
  it('ignore hasFavorite même fourni (favori hors fil)', () => {
    const a = computeSteps({ hasStock: true, hasFavorite: true, suggestionOpened: false, hasCooked: false, isGuest: true })
    expect(a.doneCount).toBe(1) // seul stock compte ; hasFavorite n'a aucun effet
  })

  // Cas-limite : cuisiner peut vider le frigo → step1 (hasStock) retombe faux.
  // `completed` ne doit PAS en dépendre (sinon la carte ré-affiche S1 au lieu de se retirer).
  it('CONNECTÉ cas-limite : a cuisiné MAIS frigo vidé → completed reste true', () => {
    const s = computeSteps({ hasStock: false, suggestionOpened: true, hasCooked: true, isGuest: false })
    expect(s.step1).toBe(false)
    expect(s.completed).toBe(true) // step2 && step3, indépendant de step1
    expect(deriveCoachState({ steps: s, isGuest: false, hasReadyRecipe: false })).toBe('fin')
  })
  it('INVITÉ cas-limite : a découvert MAIS frigo vidé → completed reste true', () => {
    const s = computeSteps({ hasStock: false, suggestionOpened: true, hasCooked: false, isGuest: true })
    expect(s.completed).toBe(true)
    expect(deriveCoachState({ steps: s, isGuest: true, hasReadyRecipe: false })).toBe('fin')
  })
})
