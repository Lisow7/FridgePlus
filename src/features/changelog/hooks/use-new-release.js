import { useState, useCallback, useEffect } from 'react'
import { CURRENT_VERSION } from '@shared/lib/version'

const STORAGE_KEY = 'fridge-last-seen-version'

export function useNewRelease() {
  const [hasNew, setHasNew] = useState(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      // Premier passage sur cet appareil : rien de « nouveau » à annoncer à qui
      // découvre l'app (audit du 2026-10-04, UX-11 — un visiteur lisait
      // « Nouveautés disponibles » avant d'avoir rien vu).
      return seen != null && seen !== CURRENT_VERSION
    } catch {
      return false
    }
  })

  // … mais la version du jour est notée en silence, pour que la SUIVANTE soit
  // annoncée — même principe que `badges-seen` sur un nouvel appareil.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) == null) localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    } catch {
      // localStorage indisponible (mode privé, quota) — silencieux
    }
  }, [])

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    } catch {
      // localStorage indisponible (mode privé, quota) — silencieux
    }
    setHasNew(false)
  }, [])

  // Le nom de la version se lit dans `version.js` (CURRENT_RELEASE_NAME) : le
  // journal complet n'a rien à faire au démarrage (audit du 2026-10-04, PERF-04).
  return { hasNew, markSeen }
}
