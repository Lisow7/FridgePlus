// Agrégations sur le journal de cuisine (`cooking_logs`).
//
// Toutes les fonctions sont pures et synchrones. Elles prennent en entrée
// un tableau de logs (récupéré via `loadAllCookingLogs`) et retournent
// des objets sérialisables — pas d'effet de bord, pas de PII supplémentaire.
//
// Hypothèses sur la forme des logs :
//   { recipe_id: string, recipe_source: 'base'|'custom'|'community',
//     servings: number|null, cooked_at: ISO string }

/** @returns {number} 1-12 */
function monthOf(iso) {
  return new Date(iso).getMonth() + 1
}

/**
 * Top N recettes par nombre de fois cuisinées.
 * @param {Array} logs
 * @param {number=} n — défaut 5
 * @returns {Array<{ recipe_id, recipe_source, count }>}
 */
export function topRecipes(logs, n = 5) {
  const counts = new Map()
  for (const log of logs) {
    const key = log.recipe_id
    if (!counts.has(key)) counts.set(key, { recipe_id: log.recipe_id, recipe_source: log.recipe_source, count: 0 })
    counts.get(key).count += 1
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, n)
}

/**
 * Compte des cuisinages pour les 6 derniers mois (dont le mois courant).
 * @param {Array} logs
 * @returns {Array<{ year: number, month: number, count: number }>}
 *   Index 0 = il y a 5 mois, index 5 = mois courant. Toujours 6 entrées.
 */
/**
 * v3.412 PR-E — Compte les logs par JOUR sur N derniers jours.
 * @returns {Array<{ key, date:Date, count }>}
 */
export function countByLastNDays(logs, daysBack = 30) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const buckets = []
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    buckets.push({ key, date: d, count: 0 })
  }
  for (const log of logs ?? []) {
    const d = new Date(log.cooked_at)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    const found = buckets.find(b => b.key === key)
    if (found) found.count += 1
  }
  return buckets
}

/**
 * v3.412 PR-E — Compte les logs par SEMAINE ISO sur N dernières semaines.
 * @returns {Array<{ key, weekStart:Date, count }>}
 */
export function countByLastNWeeks(logs, weeksBack = 12) {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
  const buckets = []
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(currentMonday)
    d.setDate(currentMonday.getDate() - i * 7)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    buckets.push({ key, weekStart: d, count: 0 })
  }
  for (const log of logs ?? []) {
    const d = new Date(log.cooked_at)
    const dDow = (d.getDay() + 6) % 7
    const evMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dDow)
    const key = `${evMonday.getFullYear()}-${evMonday.getMonth() + 1}-${evMonday.getDate()}`
    const found = buckets.find(b => b.key === key)
    if (found) found.count += 1
  }
  return buckets
}

/**
 * v3.412 PR-E — Compte les logs par ANNÉE sur N dernières années.
 * @returns {Array<{ key, year, count }>}
 */
export function countByLastNYears(logs, yearsBack = 5) {
  const now = new Date()
  const buckets = []
  for (let i = yearsBack - 1; i >= 0; i--) {
    const year = now.getFullYear() - i
    buckets.push({ key: String(year), year, count: 0 })
  }
  for (const log of logs ?? []) {
    const d = new Date(log.cooked_at)
    const found = buckets.find(b => b.year === d.getFullYear())
    if (found) found.count += 1
  }
  return buckets
}

export function countByLast6Months(logs) {
  const now = new Date()
  const buckets = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ year: d.getFullYear(), month: d.getMonth() + 1, count: 0 })
  }
  for (const log of logs) {
    const d = new Date(log.cooked_at)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const found = buckets.find(b => b.year === y && b.month === m)
    if (found) found.count += 1
  }
  return buckets
}

/**
 * Mois le plus actif sur tout l'historique (pas que les 6 derniers).
 * @param {Array} logs
 * @returns {{ month: number, count: number } | null}
 */
export function mostActiveMonth(logs) {
  if (!logs.length) return null
  const counts = new Array(13).fill(0)  // index 0 inutilisé, 1-12 = mois
  for (const log of logs) counts[monthOf(log.cooked_at)] += 1
  let bestMonth = 1
  for (let m = 2; m <= 12; m++) {
    if (counts[m] > counts[bestMonth]) bestMonth = m
  }
  if (counts[bestMonth] === 0) return null
  return { month: bestMonth, count: counts[bestMonth] }
}

/**
 * Compte des cuisinages dans le mois courant (jour 1 → aujourd'hui).
 * @param {Array} logs
 * @returns {number}
 */
export function countThisMonth(logs) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return logs.reduce((acc, log) => {
    const d = new Date(log.cooked_at)
    return acc + (d.getFullYear() === y && d.getMonth() + 1 === m ? 1 : 0)
  }, 0)
}

/**
 * Diversité = nombre de recettes uniques cuisinées.
 * @param {Array} logs
 * @returns {number}
 */
export function uniqueRecipesCount(logs) {
  return new Set(logs.map(l => l.recipe_id)).size
}

/**
 * Pays favori : code pays le plus représenté parmi les recettes cuisinées.
 * Nécessite la résolution recette → country côté caller (on ne stocke
 * pas le pays directement dans `cooking_logs` pour minimiser).
 *
 * @param {Array} logs
 * @param {function(string, string): string|null} resolveCountry
 *   — `(recipe_id, recipe_source) => 'fr' | 'it' | null`
 * @returns {{ country: string, count: number } | null}
 */
export function topCountry(logs, resolveCountry) {
  const counts = new Map()
  for (const log of logs) {
    const c = resolveCountry?.(log.recipe_id, log.recipe_source)
    if (!c) continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  let best = null
  for (const [country, count] of counts) {
    if (!best || count > best.count) best = { country, count }
  }
  return best
}
