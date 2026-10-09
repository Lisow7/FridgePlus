import { describe, it, expect } from 'vitest'
import { parseDurations, formatDuration } from '@shared/lib/recipes/parse-durations'

describe('parseDurations', () => {
  it('détecte une durée en minutes simple (fr)', () => {
    const r = parseDurations('Cuire 15 min à feu doux')
    expect(r).toHaveLength(1)
    expect(r[0].minutes).toBe(15)
    expect(r[0].label).toBe('15 min')
  })

  it('détecte plusieurs durées dans une étape', () => {
    const r = parseDurations('Préchauffer le four 10 min puis cuire 30 minutes')
    expect(r).toHaveLength(2)
    expect(r[0].minutes).toBe(10)
    expect(r[1].minutes).toBe(30)
  })

  it('détecte heures seules', () => {
    const r = parseDurations('Laisser reposer 2 heures au frais')
    expect(r).toHaveLength(1)
    expect(r[0].minutes).toBe(120)
  })

  it('détecte composé h+min « 1h30 »', () => {
    const r = parseDurations('Cuire au four 1h30 à 180°C')
    expect(r).toHaveLength(1)
    expect(r[0].minutes).toBe(90)
    expect(r[0].label).toBe('1h30')
  })

  it('détecte composé h+min avec espaces « 1 h 30 »', () => {
    const r = parseDurations('Cuire 1 h 30 au four')
    expect(r).toHaveLength(1)
    expect(r[0].minutes).toBe(90)
  })

  it('élimine les chevauchements (garde le plus long)', () => {
    const r = parseDurations('Cuire 1h30 ensuite')
    // « 1h30 » et « 1 h » se chevauchent — garde 1h30 (90 min)
    expect(r).toHaveLength(1)
    expect(r[0].minutes).toBe(90)
  })

  it('détecte secondes pour cuisson rapide', () => {
    const r = parseDurations('Plonger 30 sec dans l\'eau bouillante')
    expect(r).toHaveLength(1)
    expect(r[0].minutes).toBe(0.5)
  })

  it('ignore les durées trop courtes (< 10 sec)', () => {
    expect(parseDurations('Mélanger 5 sec')).toHaveLength(0)
  })

  it('ignore les durées > 24h (probablement année)', () => {
    expect(parseDurations('Affiner 2 ans en cave')).toHaveLength(0)
  })

  it('détecte les variantes anglaises', () => {
    expect(parseDurations('Bake for 30 minutes')[0].minutes).toBe(30)
    expect(parseDurations('Cook 2 hours')[0].minutes).toBe(120)
  })

  it('détecte les variantes espagnoles', () => {
    expect(parseDurations('Cocinar 20 minutos')[0].minutes).toBe(20)
    expect(parseDurations('Reposar 1 hora')[0].minutes).toBe(60)
  })

  it('détecte les variantes allemandes', () => {
    expect(parseDurations('15 Minuten kochen')[0].minutes).toBe(15)
  })

  it('détecte les variantes japonaises', () => {
    expect(parseDurations('15分加熱する')[0].minutes).toBe(15)
  })

  it('retourne un tableau vide si pas de durée', () => {
    expect(parseDurations('Mélanger les ingrédients')).toEqual([])
  })

  it('retourne un tableau vide pour input invalide', () => {
    expect(parseDurations(null)).toEqual([])
    expect(parseDurations(undefined)).toEqual([])
    expect(parseDurations(42)).toEqual([])
    expect(parseDurations('')).toEqual([])
  })
})

describe('formatDuration', () => {
  it('formate les minutes simples', () => {
    expect(formatDuration(15)).toBe('15 min')
  })
  it('formate les heures sans minute', () => {
    expect(formatDuration(120)).toBe('2 h')
  })
  it('formate heures + minutes', () => {
    expect(formatDuration(90)).toBe('1 h 30')
  })
  it('formate les secondes (< 1 min)', () => {
    expect(formatDuration(0.5)).toBe('30 sec')
  })
  it('utilise les labels par langue', () => {
    // Sprint 7 PR S7.d — DE/JA retirés.
    expect(formatDuration(15, 'en')).toBe('15 min')
    expect(formatDuration(120, 'en')).toBe('2 h')
  })
})
