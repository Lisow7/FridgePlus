import { useState, useEffect } from 'react'
import { findSimilarRecipes } from '@features/recipes/api/recipes'

// R-05 — debounce la détection de doublon. N'appelle la RPC que si `enabled`
// et au-dessus des seuils (nom ≥ 3 caractères, ≥ 1 ingrédient). Fail-open.
const MIN_NAME = 3
const DEBOUNCE_MS = 500

export function useSimilarRecipes(name, ingredientIds, excludeId, enabled) {
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(false)

  const cleanName = (name ?? '').trim()
  const ids = (ingredientIds ?? []).filter(Boolean)
  const idsKey = ids.join(',')
  const active = Boolean(enabled) && cleanName.length >= MIN_NAME && ids.length >= 1

  useEffect(() => {
    if (!active) { setSimilar([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      const res = await findSimilarRecipes(cleanName, ids, excludeId ?? null)
      if (!cancelled) { setSimilar(res); setLoading(false) }
    }, DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cleanName, idsKey, excludeId])

  return { similar, loading }
}
