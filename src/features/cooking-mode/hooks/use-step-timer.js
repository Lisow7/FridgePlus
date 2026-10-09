// src/features/cooking-mode/hooks/use-step-timer.js
//
// Timer countdown pour cuisson. Etats : idle / running / paused / done.
// Tick chaque 1 seconde. onComplete callback a 0.
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

import { useState, useRef, useCallback, useEffect } from 'react'

export function useStepTimer({ onComplete } = {}) {
  const [state, setState] = useState('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  // Miroir synchrone de `secondsLeft` : le tick doit lire la valeur courante
  // sans passer par un updater (cf. commentaire de `startTick`). Toute écriture
  // du compteur met les deux à jour.
  const secondsRef = useRef(0)
  const intervalRef = useRef(null)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // ⚠️ PLUS AUCUN EFFET DE BORD DANS UN UPDATER. Avant, l'updater de
  // `setSecondsLeft` appelait `clearTick()`, `setState('done')` et surtout
  // `onComplete()` — or React invoque les updaters DEUX fois en StrictMode pour
  // débusquer exactement ce genre d'impureté. L'annonce vocale « le temps est
  // écoulé » (use-cooking-mode.js:67) partait donc en double.
  //
  // Le décompte est désormais porté par `secondsRef`, et la fin détectée dans
  // le callback de l'interval — qui n'est PAS un updater : les effets y sont à
  // leur place, et il ne s'exécute qu'une fois par tick.
  //
  // `clearTick()` en tête rend l'amorçage idempotent : même appelé deux fois,
  // un seul interval survit. Sans cela le premier devenait orphelin (jamais
  // nettoyé, `intervalRef` ne gardant que le dernier) et le minuteur filait à
  // double vitesse après une pause/reprise.
  const startTick = useCallback(() => {
    clearTick()
    intervalRef.current = setInterval(() => {
      const next = Math.max(0, secondsRef.current - 1)
      secondsRef.current = next
      setSecondsLeft(next)
      if (next === 0) {
        clearTick()
        setState('done')
        onCompleteRef.current?.()
      }
    }, 1000)
  }, [])

  const start = useCallback((totalSeconds) => {
    clearTick()
    secondsRef.current = totalSeconds
    setSecondsLeft(totalSeconds)
    setState('running')
    startTick()
  }, [startTick])

  const pause = useCallback(() => {
    clearTick()
    setState('paused')
  }, [])

  // La garde se fait sur l'état courant, PAS dans un updater : créer un
  // `setInterval` depuis un updater en produisait deux en StrictMode.
  const resume = useCallback(() => {
    if (state !== 'paused') return
    setState('running')
    startTick()
  }, [state, startTick])

  const cancel = useCallback(() => {
    clearTick()
    setState('idle')
    secondsRef.current = 0
    setSecondsLeft(0)
  }, [])

  const addTime = useCallback((seconds) => {
    const next = secondsRef.current + seconds
    secondsRef.current = next
    setSecondsLeft(next)
  }, [])

  useEffect(() => () => clearTick(), [])

  return { state, secondsLeft, start, pause, resume, cancel, addTime }
}
