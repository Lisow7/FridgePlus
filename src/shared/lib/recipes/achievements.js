// Séries hebdo + badges, dérivés de `cooking_logs`. Pur/synchrone, pas d'I/O.
//
// Mêmes hypothèses de forme que cooking-stats.js :
//   { recipe_id, recipe_source, servings, cooked_at: ISO string }
//
// Convention semaine ISO (lundi = 0), identique à cooking-stats.js
// (`(getDay() + 6) % 7`). Aucune PII supplémentaire : tout est dérivé du
// tableau de logs déjà chargé (RLS user-only).

function mondayOf(date) {
  const dow = (date.getDay() + 6) % 7 // lundi=0 … dimanche=6
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow)
}

/** Nb de semaines entre la semaine de `date` et celle de `ref` (>0 = passé). */
function weekIndex(date, ref) {
  const ms = mondayOf(ref).getTime() - mondayOf(date).getTime()
  return Math.round(ms / (7 * 86400000))
}

/**
 * Série hebdomadaire : nombre de semaines consécutives avec ≥ 1 cuisine.
 * La semaine courante vide ne casse pas la série tant qu'elle n'est pas finie.
 * @param {Array} logs
 * @param {Date=} now
 * @returns {{ current: number, best: number }}
 */
export function computeWeeklyStreak(logs, now = new Date()) {
  const safe = logs ?? []
  const weeks = new Set()
  for (const l of safe) {
    const idx = weekIndex(new Date(l.cooked_at), now)
    if (idx >= 0) weeks.add(idx) // ignore le futur par sécurité
  }
  if (weeks.size === 0) return { current: 0, best: 0 }
  const sorted = [...weeks].sort((a, b) => a - b) // 0 = semaine courante

  // current : ancré sur la semaine courante (0) OU la précédente (1), car la
  // semaine courante vide ne casse pas tant qu'elle n'est pas terminée.
  let current = 0
  if (sorted[0] === 0 || sorted[0] === 1) {
    current = 1
    let prev = sorted[0]
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        current++
        prev = sorted[i]
      } else break
    }
  }

  // best : plus longue suite consécutive de l'historique.
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++
      best = Math.max(best, run)
    } else run = 1
  }
  return { current, best }
}

// Définitions de badges — ordonnées par thème puis par palier croissant.
// metric ∈ { 'total', 'unique', 'countries', 'streakBest' }.
// reward.banner (optionnel) : bannière exclusive débloquée avec ce palier — cf.
// la note interne sur l’ajout de quêtes et de cosmétiques. Émoji JAMAIS réutilisé entre paliers.
export const BADGE_DEFINITIONS = [
  // 🔥 Régularité — metric: streakBest (semaines)
  { id: 'streak-3',  theme: 'regularity', tier: 1, threshold: 3,  metric: 'streakBest', emoji: '🔥', label: { fr: "3 semaines d’affilée",  en: '3 weeks in a row' }, reward: { banner: 'ember' } },
  { id: 'streak-8',  theme: 'regularity', tier: 2, threshold: 8,  metric: 'streakBest', emoji: '⚡', label: { fr: "8 semaines d’affilée",  en: '8 weeks in a row' }, reward: { banner: 'berry' } },
  { id: 'streak-26', theme: 'regularity', tier: 3, threshold: 26, metric: 'streakBest', emoji: '🏆', label: { fr: "26 semaines d’affilée", en: '26 weeks in a row' }, reward: { banner: 'mint-fresh' } },
  // 🍳 Volume — metric: total
  { id: 'volume-1',   theme: 'volume', tier: 1, threshold: 1,   metric: 'total', emoji: '🍳',   label: { fr: 'Première recette cuisinée', en: 'First recipe cooked' }, reward: { banner: 'veggies' } },
  { id: 'volume-10',  theme: 'volume', tier: 2, threshold: 10,  metric: 'total', emoji: '👨‍🍳', label: { fr: '10 plats cuisinés',  en: '10 dishes cooked' }, reward: { banner: 'bakery' } },
  { id: 'volume-25',  theme: 'volume', tier: 3, threshold: 25,  metric: 'total', emoji: '🍲',   label: { fr: '25 plats cuisinés',  en: '25 dishes cooked' }, reward: { banner: 'plum' } },
  { id: 'volume-50',  theme: 'volume', tier: 4, threshold: 50,  metric: 'total', emoji: '🥘',   label: { fr: '50 plats cuisinés',  en: '50 dishes cooked' }, reward: { banner: 'copper' } },
  { id: 'volume-100', theme: 'volume', tier: 5, threshold: 100, metric: 'total', emoji: '👑',   label: { fr: '100 plats cuisinés', en: '100 dishes cooked' }, reward: { banner: 'crown-gold' } },
  // 🌈 Variété — metric: unique
  { id: 'variety-10', theme: 'variety', tier: 1, threshold: 10, metric: 'unique', emoji: '🌈', label: { fr: '10 recettes différentes', en: '10 different recipes' }, reward: { banner: 'aurora' } },
  { id: 'variety-25', theme: 'variety', tier: 2, threshold: 25, metric: 'unique', emoji: '🎨', label: { fr: '25 recettes différentes', en: '25 different recipes' }, reward: { banner: 'violet-muse' } },
  { id: 'variety-50', theme: 'variety', tier: 3, threshold: 50, metric: 'unique', emoji: '💫', label: { fr: '50 recettes différentes', en: '50 different recipes' }, reward: { banner: 'starlight' } },
  // 🌍 Monde — metric: countries
  { id: 'world-3',  theme: 'world', tier: 1, threshold: 3,  metric: 'countries', emoji: '🌍', label: { fr: '3 pays différents',  en: '3 different countries' }, reward: { banner: 'spices' } },
  { id: 'world-8',  theme: 'world', tier: 2, threshold: 8,  metric: 'countries', emoji: '🗺️', label: { fr: '8 pays différents',  en: '8 different countries' }, reward: { banner: 'ocean' } },
  { id: 'world-15', theme: 'world', tier: 3, threshold: 15, metric: 'countries', emoji: '🧭', label: { fr: '15 pays différents', en: '15 different countries' }, reward: { banner: 'horizon' } },
]

/**
 * Calcule les 4 métriques de badges.
 * @param {Array} logs
 * @param {function(string, string): string|null} resolveCountry
 * @param {Date=} now
 */
export function computeMetrics(logs, resolveCountry, now = new Date()) {
  const safe = logs ?? []
  return {
    total: safe.length,
    unique: new Set(safe.map((l) => l.recipe_id)).size,
    countries: new Set(safe.map((l) => resolveCountry?.(l.recipe_id, l.recipe_source)).filter(Boolean)).size,
    streakBest: computeWeeklyStreak(safe, now).best,
  }
}

/**
 * @returns {Array<{ id, theme, tier, threshold, metric, emoji, label,
 *   unlocked: boolean, isNextTier: boolean,
 *   progress: { current: number, value: number, threshold: number } }>}
 */
export function computeBadges(logs, resolveCountry, now = new Date()) {
  const metrics = computeMetrics(logs, resolveCountry, now)
  const firstLockedByTheme = {}
  return BADGE_DEFINITIONS.map((def) => {
    const value = metrics[def.metric] ?? 0
    const unlocked = value >= def.threshold
    if (!unlocked && firstLockedByTheme[def.theme] === undefined) {
      firstLockedByTheme[def.theme] = def.id
    }
    return {
      ...def,
      unlocked,
      isNextTier: firstLockedByTheme[def.theme] === def.id,
      progress: { current: Math.min(value, def.threshold), value, threshold: def.threshold },
    }
  })
}

/** @returns {string[]} ids des badges débloqués. */
export function unlockedIds(badges) {
  return badges.filter((b) => b.unlocked).map((b) => b.id)
}

/** Ids de bannières qui sont récompense d'un badge (donc verrouillées tant que non débloquées). */
function rewardBannerIds() {
  return new Set(BADGE_DEFINITIONS.map((d) => d.reward?.banner).filter(Boolean))
}

/** Une bannière est verrouillée si c'est la récompense d'un badge non débloqué. */
export function isBannerLocked(bannerId, unlockedBanners = []) {
  if (!rewardBannerIds().has(bannerId)) return false
  return !unlockedBanners.includes(bannerId)
}

/** Le badge qui récompense cette bannière (ou null). */
export function badgeForBanner(bannerId) {
  return BADGE_DEFINITIONS.find((d) => d.reward?.banner === bannerId) ?? null
}

/**
 * Bannières nouvellement gagnées : badge à `reward.banner` débloqué et pas encore
 * dans `unlockedBanners`. Octroi idempotent — `badges` vient de `computeBadges`.
 * @param {Array} badges
 * @param {string[]} unlockedBanners
 * @returns {string[]}
 */
export function computeNewlyUnlocked(badges, unlockedBanners = []) {
  const set = new Set(unlockedBanners)
  const earned = []
  for (const b of badges) {
    const banner = b.reward?.banner
    if (!banner || set.has(banner)) continue
    if (b.unlocked) earned.push(banner)
  }
  return earned
}

/**
 * « Prochaine récompense » : parmi les badges à `reward.banner` non débloqués, celui
 * dont la progression est la plus avancée (le plus proche d'être fini), tous thèmes
 * confondus. null si tout est débloqué. Complète `isNextTier` (qui, lui, ne regarde
 * qu'un thème à la fois).
 * @param {Array} badges
 * @param {string[]} unlockedBanners
 */
export function nextReward(badges, unlockedBanners = []) {
  const set = new Set(unlockedBanners)
  let best = null
  let bestProgress = -1
  let bestRemaining = Infinity
  for (const b of badges) {
    const banner = b.reward?.banner
    if (!banner || set.has(banner)) continue
    if (b.unlocked) continue // déjà gagnable (sera octroyé) — pas « à viser »
    const progress = b.progress.threshold > 0 ? b.progress.value / b.progress.threshold : 0
    const remaining = b.progress.threshold - b.progress.value
    if (progress > bestProgress || (progress === bestProgress && remaining < bestRemaining)) {
      bestProgress = progress
      bestRemaining = remaining
      best = b
    }
  }
  return best
}
