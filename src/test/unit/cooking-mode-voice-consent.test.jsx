import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Sous-hooks mockés : on isole le gate de consentement du vrai Web Speech /
// timers / wake lock.
vi.mock('@features/cooking-mode/hooks/use-voice-listener.js', () => ({
  useVoiceListener: () => {},
}))
vi.mock('@features/cooking-mode/hooks/use-speech-synthesis.js', () => ({
  useSpeechSynthesis: () => ({ speak: vi.fn(), cancel: vi.fn(), unlock: vi.fn(), speaking: false }),
}))
vi.mock('@features/cooking-mode/hooks/use-step-timer.js', () => ({
  useStepTimer: () => ({ state: 'idle', start: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), addTime: vi.fn(), secondsLeft: 0 }),
}))
vi.mock('@features/cooking-mode/hooks/use-wake-lock.js', () => ({ useWakeLock: () => {} }))

let voiceConsented = false
const setVoiceConsentSpy = vi.fn((v) => { voiceConsented = v })
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({ consent: { voice: voiceConsented }, setVoiceConsent: setVoiceConsentSpy }),
}))

import { useCookingMode } from '@features/cooking-mode/hooks/use-cooking-mode'

const recipe = { steps: ['Étape une', 'Étape deux'] }

describe('use-cooking-mode — gate consentement micro', () => {
  beforeEach(() => { voiceConsented = false; setVoiceConsentSpy.mockClear() })

  it('au repos : pas de prompt', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    expect(result.current.voiceConsentOpen).toBe(false)
  })

  it('démarrage de session sans consentement → ouvre le dialog', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    expect(result.current.voiceConsentOpen).toBe(true)
  })

  it('accepter → enregistre le consentement + ferme', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    act(() => result.current.onVoiceConsentAccept())
    expect(setVoiceConsentSpy).toHaveBeenCalledWith(true)
    expect(result.current.voiceConsentOpen).toBe(false)
  })

  it('refuser → coupe le micro, ferme, ne consent pas, ne rouvre pas', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    act(() => result.current.onVoiceConsentRefuse())
    expect(setVoiceConsentSpy).not.toHaveBeenCalled()
    expect(result.current.voiceConsentOpen).toBe(false)
    expect(result.current.micEnabled).toBe(false)
  })

  it('déjà consenti → pas de prompt au démarrage', () => {
    voiceConsented = true
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    expect(result.current.voiceConsentOpen).toBe(false)
  })
})
