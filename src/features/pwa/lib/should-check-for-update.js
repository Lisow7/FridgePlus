// Helper pur : décide si un check de mise à jour du service worker
// déclenché par un événement `visibilitychange` doit réellement s'exécuter,
// pour éviter un flood de requêtes réseau si l'utilisateur bascule
// souvent entre onglets. Le check périodique (setInterval) ne passe PAS
// par ce throttle — seul le trigger visibilitychange en a besoin.

export function shouldCheckForUpdate(lastCheckTimestamp, now, throttleMs) {
  if (lastCheckTimestamp == null) return true
  return (now - lastCheckTimestamp) >= throttleMs
}
