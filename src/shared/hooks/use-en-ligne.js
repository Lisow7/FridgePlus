import { useSyncExternalStore } from 'react'

// Le réseau est-il là ? `navigator.onLine` et ses événements `online` /
// `offline`. Sans navigateur (rendu serveur), on le suppose présent.
function abonner(rappel) {
  window.addEventListener('online', rappel)
  window.addEventListener('offline', rappel)
  return () => {
    window.removeEventListener('online', rappel)
    window.removeEventListener('offline', rappel)
  }
}

const lire = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

export function useEnLigne() {
  return useSyncExternalStore(abonner, lire, () => true)
}
