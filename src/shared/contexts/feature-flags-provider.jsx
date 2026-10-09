import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { fetchFeatureFlags } from '@shared/api/feature-flags'
import { resolveFlag } from '@shared/lib/feature-flags/resolve-flag'

// Provider léger : charge tous les flags une fois au mount et les expose
// dans une Map<key, enabled>. `reload()` permet à l'admin de rafraîchir
// après un toggle. La lecture est publique (anon ok) — pas besoin d'auth.
const FeatureFlagsContext = createContext(null)

export function FeatureFlagsProvider({ children }) {
  const [flagsMap, setFlagsMap] = useState(() => new Map())
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const rows = await fetchFeatureFlags()
    setFlagsMap(new Map(rows.map(r => [r.key, r.enabled])))
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const value = useMemo(() => ({ flagsMap, loading, reload }), [flagsMap, loading, reload])

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFeatureFlags doit être appelé dans <FeatureFlagsProvider>')
  return ctx
}

// Hook d'usage courant : booléen direct. `fallback` = valeur si le flag
// n'est pas en base (feature pas encore seedée).
export function useFeatureFlag(key, fallback = false) {
  const { flagsMap } = useFeatureFlags()
  return resolveFlag(flagsMap, key, fallback)
}
