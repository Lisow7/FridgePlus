import { describe, it, expect } from 'vitest'
import { parseDurations } from '../../../features/cooking-mode/lib/duration-parser'

describe('parseDurations — FR', () => {
  it('extrait minutes', () => {
    const result = parseDurations('Cuire 10 min à feu doux', 'fr')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ seconds: 600, label: '10 min' })
  })
  it('extrait minutes au pluriel', () => {
    expect(parseDurations('Faire revenir 5 minutes', 'fr')[0].seconds).toBe(300)
  })
  it('extrait heures', () => {
    expect(parseDurations('Laisser reposer 1 h', 'fr')[0].seconds).toBe(3600)
  })
  it('extrait secondes', () => {
    expect(parseDurations('Mélanger 30 secondes', 'fr')[0].seconds).toBe(30)
  })
  it('extrait plusieurs durées triées par position', () => {
    const result = parseDurations('Cuire 10 min puis 5 min de plus', 'fr')
    expect(result).toHaveLength(2)
    expect(result[0].seconds).toBe(600)
    expect(result[1].seconds).toBe(300)
    expect(result[0].index).toBeLessThan(result[1].index)
  })
  it('extrait décimaux avec virgule', () => {
    expect(parseDurations('1,5 minute', 'fr')[0].seconds).toBe(90)
  })
  it('retourne vide si aucune durée', () => {
    expect(parseDurations('Saler et poivrer', 'fr')).toEqual([])
  })
})

describe('parseDurations — EN', () => {
  it('extrait minutes EN', () => {
    expect(parseDurations('Cook for 10 minutes', 'en')[0].seconds).toBe(600)
  })
  it('extrait hours EN', () => {
    expect(parseDurations('Bake 1 hour', 'en')[0].seconds).toBe(3600)
  })
  it('extrait seconds EN', () => {
    expect(parseDurations('Stir for 30 seconds', 'en')[0].seconds).toBe(30)
  })
})
