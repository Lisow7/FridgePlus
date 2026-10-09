import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mocks : on isole le flow de la vraie reco Web Speech + du store consent.
const startSpy = vi.fn()
vi.mock('@shared/hooks/use-voice-recognition', () => ({
  useVoiceRecognition: () => ({
    isListening: false, matchedIngredients: [], error: null,
    start: startSpy, stop: vi.fn(), clearAll: vi.fn(), restore: vi.fn(),
  }),
}))

let voiceConsented = false
const setVoiceConsentSpy = vi.fn((v) => { voiceConsented = v })
vi.mock('@shared/hooks/use-consent', () => ({
  hasConsentedSync: (cat) => (cat === 'voice' ? voiceConsented : true),
  useConsent: () => ({ setVoiceConsent: setVoiceConsentSpy }),
}))

import { useVoiceFlow } from '@app/hooks/use-voice-flow'

const baseDeps = () => ({
  lang: 'fr',
  modals: {
    voiceConfirm: { open: vi.fn(), close: vi.fn() },
    voiceModal: { open: vi.fn(), close: vi.fn() },
  },
  activeSubcat: null, setActiveSubcat: vi.fn(),
  showRecipes: false, setShowRecipes: vi.fn(),
  closeAllDoors: vi.fn(), addStockBatch: vi.fn(), removeStockBatch: vi.fn(),
})

describe('use-voice-flow — gate consentement', () => {
  beforeEach(() => { voiceConsented = false; startSpy.mockClear(); setVoiceConsentSpy.mockClear() })

  it('sans consentement : handleVoiceToggle ouvre le dialog, ne démarre PAS', () => {
    const { result } = renderHook(() => useVoiceFlow(baseDeps()))
    act(() => result.current.handleVoiceToggle())
    expect(result.current.voiceConsentOpen).toBe(true)
    expect(startSpy).not.toHaveBeenCalled()
  })

  it('accepter le dialog : enregistre le consentement + démarre l\'écoute', () => {
    const { result } = renderHook(() => useVoiceFlow(baseDeps()))
    act(() => result.current.handleVoiceToggle())
    act(() => result.current.handleVoiceConsentAccept())
    expect(setVoiceConsentSpy).toHaveBeenCalledWith(true)
    expect(startSpy).toHaveBeenCalled()
    expect(result.current.voiceConsentOpen).toBe(false)
  })

  it('refuser : ferme, ne démarre pas, ne consent pas', () => {
    const { result } = renderHook(() => useVoiceFlow(baseDeps()))
    act(() => result.current.handleVoiceToggle())
    act(() => result.current.handleVoiceConsentRefuse())
    expect(startSpy).not.toHaveBeenCalled()
    expect(setVoiceConsentSpy).not.toHaveBeenCalled()
    expect(result.current.voiceConsentOpen).toBe(false)
  })

  it('déjà consenti : démarre directement, pas de dialog', () => {
    voiceConsented = true
    const { result } = renderHook(() => useVoiceFlow(baseDeps()))
    act(() => result.current.handleVoiceToggle())
    expect(result.current.voiceConsentOpen).toBe(false)
    expect(startSpy).toHaveBeenCalled()
  })
})
