import { useState, useCallback, useMemo } from 'react'

// Gestion d'une sélection multiple (Set d'ids) pour les actions groupées de
// modération (Vague A). Immutable, stable. Le « toggleAll » bascule entre
// « tout sélectionner » (si pas déjà tout) et « tout désélectionner ».
export function useSelection() {
  const [selected, setSelected] = useState(() => new Set())

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids) => {
    setSelected((prev) => (ids.length > 0 && ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)))
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])
  const isSelected = useCallback((id) => selected.has(id), [selected])
  const ids = useMemo(() => [...selected], [selected])

  return { selected, ids, count: selected.size, toggle, toggleAll, clear, isSelected }
}
