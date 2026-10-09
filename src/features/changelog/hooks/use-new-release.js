import { useState, useCallback } from 'react'
import { CURRENT_VERSION } from '@shared/lib/version'
import { CHANGELOG } from '@features/changelog/data/changelog'

const STORAGE_KEY = 'fridge-last-seen-version'

export function useNewRelease() {
  const [hasNew, setHasNew] = useState(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      return seen !== CURRENT_VERSION
    } catch {
      return false
    }
  })

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    } catch {
      // localStorage indisponible (mode privé, quota) — silencieux
    }
    setHasNew(false)
  }, [])

  const latestRelease = CHANGELOG[0] ?? null

  return { hasNew, markSeen, latestRelease }
}
