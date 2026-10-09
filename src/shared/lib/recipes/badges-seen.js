// Snapshot local des badges déjà « vus » (célébrés), pour ne pas re-célébrer.
// Préférence FONCTIONNELLE locale (pas de PII, pas de consentement requis,
// comme welcome-seen). Anti toast-flood : au 1er chargement / nouvel appareil,
// on sème en silence les badges déjà débloqués (aucune célébration).

export const SEEN_KEY = 'fridge-badges-seen-v1'

export function readSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeSeen(ids) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids))
  } catch {
    /* localStorage indisponible (mode privé strict) : on ignore */
  }
}

/** @returns {string[]} ids débloqués absents de `seen`. */
export function diffNewlyUnlocked(unlocked, seen) {
  const seenSet = new Set(seen)
  return unlocked.filter((id) => !seenSet.has(id))
}

/**
 * Si la clé est ABSENTE → seed silencieux (0 célébration). Sinon → renvoie les
 * nouveaux ids à célébrer et les mémorise.
 * @returns {{ seeded: boolean, toCelebrate: string[] }}
 */
export function seedIfAbsent(unlocked) {
  let raw = null
  try {
    raw = localStorage.getItem(SEEN_KEY)
  } catch {
    /* ignore */
  }
  if (raw === null) {
    writeSeen(unlocked)
    return { seeded: true, toCelebrate: [] }
  }
  const seen = readSeen()
  const toCelebrate = diffNewlyUnlocked(unlocked, seen)
  if (toCelebrate.length) writeSeen([...new Set([...seen, ...toCelebrate])])
  return { seeded: false, toCelebrate }
}
