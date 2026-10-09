import { describe, it, expect, beforeEach } from 'vitest'
import { savePanelScroll, peekPanelScroll, clearPanelScroll } from '@shared/lib/scroll/scroll-memory'

const KEY = 'test-scroll'

describe('scroll-memory', () => {
  beforeEach(() => sessionStorage.clear())

  it('sauve puis relit la position', () => {
    savePanelScroll(KEY, { y: 420, count: 150 })
    expect(peekPanelScroll(KEY)).toEqual({ y: 420, count: 150, anchorId: null, anchorOffset: 0 })
  })

  it('peek est pur (ne consomme pas) — relire donne le même résultat', () => {
    savePanelScroll(KEY, { y: 100, count: 50 })
    expect(peekPanelScroll(KEY)).toEqual({ y: 100, count: 50, anchorId: null, anchorOffset: 0 })
    expect(peekPanelScroll(KEY)).toEqual({ y: 100, count: 50, anchorId: null, anchorOffset: 0 })
  })

  it('clear supprime la valeur → peek = null ensuite', () => {
    savePanelScroll(KEY, { y: 100, count: 50 })
    clearPanelScroll(KEY)
    expect(peekPanelScroll(KEY)).toBeNull()
  })

  it('retourne null si rien de sauvé', () => {
    expect(peekPanelScroll(KEY)).toBeNull()
  })

  it('défauts robustes si champs manquants', () => {
    savePanelScroll(KEY, {})
    expect(peekPanelScroll(KEY)).toEqual({ y: 0, count: 0, anchorId: null, anchorOffset: 0 })
  })

  it('garde la carte d’ancrage et son écart (retour de recette, 2026-10-02)', () => {
    savePanelScroll(KEY, { y: 1512, count: 50, anchorId: 'albondigas', anchorOffset: -220 })
    expect(peekPanelScroll(KEY)).toEqual({ y: 1512, count: 50, anchorId: 'albondigas', anchorOffset: -220 })
  })

  it('ignore une entrée corrompue', () => {
    sessionStorage.setItem(KEY, 'pas-du-json')
    expect(peekPanelScroll(KEY)).toBeNull()
  })
})
