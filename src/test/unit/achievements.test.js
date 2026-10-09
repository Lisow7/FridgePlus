import { describe, it, expect } from 'vitest'
import {
  computeWeeklyStreak,
  BADGE_DEFINITIONS,
  computeBadges,
  unlockedIds,
  isBannerLocked,
  badgeForBanner,
  computeNewlyUnlocked,
  nextReward,
} from '@shared/lib/recipes/achievements'
import { BANNER_CATALOG } from '@shared/lib/banners'

// Date d'ancrage fixe = un lundi, pour des tests déterministes.
const NOW = new Date('2026-06-15T12:00:00')
const log = (daysAgo) => ({
  recipe_id: 'r',
  recipe_source: 'base',
  servings: 2,
  cooked_at: new Date(NOW.getTime() - daysAgo * 86400000).toISOString(),
})
const cook = (recipe_id, recipe_source = 'base') => ({
  recipe_id,
  recipe_source,
  servings: 2,
  cooked_at: NOW.toISOString(),
})

describe('computeWeeklyStreak', () => {
  it('0 log → current 0, best 0', () => {
    expect(computeWeeklyStreak([], NOW)).toEqual({ current: 0, best: 0 })
  })
  it('cuisine cette semaine → current 1', () => {
    expect(computeWeeklyStreak([log(0)], NOW)).toEqual({ current: 1, best: 1 })
  })
  it('3 semaines consécutives → current 3, best 3', () => {
    expect(computeWeeklyStreak([log(0), log(7), log(14)], NOW)).toEqual({ current: 3, best: 3 })
  })
  it('semaine courante vide mais –1 et –2 actives → current 2 (pas cassée)', () => {
    expect(computeWeeklyStreak([log(7), log(14)], NOW)).toEqual({ current: 2, best: 2 })
  })
  it('trou : current = série récente, best = plus longue', () => {
    // actives : semaines 0,1 (current 2) ; trou en 2 ; 3,4,5 (run 3)
    expect(computeWeeklyStreak([log(0), log(7), log(21), log(28), log(35)], NOW)).toEqual({ current: 2, best: 3 })
  })
  it('série cassée (–2,–3 seules) → current 0, best 2', () => {
    expect(computeWeeklyStreak([log(14), log(21)], NOW)).toEqual({ current: 0, best: 2 })
  })
})

describe('BADGE_DEFINITIONS (invariants)', () => {
  it('ids uniques', () => {
    const ids = BADGE_DEFINITIONS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('seuils strictement croissants par thème', () => {
    const themes = {}
    for (const d of BADGE_DEFINITIONS) (themes[d.theme] ??= []).push(d.threshold)
    for (const arr of Object.values(themes)) {
      for (let i = 1; i < arr.length; i++) expect(arr[i]).toBeGreaterThan(arr[i - 1])
    }
  })
  it('labels fr+en présents', () => {
    for (const d of BADGE_DEFINITIONS) {
      expect(d.label.fr).toBeTruthy()
      expect(d.label.en).toBeTruthy()
    }
  })
  it('émojis uniques (aucune réutilisation entre paliers, quel que soit le thème)', () => {
    const emojis = BADGE_DEFINITIONS.map((d) => d.emoji)
    expect(new Set(emojis).size).toBe(emojis.length)
  })
  it('les 14 paliers ont un reward.banner qui existe dans BANNER_CATALOG', () => {
    const bannerIds = new Set(BANNER_CATALOG.map((b) => b.id))
    expect(BADGE_DEFINITIONS.length).toBe(14)
    for (const d of BADGE_DEFINITIONS) {
      expect(d.reward?.banner).toBeTruthy()
      expect(bannerIds.has(d.reward.banner)).toBe(true)
    }
  })
})

describe('computeBadges', () => {
  const noCountry = () => null
  it('0 log → tout verrouillé, isNextTier sur le 1er palier de chaque thème', () => {
    const badges = computeBadges([], noCountry, NOW)
    expect(badges.every((b) => !b.unlocked)).toBe(true)
    expect(badges.find((b) => b.id === 'volume-1').isNextTier).toBe(true)
    expect(badges.find((b) => b.id === 'world-3').isNextTier).toBe(true)
    expect(badges.find((b) => b.id === 'streak-3').isNextTier).toBe(true)
    expect(badges.find((b) => b.id === 'variety-10').isNextTier).toBe(true)
  })
  it('1 cuisine → volume-1 débloqué, volume-10 = prochain palier', () => {
    const badges = computeBadges([cook('a')], noCountry, NOW)
    expect(badges.find((b) => b.id === 'volume-1').unlocked).toBe(true)
    expect(badges.find((b) => b.id === 'volume-1').isNextTier).toBe(false)
    expect(badges.find((b) => b.id === 'volume-10').isNextTier).toBe(true)
    expect(unlockedIds(badges)).toContain('volume-1')
  })
  it('variété : 10 recettes différentes → variety-10 débloqué', () => {
    const logs = Array.from({ length: 10 }, (_, i) => cook('r' + i))
    expect(computeBadges(logs, noCountry, NOW).find((b) => b.id === 'variety-10').unlocked).toBe(true)
  })
  it('monde : 3 pays distincts → world-3 débloqué', () => {
    const map = { a: 'fr', b: 'it', c: 'jp' }
    const logs = [cook('a'), cook('b'), cook('c'), cook('a')]
    const resolve = (rid) => map[rid] ?? null
    expect(computeBadges(logs, resolve, NOW).find((b) => b.id === 'world-3').unlocked).toBe(true)
  })
  it('progression exposée (current/value/threshold)', () => {
    const logs = Array.from({ length: 7 }, (_, i) => cook('r' + i))
    const v10 = computeBadges(logs, noCountry, NOW).find((b) => b.id === 'variety-10')
    expect(v10.progress).toEqual({ current: 7, value: 7, threshold: 10 })
  })
})

describe('isBannerLocked / badgeForBanner', () => {
  it('bannière-récompense verrouillée sauf si débloquée ; bannière libre jamais verrouillée', () => {
    expect(isBannerLocked('veggies', [])).toBe(true)
    expect(isBannerLocked('veggies', ['veggies'])).toBe(false)
    expect(isBannerLocked('warm-sunset', [])).toBe(false) // bannière libre, jamais une récompense
  })
  it('badgeForBanner : retrouve le palier propriétaire, null pour une bannière libre', () => {
    expect(badgeForBanner('veggies').id).toBe('volume-1')
    expect(badgeForBanner('warm-sunset')).toBeNull()
  })
})

describe('computeNewlyUnlocked / nextReward', () => {
  const noCountry = () => null

  it('computeNewlyUnlocked : palier fraîchement débloqué + reward non pris → octroi ; idempotent', () => {
    const badges = computeBadges([cook('a')], noCountry, NOW) // volume-1 débloqué (reward veggies)
    const earned = computeNewlyUnlocked(badges, [])
    expect(earned).toContain('veggies')
    expect(computeNewlyUnlocked(badges, ['veggies'])).not.toContain('veggies')
  })

  it('nextReward : parmi les paliers à récompense non débloqués, le plus avancé', () => {
    // 8 recettes cuisinées la même semaine → volume-10 à 8/10 (0.8) ; streak-3 à 1/3 (0.33).
    // volume-1 (reward veggies) est déjà pris en compte comme débloqué+octroyé.
    const logs = Array.from({ length: 8 }, (_, i) => cook('r' + i))
    const badges = computeBadges(logs, noCountry, NOW)
    expect(nextReward(badges, ['veggies']).id).toBe('volume-10')
  })

  it('nextReward : à 0 partout (égalité de progression), départage vers le seuil le plus proche (volume-1)', () => {
    const badges = computeBadges([], noCountry, NOW)
    expect(nextReward(badges, []).id).toBe('volume-1')
  })

  it('nextReward : tout débloqué → null', () => {
    const badges = computeBadges([], noCountry, NOW)
    const allBanners = badges.map((b) => b.reward.banner)
    expect(nextReward(badges, allBanners)).toBeNull()
  })
})
