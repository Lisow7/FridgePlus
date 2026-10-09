import { useState, useEffect } from 'react'
import { hasCookedAtLeastOnce } from '@shared/api/cooking-logs'

// Vrai si l'utilisateur a cuisiné ≥ 1 plat (4ᵉ étape onboarding). False tant que
// non résolu et pour un invité ('guest'). Re-fetch au changement d'uid.
export function useHasCookedFirstDish(uid) {
  const [hasCooked, setHasCooked] = useState(false)
  useEffect(() => {
    if (!uid || uid === 'guest') { setHasCooked(false); return }
    let cancelled = false
    hasCookedAtLeastOnce(uid).then((v) => { if (!cancelled) setHasCooked(v) })
    return () => { cancelled = true }
  }, [uid])
  return hasCooked
}
