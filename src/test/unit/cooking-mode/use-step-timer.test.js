// src/test/unit/cooking-mode/use-step-timer.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode, createElement } from 'react'
import { renderHook, act } from '@testing-library/react'
import { useStepTimer } from '../../../features/cooking-mode/hooks/use-step-timer'

describe('useStepTimer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('idle par defaut, secondsLeft=0', () => {
    const { result } = renderHook(() => useStepTimer())
    expect(result.current.state).toBe('idle')
    expect(result.current.secondsLeft).toBe(0)
  })

  it('start(60) → running, count-down', () => {
    const { result } = renderHook(() => useStepTimer())
    act(() => result.current.start(60))
    expect(result.current.state).toBe('running')
    expect(result.current.secondsLeft).toBe(60)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.secondsLeft).toBe(59)
  })

  it('expire a 0 → done + callback onComplete', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useStepTimer({ onComplete }))
    act(() => result.current.start(2))
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.state).toBe('done')
    expect(result.current.secondsLeft).toBe(0)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('cancel → idle, secondsLeft=0', () => {
    const { result } = renderHook(() => useStepTimer())
    act(() => result.current.start(60))
    act(() => result.current.cancel())
    expect(result.current.state).toBe('idle')
    expect(result.current.secondsLeft).toBe(0)
  })

  it('pause → paused, count-down arrete', () => {
    const { result } = renderHook(() => useStepTimer())
    act(() => result.current.start(60))
    act(() => { vi.advanceTimersByTime(5000) })
    act(() => result.current.pause())
    expect(result.current.state).toBe('paused')
    expect(result.current.secondsLeft).toBe(55)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.secondsLeft).toBe(55)
  })

  it('addTime augmente secondsLeft', () => {
    const { result } = renderHook(() => useStepTimer())
    act(() => result.current.start(60))
    act(() => result.current.addTime(30))
    expect(result.current.secondsLeft).toBe(90)
  })

  // Pureté des updaters — même classe de défaut que la régression corrigée sur
  // `useFridgeStock` (#958) : un effet de bord placé DANS un updater `setState`,
  // que React invoque DEUX fois en StrictMode (actif en dev, cf. main.jsx).
  //
  // Ici les conséquences sont directement audibles : `onComplete` déclenche
  // l'annonce vocale « le temps est écoulé » (use-cooking-mode.js:67), et un
  // `setInterval` en double fait courir le minuteur de cuisson à double vitesse.
  describe('pureté des updaters (StrictMode)', () => {
    const inStrictMode = ({ children }) => createElement(StrictMode, null, children)

    it('la fin du minuteur n\'annonce qu\'UNE fois', () => {
      const onComplete = vi.fn()
      const { result } = renderHook(() => useStepTimer({ onComplete }), { wrapper: inStrictMode })
      act(() => result.current.start(2))
      act(() => { vi.advanceTimersByTime(2000) })

      expect(onComplete, 'une seule annonce de fin').toHaveBeenCalledTimes(1)
      expect(result.current.state).toBe('done')
    })

    it('après pause/reprise, le décompte reste à 1 seconde par seconde', () => {
      const { result } = renderHook(() => useStepTimer(), { wrapper: inStrictMode })
      act(() => result.current.start(60))
      act(() => result.current.pause())
      act(() => result.current.resume())

      // Deux intervals concurrents feraient tomber à 55.
      act(() => { vi.advanceTimersByTime(5000) })
      expect(result.current.secondsLeft, 'un seul interval actif').toBe(55)
    })
  })
})
