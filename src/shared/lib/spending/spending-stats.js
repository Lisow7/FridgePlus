// Helpers d'agrégation et recommandations statiques pour
// le dashboard Analyse Dépenses Premium. Tout est calculé client-side
// à partir de la liste des spending_events fournie par lib/db/spending.

/**
 * Agrège les events par mois (clé 'YYYY-MM').
 * @param {Array} events — sortie de listSpendingEvents
 * @param {number} monthsBack — combien de mois inclure dans le résultat (avec 0 si vide)
 * @returns {Array<{key:string, year:number, month:number, total:number, count:number}>}
 *   Trié du plus ancien au plus récent (pour graphique gauche→droite).
 */
/**
 * v3.412 PR-E — Agrège les events par JOUR (clé 'YYYY-MM-DD').
 * @param {Array} events
 * @param {number} daysBack — combien de jours inclure (avec 0 si vide)
 * @returns {Array<{key, date:Date, total, count}>}
 */
export function getDailyTotals(events, daysBack = 30) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const buckets = new Map()
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    buckets.set(key, { key, date: d, total: 0, count: 0 })
  }
  for (const ev of events ?? []) {
    const d = new Date(ev.occurred_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.total += Number(ev.total_eur) || 0
    bucket.count += 1
  }
  return Array.from(buckets.values())
}

/**
 * v3.412 PR-E — Agrège les events par SEMAINE ISO (clé 'YYYY-Www').
 * Lundi = début de semaine (ISO 8601).
 * @returns {Array<{key, weekStart:Date, total, count}>}
 */
export function getWeeklyTotals(events, weeksBack = 12) {
  const now = new Date()
  // Trouve le lundi de la semaine courante
  const dayOfWeek = (now.getDay() + 6) % 7  // 0=lundi, 6=dimanche
  const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
  const buckets = new Map()
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(currentMonday)
    d.setDate(currentMonday.getDate() - i * 7)
    const key = `${d.getFullYear()}-W${String(Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000))).padStart(2, '0')}`
    buckets.set(key, { key, weekStart: d, total: 0, count: 0 })
  }
  for (const ev of events ?? []) {
    const d = new Date(ev.occurred_at)
    const dDow = (d.getDay() + 6) % 7
    const evMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dDow)
    const key = `${evMonday.getFullYear()}-W${String(Math.floor((evMonday.getTime() - new Date(evMonday.getFullYear(), 0, 1).getTime()) / (7 * 86400000))).padStart(2, '0')}`
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.total += Number(ev.total_eur) || 0
    bucket.count += 1
  }
  return Array.from(buckets.values())
}

/**
 * v3.412 PR-E — Agrège les events par ANNÉE (clé 'YYYY').
 * @returns {Array<{key, year, total, count}>}
 */
export function getYearlyTotals(events, yearsBack = 5) {
  const now = new Date()
  const buckets = new Map()
  for (let i = yearsBack - 1; i >= 0; i--) {
    const year = now.getFullYear() - i
    buckets.set(String(year), { key: String(year), year, total: 0, count: 0 })
  }
  for (const ev of events ?? []) {
    const d = new Date(ev.occurred_at)
    const key = String(d.getFullYear())
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.total += Number(ev.total_eur) || 0
    bucket.count += 1
  }
  return Array.from(buckets.values())
}

export function getMonthlyTotals(events, monthsBack = 12) {
  const now = new Date()
  const buckets = new Map()
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { key, year: d.getFullYear(), month: d.getMonth(), total: 0, count: 0 })
  }
  for (const ev of events ?? []) {
    const d = new Date(ev.occurred_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.total += Number(ev.total_eur) || 0
    bucket.count += 1
  }
  return Array.from(buckets.values())
}

/**
 * Génère les recommandations statiques basées sur l'historique + budget.
 * Règles simples, prévisibles, gratuites. Affichées telles quelles dans
 * l'UI (i18n côté composant).
 *
 * @param {Array} monthlyTotals — sortie de getMonthlyTotals
 * @param {number|null} budget — budget mensuel cible de l'user (null si non défini)
 * @returns {Array<{key:string, severity:'info'|'success'|'warning'|'alert', payload:object}>}
 */
export function getStaticRecommendations(monthlyTotals, budget) {
  const recos = []
  const last = monthlyTotals[monthlyTotals.length - 1]
  const previous = monthlyTotals[monthlyTotals.length - 2]
  const withData = monthlyTotals.filter(m => m.count > 0)

  // Pas assez de data
  if (withData.length === 0) {
    recos.push({ key: 'no_data', severity: 'info', payload: {} })
    return recos
  }

  // Comparaison mois courant vs précédent
  if (last && previous && previous.total > 0 && last.total > 0) {
    const delta = ((last.total - previous.total) / previous.total) * 100
    if (delta >= 15) {
      recos.push({ key: 'up_vs_prev', severity: 'warning', payload: { pct: Math.round(delta) } })
    } else if (delta <= -15) {
      recos.push({ key: 'down_vs_prev', severity: 'success', payload: { pct: Math.round(Math.abs(delta)) } })
    }
  }

  // Comparaison vs budget cible
  if (budget && last && last.total > 0) {
    const pct = (last.total / budget) * 100
    if (pct >= 110) {
      recos.push({ key: 'over_budget', severity: 'alert', payload: { pct: Math.round(pct - 100), spent: last.total, budget } })
    } else if (pct <= 80) {
      recos.push({ key: 'under_budget', severity: 'success', payload: { pct: Math.round(100 - pct), spent: last.total, budget } })
    } else {
      recos.push({ key: 'on_budget', severity: 'success', payload: { pct: Math.round(pct), spent: last.total, budget } })
    }
  }

  // Mois le plus dépensier de l'historique
  if (withData.length >= 3) {
    const peak = withData.reduce((max, m) => m.total > max.total ? m : max, withData[0])
    if (last && peak.key === last.key && last.total > 0) {
      recos.push({ key: 'peak_month', severity: 'warning', payload: {} })
    }
  }

  // Moyenne mensuelle (info constante)
  if (withData.length >= 2) {
    const avg = withData.reduce((s, m) => s + m.total, 0) / withData.length
    recos.push({ key: 'monthly_avg', severity: 'info', payload: { avg: Math.round(avg * 100) / 100 } })
  }

  return recos
}

// ─────────────────────────────────────────────────────────────────────────
// v3.415 PR-E.2 — Analytics étendues : breakdown catégorie, top produits,
// projection fin de mois. Tout reste client-side (pas de SQL extra), basé
// sur `items_json` déjà capturé par recordSpendingEvent.
// ─────────────────────────────────────────────────────────────────────────

// Préfixe d'ID → macro-catégorie. Cf. README.md, conventions d'identifiants.
// Stable et indépendant du contenu d'ingredients.js → pas de risque de
// désync quand la BDD évolue.
const CATEGORY_BY_PREFIX = {
  'frz': 'frozen',
  'fr':  'fresh',
  'vg':  'veggies',
  'gp':  'pantry',
  'sp':  'spices',
  'bk':  'bakery',
}

function categoryForId(id) {
  if (!id || typeof id !== 'string') return 'other'
  const dash = id.indexOf('-')
  if (dash < 0) return 'other'
  const prefix = id.slice(0, dash)
  return CATEGORY_BY_PREFIX[prefix] ?? 'other'
}

/**
 * Agrège les items_json de tous les events par macro-catégorie.
 * @param {Array} events — sortie de listSpendingEvents (filtrés sur période)
 * @returns {Array<{ key, total, count, ratio }>} trié desc par total
 */
export function getCategoryBreakdown(events) {
  const totals = new Map()
  let grand = 0
  for (const ev of events ?? []) {
    for (const item of ev.items_json ?? []) {
      const cat = categoryForId(item.id)
      const price = Number(item.unit_eur) || 0
      if (!totals.has(cat)) totals.set(cat, { key: cat, total: 0, count: 0 })
      const b = totals.get(cat)
      b.total += price
      b.count += 1
      grand += price
    }
  }
  const out = Array.from(totals.values()).map(b => ({
    ...b,
    total: Math.round(b.total * 100) / 100,
    ratio: grand > 0 ? b.total / grand : 0,
  }))
  out.sort((a, b) => b.total - a.total)
  return out
}

/**
 * Top N ingrédients les plus coûteux sur la période.
 * @returns {Array<{ id, total, count }>} trié desc par total
 */
export function getTopExpensiveItems(events, n = 5) {
  const totals = new Map()
  for (const ev of events ?? []) {
    for (const item of ev.items_json ?? []) {
      const id = item.id
      if (!id) continue
      const price = Number(item.unit_eur) || 0
      if (!totals.has(id)) totals.set(id, { id, total: 0, count: 0 })
      const b = totals.get(id)
      b.total += price
      b.count += 1
    }
  }
  const out = Array.from(totals.values()).map(b => ({
    ...b,
    total: Math.round(b.total * 100) / 100,
  }))
  out.sort((a, b) => b.total - a.total)
  return out.slice(0, n)
}

/**
 * Projection fin de mois sur trajectoire actuelle.
 * Calcule : (total_du_mois / jours_écoulés) × jours_total_du_mois.
 * Si pas assez de data (< 3 jours écoulés), renvoie null.
 *
 * @param {Array} events — events filtrés sur le mois courant
 * @param {number|null} budget — budget mensuel cible
 * @returns {{ spent, projected, daysElapsed, daysInMonth, deltaPct, severity }|null}
 */
export function getMonthProjection(events, budget) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const daysElapsed = now.getDate()  // 1-31, jour courant inclus
  if (daysElapsed < 3) return null   // pas assez de signal en début de mois

  let spent = 0
  for (const ev of events ?? []) {
    const d = new Date(ev.occurred_at)
    if (d.getFullYear() === year && d.getMonth() === month && d >= firstDay) {
      spent += Number(ev.total_eur) || 0
    }
  }
  if (spent === 0) return null

  const projected = Math.round((spent / daysElapsed) * daysInMonth * 100) / 100
  let deltaPct = null
  let severity = 'info'
  if (budget && budget > 0) {
    deltaPct = Math.round(((projected - budget) / budget) * 100)
    if (deltaPct >= 10)       severity = 'alert'
    else if (deltaPct >= -10) severity = 'warning'  // sur la corde raide
    else                       severity = 'success'
  }
  return {
    spent: Math.round(spent * 100) / 100,
    projected,
    daysElapsed,
    daysInMonth,
    deltaPct,
    severity,
  }
}
