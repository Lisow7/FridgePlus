import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({
    'fr-tomate':  [{ id: 'fr-tomate',  labels: { fr: 'Tomate',  en: 'Tomato',   es: 'Tomate',    de: 'Tomate',  ja: 'トマト'  }, emoji: '🍅' }],
    'fr-carotte': [{ id: 'fr-carotte', labels: { fr: 'Carotte', en: 'Carrot',   es: 'Zanahoria', de: 'Karotte', ja: 'ニンジン' }, emoji: '🥕' }],
    'fr-oignon':  [{ id: 'fr-oignon',  labels: { fr: 'Oignon',  en: 'Onion',    es: 'Cebolla',   de: 'Zwiebel', ja: '玉ねぎ'  }, emoji: '🧅' }],
  }),
}))

// SpeechRecognition en tant que classe (Vitest exige function/class pour new)
class SpeechRecognitionMock {
  constructor() {
    this.lang           = ''
    this.continuous     = false
    this.interimResults = false
    this.maxAlternatives = 1
    this.onresult  = null
    this.onerror   = null
    this.onend     = null
    this.onstart   = null
    this.start  = vi.fn()
    this.stop   = vi.fn()
    this.abort  = vi.fn()
  }
}

import { useVoiceRecognition } from '@shared/hooks/use-voice-recognition'

describe('useVoiceRecognition', () => {
  beforeEach(() => {
    global.SpeechRecognition       = SpeechRecognitionMock
    global.webkitSpeechRecognition = SpeechRecognitionMock
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })

  afterEach(() => {
    delete global.SpeechRecognition
    delete global.webkitSpeechRecognition
    vi.restoreAllMocks()
  })

  it('isSupported = true si SpeechRecognition est disponible', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    expect(result.current.isSupported).toBe(true)
  })

  it('isSupported = false si SpeechRecognition absent', () => {
    delete global.SpeechRecognition
    delete global.webkitSpeechRecognition
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    expect(result.current.isSupported).toBe(false)
  })

  it('isListening = false par défaut', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    expect(result.current.isListening).toBe(false)
  })

  it('matchedIngredients = [] par défaut', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    expect(result.current.matchedIngredients).toEqual([])
  })

  it('transcript = "" par défaut', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    expect(result.current.transcript).toBe('')
  })

  it('error = null par défaut', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    expect(result.current.error).toBeNull()
  })

  it('error = offline si navigator.onLine = false', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    act(() => { result.current.start() })
    expect(result.current.error).toBe('offline')
  })

  it('start() met isListening = true', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    act(() => { result.current.start() })
    expect(result.current.isListening).toBe(true)
  })

  it('stop() met isListening = false', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    act(() => { result.current.start() })
    act(() => { result.current.stop(false) })
    expect(result.current.isListening).toBe(false)
  })

  it('clearAll() vide matchedIngredients', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    act(() => { result.current.clearAll() })
    expect(result.current.matchedIngredients).toEqual([])
  })

  it('restore() restaure les ingrédients passés', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    const fakeIngredients = [{ id: 'fr-tomate', labels: { fr: 'Tomate' }, confidence: 0.9 }]
    act(() => { result.current.restore(fakeIngredients) })
    expect(result.current.matchedIngredients).toEqual(fakeIngredients)
  })

  it('locale fr-FR pour le français', () => {
    const instances = []
    const TrackingMock = class extends SpeechRecognitionMock {
      constructor() { super(); instances.push(this) }
    }
    global.SpeechRecognition = TrackingMock
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    act(() => { result.current.start() })
    expect(instances[0]?.lang).toBe('fr-FR')
  })

  it('locale en-US pour l\'anglais', () => {
    const instances = []
    const TrackingMock = class extends SpeechRecognitionMock {
      constructor() { super(); instances.push(this) }
    }
    global.SpeechRecognition = TrackingMock
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'en' }))
    act(() => { result.current.start() })
    expect(instances[0]?.lang).toBe('en-US')
  })

  it('jaLoading = false pour une langue non-japonaise', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    expect(result.current.jaLoading).toBe(false)
  })

  it('isListening reste false si hors ligne', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    act(() => { result.current.start() })
    // L'erreur offline est levée avant que isListening ne soit mis à true
    expect(result.current.isListening).toBe(false)
    expect(result.current.error).toBe('offline')
  })
})
