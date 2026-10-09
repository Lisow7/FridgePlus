// src/test/unit/cooking-mode/use-cooking-mode.test.js
//
// Test d'intégration de l'orchestrateur : vérifie que chaque intent vocal
// route vers la bonne action (dispatch reducer + appels timer/synth).
// Les 4 sous-hooks sont mockés ; onIntent est capturé pour le piloter.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let capturedOnIntent = null
const mockTimer = {
  state: 'idle',
  secondsLeft: 0,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  addTime: vi.fn(),
}
const mockSynth = { supported: true, speaking: false, speak: vi.fn(), cancel: vi.fn(), unlock: vi.fn() }

vi.mock('../../../features/cooking-mode/hooks/use-voice-listener', () => ({
  useVoiceListener: ({ onIntent }) => { capturedOnIntent = onIntent },
}))
vi.mock('../../../features/cooking-mode/hooks/use-speech-synthesis', () => ({
  useSpeechSynthesis: () => mockSynth,
}))
vi.mock('../../../features/cooking-mode/hooks/use-step-timer', () => ({
  useStepTimer: () => mockTimer,
}))
vi.mock('../../../features/cooking-mode/hooks/use-wake-lock', () => ({
  useWakeLock: () => ({ supported: true, active: true }),
}))

import { useCookingMode } from '../../../features/cooking-mode/hooks/use-cooking-mode'

// step 0 contient une durée parsable (5 minutes = 300s)
const recipe = { steps: ['Faire revenir 5 minutes', 'Mélanger les œufs', 'Servir chaud'] }

function fireIntent(intent) {
  act(() => { capturedOnIntent(intent) })
}

describe('useCookingMode — orchestrateur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTimer.state = 'idle'
    mockTimer.secondsLeft = 0
    capturedOnIntent = null
  })

  it('état initial : idle, index -1', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    expect(result.current.status).toBe('idle')
    expect(result.current.currentStepIndex).toBe(-1)
    expect(result.current.progress).toEqual({ current: 0, total: 3 })
  })

  it('handlers.start → speaking, index 0', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    expect(result.current.status).toBe('speaking')
    expect(result.current.currentStepIndex).toBe(0)
    expect(result.current.currentStep).toBe('Faire revenir 5 minutes')
  })

  it('intent next → étape suivante', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('next')
    expect(result.current.currentStepIndex).toBe(1)
  })

  it('intent previous → étape précédente', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('next')
    fireIntent('previous')
    expect(result.current.currentStepIndex).toBe(0)
  })

  it('intent jumpToStep → saut direct', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent({ intent: 'jumpToStep', step: 3 })
    expect(result.current.currentStepIndex).toBe(2)
  })

  it('intent lastStep → dernière étape', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('lastStep')
    expect(result.current.currentStepIndex).toBe(2)
  })

  it('intent firstStep → première étape', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('lastStep')
    fireIntent('firstStep')
    expect(result.current.currentStepIndex).toBe(0)
  })

  it('intent stop → finished', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('stop')
    expect(result.current.status).toBe('finished')
  })

  it('intent pause/resume → paused puis listening', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('pause')
    expect(result.current.status).toBe('paused')
    expect(mockSynth.cancel).toHaveBeenCalled()
    fireIntent('resume')
    expect(result.current.status).toBe('listening')
  })

  it('intent startTimer → timer.start avec la durée de l\'étape (300s)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('startTimer')
    expect(mockTimer.start).toHaveBeenCalledWith(300)
  })

  it('intent addTime minute → timer.addTime(amount × 60)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent({ intent: 'addTime', amount: 5, unit: 'minute' })
    expect(mockTimer.addTime).toHaveBeenCalledWith(300)
  })

  it('intent addTime seconde → timer.addTime(amount × 1)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent({ intent: 'addTime', amount: 30, unit: 'seconde' })
    expect(mockTimer.addTime).toHaveBeenCalledWith(30)
  })

  it('intent customTimer → timer.start avec durée custom', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent({ intent: 'customTimer', amount: 10, unit: 'minute' })
    expect(mockTimer.start).toHaveBeenCalledWith(600)
  })

  it('intent cancelTimer/pauseTimer → appels timer correspondants', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('pauseTimer')
    expect(mockTimer.pause).toHaveBeenCalled()
    fireIntent('cancelTimer')
    expect(mockTimer.cancel).toHaveBeenCalled()
  })

  it('intent inconnu → aucun changement d\'état', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    const before = result.current.currentStepIndex
    fireIntent('blabla_inconnu')
    expect(result.current.currentStepIndex).toBe(before)
    expect(result.current.status).toBe('speaking')
  })

  it('handlers.start prime le moteur TTS (unlock dans le geste)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    expect(mockSynth.unlock).toHaveBeenCalled()
  })

  it('toggleMute → muted bascule + coupe la lecture en cours', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    expect(result.current.muted).toBe(false)
    act(() => result.current.handlers.toggleMute())
    expect(result.current.muted).toBe(true)
    expect(mockSynth.cancel).toHaveBeenCalled()
    act(() => result.current.handlers.toggleMute())
    expect(result.current.muted).toBe(false)
  })

  it('muted → ne lit pas mais passe en listening (pas bloqué)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.toggleMute())
    mockSynth.speak.mockClear()
    act(() => result.current.handlers.start())
    expect(mockSynth.speak).not.toHaveBeenCalled()
    expect(result.current.status).toBe('listening')
  })

  it('resetTimer → relance le minuteur à la durée détectée', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    act(() => result.current.handlers.resetTimer())
    expect(mockTimer.start).toHaveBeenCalledWith(300)
  })

  it('intent vocal mute → muted true ; resumeSpeech → muted false', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('mute')
    expect(result.current.muted).toBe(true)
    fireIntent('resumeSpeech')
    expect(result.current.muted).toBe(false)
  })

  it('intent vocal resetTimer → timer.start(durée)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    fireIntent('resetTimer')
    expect(mockTimer.start).toHaveBeenCalledWith(300)
  })

  it('couper la Voix app pendant speaking → statut listening (pas bloqué)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    act(() => result.current.handlers.start())
    expect(result.current.status).toBe('speaking')
    act(() => result.current.handlers.toggleMute())  // coupe la voix en pleine lecture
    expect(result.current.muted).toBe(true)
    expect(result.current.status).toBe('listening')  // ne reste PAS bloqué sur speaking
  })

  it('toggleMic → micEnabled bascule (défaut true)', () => {
    const { result } = renderHook(() => useCookingMode(recipe, 'fr'))
    expect(result.current.micEnabled).toBe(true)
    act(() => result.current.handlers.toggleMic())
    expect(result.current.micEnabled).toBe(false)
    act(() => result.current.handlers.toggleMic())
    expect(result.current.micEnabled).toBe(true)
  })
})
