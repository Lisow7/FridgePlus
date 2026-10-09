import { describe, it, expect, beforeEach } from 'vitest'
import { readSeen, diffNewlyUnlocked, seedIfAbsent, SEEN_KEY } from '@shared/lib/recipes/badges-seen'

beforeEach(() => localStorage.clear())

describe('badges-seen', () => {
  it('readSeen vide par défaut', () => {
    expect(readSeen()).toEqual([])
  })
  it('readSeen tolère une valeur corrompue', () => {
    localStorage.setItem(SEEN_KEY, 'pas du json')
    expect(readSeen()).toEqual([])
  })
  it('diffNewlyUnlocked = ids débloqués non vus', () => {
    expect(diffNewlyUnlocked(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c'])
  })
  it('seedIfAbsent : seed silencieux au 1er appel (anti-flood)', () => {
    const r = seedIfAbsent(['a', 'b'])
    expect(r).toEqual({ seeded: true, toCelebrate: [] })
    expect(readSeen().sort()).toEqual(['a', 'b'])
  })
  it('seedIfAbsent : après seed, ne célèbre que les nouveaux + les mémorise', () => {
    seedIfAbsent(['a', 'b'])
    const r = seedIfAbsent(['a', 'b', 'c'])
    expect(r.seeded).toBe(false)
    expect(r.toCelebrate).toEqual(['c'])
    expect(readSeen().sort()).toEqual(['a', 'b', 'c'])
  })
  it('seedIfAbsent : clé vide (présente mais []) ≠ absente → célèbre', () => {
    localStorage.setItem(SEEN_KEY, '[]')
    const r = seedIfAbsent(['a'])
    expect(r.seeded).toBe(false)
    expect(r.toCelebrate).toEqual(['a'])
  })
})
