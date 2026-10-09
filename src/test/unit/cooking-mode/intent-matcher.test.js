import { describe, it, expect } from 'vitest'
import { matchIntent } from '../../../features/cooking-mode/lib/intent-matcher'

describe('matchIntent — FR', () => {
  it('reconnaît un mot simple', () => {
    expect(matchIntent('suivant', 'fr')).toBe('next')
  })
  it('reconnaît phrase complète', () => {
    expect(matchIntent('étape suivante', 'fr')).toBe('next')
  })
  it('reconnaît avec mot en plus à la fin', () => {
    expect(matchIntent('suivant maintenant', 'fr')).toBe('next')
  })
  it('reconnaît avec mot en plus au début', () => {
    expect(matchIntent('ok suivant', 'fr')).toBe('next')
  })
  it('rejette match partiel au milieu', () => {
    expect(matchIntent('je suivante demain', 'fr')).toBe(null)
  })
  it('rejette mot non listé', () => {
    expect(matchIntent('quelque chose au hasard', 'fr')).toBe(null)
  })
  it('reconnaît jumpToStep avec numéro', () => {
    expect(matchIntent('étape 3', 'fr')).toEqual({ intent: 'jumpToStep', step: 3 })
  })
  it('reconnaît addTime', () => {
    expect(matchIntent('ajoute 5 minutes', 'fr')).toEqual({ intent: 'addTime', amount: 5, unit: 'minute' })
  })
  it('reconnaît customTimer', () => {
    expect(matchIntent('timer 10 minutes', 'fr')).toEqual({ intent: 'customTimer', amount: 10, unit: 'minute' })
  })
  it('normalise casse et espaces', () => {
    expect(matchIntent('  SUIVANT  ', 'fr')).toBe('next')
  })
})

describe('matchIntent — EN', () => {
  it('reconnaît next', () => {
    expect(matchIntent('next', 'en')).toBe('next')
  })
  it('reconnaît jumpToStep EN', () => {
    expect(matchIntent('step 5', 'en')).toEqual({ intent: 'jumpToStep', step: 5 })
  })
})

describe('matchIntent — mute / reset timer (commandes vocales nouvelles)', () => {
  it('FR : tais-toi → mute', () => {
    expect(matchIntent('tais-toi', 'fr')).toBe('mute')
  })
  it('FR : reparle → resumeSpeech (unmute)', () => {
    expect(matchIntent('reparle', 'fr')).toBe('resumeSpeech')
  })
  it('FR : réinitialise → resetTimer', () => {
    expect(matchIntent('réinitialise', 'fr')).toBe('resetTimer')
  })
  it('FR : réinitialise le timer → resetTimer', () => {
    expect(matchIntent('réinitialise le timer', 'fr')).toBe('resetTimer')
  })
  it('FR : remets le timer → resetTimer', () => {
    expect(matchIntent('remets le timer', 'fr')).toBe('resetTimer')
  })
  it('FR : « réinitialise le minuteur » collisionne avec startTimer (mot minuteur) — documenté', () => {
    expect(matchIntent('réinitialise le minuteur', 'fr')).toBe('startTimer')
  })
  it('EN : unmute → resumeSpeech', () => {
    expect(matchIntent('unmute', 'en')).toBe('resumeSpeech')
  })
  it('EN : reset / reset timer → resetTimer', () => {
    expect(matchIntent('reset', 'en')).toBe('resetTimer')
    expect(matchIntent('reset timer', 'en')).toBe('resetTimer')
  })
})

describe('matchIntent — recommence relit l\'étape (pas retour début)', () => {
  it('« recommence » → repeat (relit l\'étape courante)', () => {
    expect(matchIntent('recommence', 'fr')).toBe('repeat')
  })
  it('« recommencer » → repeat', () => {
    expect(matchIntent('recommencer', 'fr')).toBe('repeat')
  })
  it('« depuis le début » → firstStep (vrai retour au début)', () => {
    expect(matchIntent('depuis le début', 'fr')).toBe('firstStep')
  })
  it('« première étape » → firstStep', () => {
    expect(matchIntent('première étape', 'fr')).toBe('firstStep')
  })
  it('« recommence l\'étape une » → jumpToStep 1 (priorité au numéro)', () => {
    expect(matchIntent('recommence l\'étape une', 'fr')).toEqual({ intent: 'jumpToStep', step: 1 })
  })
  it('« recommence depuis l\'étape deux » → jumpToStep 2', () => {
    expect(matchIntent('recommence depuis l\'étape deux', 'fr')).toEqual({ intent: 'jumpToStep', step: 2 })
  })
})

describe('matchIntent — nombres en lettres', () => {
  it('« étape trois » → jumpToStep 3', () => {
    expect(matchIntent('étape trois', 'fr')).toEqual({ intent: 'jumpToStep', step: 3 })
  })
  it('« ajoute cinq minutes » → addTime 5 minute', () => {
    expect(matchIntent('ajoute cinq minutes', 'fr')).toEqual({ intent: 'addTime', amount: 5, unit: 'minute' })
  })
  it('« étape suivante » reste next (pas de faux jumpToStep)', () => {
    expect(matchIntent('étape suivante', 'fr')).toBe('next')
  })
  it('EN « restart from step two » → jumpToStep 2', () => {
    expect(matchIntent('restart from step two', 'en')).toEqual({ intent: 'jumpToStep', step: 2 })
  })
})

describe('matchIntent — Faux positifs anti-bruit', () => {
  it('ne matche pas une conversation banale', () => {
    expect(matchIntent('je vais passer le pain', 'fr')).toBe(null)
  })
  it('ne matche pas lance dans contexte aléatoire', () => {
    expect(matchIntent('je lance demain', 'fr')).toBe(null)
  })
})
