// Persistance de la carte d'activation « Bien démarrer », par utilisateur.
// Étapes 1 & 3 sont dérivées LIVE de l'état serveur (stock/favoris) ; ici on
// ne persiste que l'étape 2 (action de session) + dismissed + completed.
// Clé : fridge-getting-started-v1:<uid>
const KEY = (uid) => `fridge-getting-started-v1:${uid}`

function read(uid) {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) || '{}') }
  catch { return {} }
}
function write(uid, patch) {
  try { localStorage.setItem(KEY(uid), JSON.stringify({ ...read(uid), ...patch })) }
  catch { /* noop */ }
}

export function hasOpenedSuggestion(uid) { return read(uid).step2_opened === true }
export function markSuggestionOpened(uid) { write(uid, { step2_opened: true }) }
// `dismissed` = carte RÉDUITE en pastille (pas supprimée) → réversible via clearDismissed.
export function isDismissed(uid) { return read(uid).dismissed === true }
export function markDismissed(uid) { write(uid, { dismissed: true }) }
export function clearDismissed(uid) { write(uid, { dismissed: false }) }
// Complétion VERSIONNÉE. v3 = fil recentré sur l'Aha (favori retiré). Un user
// « complété » sous v2 (Tier 2a, 4 étapes dont favori) a une définition d'étapes
// différente → on repart de zéro pour qu'il voie le nouveau fil sans être bloqué.
export function isCompleted(uid) { return read(uid).completed_v3 === true }
export function markCompleted(uid) { write(uid, { completed_v3: true }) }

// ── Pub/sub léger ──────────────────────────────────────────────────────────
// Permet à un point d'entrée EXTERNE (bouton fusée du footer) de rouvrir le
// guide et de notifier le container — ils vivent dans des arbres React séparés
// mais lisent le même storage. Seul `reopenGuide` notifie (les mutations
// internes du container déclenchent déjà son propre re-render → pas de boucle).
const listeners = new Set()
export function subscribeGettingStarted(fn) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
function notify() { listeners.forEach((fn) => { try { fn() } catch { /* noop */ } }) }

// Rouvre le guide depuis l'extérieur : ré-affiché déplié, même s'il avait été
// réduit OU complété. Notifie les abonnés (le container se re-rend aussitôt).
export function reopenGuide(uid) {
  write(uid, { dismissed: false, completed_v3: false })
  notify()
}
