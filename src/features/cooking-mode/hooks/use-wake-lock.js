// src/features/cooking-mode/hooks/use-wake-lock.js
//
// Hook pour acquerir / relacher un Wake Lock ecran (empeche l'ecran de
// s'eteindre). Auto-release au unmount. Re-acquiert sur visibilitychange.
//
// Spec : la conception « cooking-mode-vocal » du 2026-05-19

import { useEffect, useRef, useState } from 'react'

export function useWakeLock(enabled = true) {
  const sentinelRef = useRef(null)
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled || !supported) return

    let cancelled = false

    async function acquire() {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release?.()
          return
        }
        sentinelRef.current = sentinel
        setActive(true)
        sentinel.addEventListener?.('release', () => setActive(false))
      } catch (err) {
        console.warn('[wake-lock] failed:', err.message)
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      if (sentinelRef.current) {
        sentinelRef.current.release?.()
        sentinelRef.current = null
        setActive(false)
      }
    }
  }, [enabled, supported])

  return { supported, active }
}
