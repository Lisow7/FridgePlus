import { useCallback, useSyncExternalStore } from 'react'

// Abonnement à une media query, via `useSyncExternalStore` : la source de vérité
// est le navigateur, pas un état React recopié dans un effet (ce qui aurait
// valu un `set-state-in-effect`). `false` quand `matchMedia` n'existe pas
// (jsdom nu, pré-rendu Node) : on ne réserve ni ne masque rien à l'aveugle.
const supporte = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    if (!supporte()) return () => {}
    const mq = window.matchMedia(query)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  const getSnapshot = useCallback(() => (supporte() ? window.matchMedia(query).matches : false), [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
