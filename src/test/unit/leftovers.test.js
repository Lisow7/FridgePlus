import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDaysLeft, isLeftoverExpired, isLeftoverSaved } from '@features/fridge/api/leftovers'

describe('isLeftoverSaved — supprimé avant la DLC', () => {
  it('vrai si supprimé avant expires_at', () => {
    expect(isLeftoverSaved({ deleted_at: '2026-06-01T10:00:00Z', expires_at: '2026-06-03T00:00:00Z' })).toBe(true)
  })
  it('vrai si supprimé pile à la DLC (limite incluse)', () => {
    expect(isLeftoverSaved({ deleted_at: '2026-06-03T00:00:00Z', expires_at: '2026-06-03T00:00:00Z' })).toBe(true)
  })
  it('faux si supprimé après la DLC (gaspillé)', () => {
    expect(isLeftoverSaved({ deleted_at: '2026-06-05T10:00:00Z', expires_at: '2026-06-03T00:00:00Z' })).toBe(false)
  })
  it('faux si encore actif (deleted_at null)', () => {
    expect(isLeftoverSaved({ deleted_at: null, expires_at: '2026-06-03T00:00:00Z' })).toBe(false)
  })
})

// Helper : retourne une ISO string pour un offset en jours par rapport à minuit local
function isoFromTodayMidnight(daysOffset, hour = 12) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, 0, 0, 0) // peu importe l'heure, getDaysLeft compare au minuit
  return d.toISOString()
}

describe('getDaysLeft — sémantique calendaire', () => {
  it('renvoie 0 quand expires_at est aujourd\'hui (dernier jour, encore actif)', () => {
    expect(getDaysLeft(isoFromTodayMidnight(0))).toBe(0)
  })
  it('renvoie 1 quand expires_at est demain', () => {
    expect(getDaysLeft(isoFromTodayMidnight(1))).toBe(1)
  })
  it('renvoie 3 quand expires_at est dans 3 jours', () => {
    expect(getDaysLeft(isoFromTodayMidnight(3))).toBe(3)
  })
  it('renvoie une valeur négative si expires_at est passée', () => {
    expect(getDaysLeft(isoFromTodayMidnight(-1))).toBe(-1)
    expect(getDaysLeft(isoFromTodayMidnight(-3))).toBe(-3)
  })

  describe('robustesse heure de la journée', () => {
    let originalNow
    beforeEach(() => {
      // Fige la date courante à 14h local pour tester la sémantique calendaire
      originalNow = Date.now
      const fixed = new Date()
      fixed.setHours(14, 0, 0, 0)
      Date.now = () => fixed.getTime()
    })
    afterEach(() => { Date.now = originalNow })

    it('reste 0 (= aujourd\'hui) que expires_at soit à 6h ou 22h le même jour', () => {
      const today6 = new Date()
      today6.setHours(6, 0, 0, 0)
      const today22 = new Date()
      today22.setHours(22, 0, 0, 0)
      // Les deux sont "aujourd'hui" → daysLeft doit être 0
      expect(getDaysLeft(today6.toISOString())).toBe(0)
      expect(getDaysLeft(today22.toISOString())).toBe(0)
    })
  })
})

describe('isLeftoverExpired', () => {
  it('false pour aujourd\'hui (le dernier jour est encore consommable)', () => {
    expect(isLeftoverExpired(isoFromTodayMidnight(0))).toBe(false)
  })
  it('false pour les jours futurs', () => {
    expect(isLeftoverExpired(isoFromTodayMidnight(1))).toBe(false)
    expect(isLeftoverExpired(isoFromTodayMidnight(5))).toBe(false)
  })
  it('true uniquement quand la date de péremption est passée', () => {
    expect(isLeftoverExpired(isoFromTodayMidnight(-1))).toBe(true)
    expect(isLeftoverExpired(isoFromTodayMidnight(-7))).toBe(true)
  })
})
