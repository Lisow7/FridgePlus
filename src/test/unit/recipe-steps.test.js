import { describe, it, expect } from 'vitest'
import { stepLangs, stepCount, addStep, removeStep, moveStep, setStepText } from '@shared/lib/recipes/recipe-steps'

// steps = objet multilingue d'arrays parallèles : { fr:[...], en:[...], ... }
const sample = () => ({
  fr: ['Émincer', 'Cuire', 'Servir'],
  en: ['Chop', 'Cook', 'Serve'],
})

describe('recipe-steps — helpers multilingues (lockstep + préservation)', () => {
  it('stepLangs : langues présentes', () => {
    expect(stepLangs(sample())).toEqual(['fr', 'en'])
    expect(stepLangs(null)).toEqual([])
  })

  it('stepCount : nombre d’étapes', () => {
    expect(stepCount(sample())).toBe(3)
    expect(stepCount({})).toBe(0)
  })

  it('addStep : ajoute une étape vide dans TOUTES les langues présentes', () => {
    const r = addStep(sample())
    expect(r.fr).toEqual(['Émincer', 'Cuire', 'Servir', ''])
    expect(r.en).toEqual(['Chop', 'Cook', 'Serve', ''])
  })

  it('addStep : objet vide → crée la langue par défaut (fr)', () => {
    expect(addStep({})).toEqual({ fr: [''] })
    expect(addStep({}, ['fr', 'en'])).toEqual({ fr: [''], en: [''] })
  })

  it('removeStep : retire le même index dans toutes les langues (lockstep)', () => {
    const r = removeStep(sample(), 1)
    expect(r.fr).toEqual(['Émincer', 'Servir'])
    expect(r.en).toEqual(['Chop', 'Serve'])
  })

  it('moveStep : réordonne en lockstep sur toutes les langues', () => {
    const r = moveStep(sample(), 0, 2) // 1ère → dernière
    expect(r.fr).toEqual(['Cuire', 'Servir', 'Émincer'])
    expect(r.en).toEqual(['Cook', 'Serve', 'Chop'])
  })

  it('setStepText : ne modifie QUE la langue ciblée', () => {
    const r = setStepText(sample(), 'fr', 0, 'Hacher')
    expect(r.fr).toEqual(['Hacher', 'Cuire', 'Servir'])
    expect(r.en).toEqual(['Chop', 'Cook', 'Serve']) // intact
  })

  it('immutabilité : l’objet source n’est jamais muté', () => {
    const src = sample()
    const snapshot = JSON.parse(JSON.stringify(src))
    addStep(src); removeStep(src, 0); moveStep(src, 0, 1); setStepText(src, 'fr', 0, 'X')
    expect(src).toEqual(snapshot)
  })
})
