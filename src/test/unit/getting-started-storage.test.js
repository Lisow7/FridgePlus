import { describe, it, expect, beforeEach } from 'vitest'
import {
  hasOpenedSuggestion, markSuggestionOpened,
  isDismissed, markDismissed,
  isCompleted, markCompleted,
  reopenGuide, subscribeGettingStarted,
} from '@features/onboarding/lib/getting-started-storage'

describe('getting-started-storage (par-uid)', () => {
  beforeEach(() => localStorage.clear())

  it('défaut = false partout', () => {
    expect(hasOpenedSuggestion('u1')).toBe(false)
    expect(isDismissed('u1')).toBe(false)
    expect(isCompleted('u1')).toBe(false)
  })

  it('marque et lit par utilisateur, sans fuite entre uids', () => {
    markSuggestionOpened('u1'); markDismissed('u1'); markCompleted('u1')
    expect(hasOpenedSuggestion('u1')).toBe(true)
    expect(isDismissed('u1')).toBe(true)
    expect(isCompleted('u1')).toBe(true)
    // u2 isolé
    expect(hasOpenedSuggestion('u2')).toBe(false)
    expect(isDismissed('u2')).toBe(false)
    expect(isCompleted('u2')).toBe(false)
  })
})

describe('completion versioning (completed_v3)', () => {
  beforeEach(() => localStorage.clear())
  it('un ancien completed_v2 ne compte PAS comme complété', () => {
    localStorage.setItem('fridge-getting-started-v1:u1', JSON.stringify({ completed_v2: true }))
    expect(isCompleted('u1')).toBe(false)
  })
  it('markCompleted écrit completed_v3 et isCompleted le lit', () => {
    markCompleted('u1')
    expect(isCompleted('u1')).toBe(true)
    expect(JSON.parse(localStorage.getItem('fridge-getting-started-v1:u1')).completed_v3).toBe(true)
  })
})

describe('reopenGuide + pub/sub (rouverture depuis le footer)', () => {
  beforeEach(() => localStorage.clear())

  it('reopenGuide efface dismissed ET completed', () => {
    markDismissed('u1'); markCompleted('u1')
    reopenGuide('u1')
    expect(isDismissed('u1')).toBe(false)
    expect(isCompleted('u1')).toBe(false)
  })

  it('reopenGuide notifie les abonnés ; unsubscribe stoppe', () => {
    let n = 0
    const unsub = subscribeGettingStarted(() => { n++ })
    reopenGuide('u1')
    expect(n).toBe(1)
    unsub()
    reopenGuide('u1')
    expect(n).toBe(1) // plus de notification après désabonnement
  })

  it('les mutations internes (markDismissed/markCompleted) ne notifient PAS (anti-boucle)', () => {
    let n = 0
    subscribeGettingStarted(() => { n++ })
    markDismissed('u1'); markCompleted('u1')
    expect(n).toBe(0)
  })
})
