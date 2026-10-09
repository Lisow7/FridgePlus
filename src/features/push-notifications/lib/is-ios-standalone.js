// Détecte si on tourne sur iOS ET si la PWA est installée sur l'écran
// d'accueil (mode standalone). Sur iOS, Web Push ne fonctionne QUE dans ce
// mode (iOS 16.4+) — contrainte plateforme non contournable.

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

// true = push utilisable, false = iOS non-installé (bloqué), null = non-iOS
// (pas de contrainte particulière côté navigateur desktop/Android).
export function iosPushBlocked() {
  if (!isIOS()) return false
  return !isStandalone()
}
