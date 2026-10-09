import { describe, it, expect } from 'vitest'
import { resolveFlag } from '@shared/lib/feature-flags/resolve-flag'

describe('resolveFlag', () => {
  it('renvoie la valeur du flag quand la clé existe (true)', () => {
    const map = new Map([['scan_barcode', true]])
    expect(resolveFlag(map, 'scan_barcode')).toBe(true)
  })
  it('renvoie la valeur du flag quand la clé existe (false)', () => {
    const map = new Map([['scan_barcode', false]])
    expect(resolveFlag(map, 'scan_barcode')).toBe(false)
  })
  it('renvoie le fallback (false par défaut) quand la clé est absente', () => {
    const map = new Map()
    expect(resolveFlag(map, 'inconnu')).toBe(false)
  })
  it('renvoie le fallback explicite quand la clé est absente', () => {
    const map = new Map()
    expect(resolveFlag(map, 'inconnu', true)).toBe(true)
  })
  it('tolère un map null/undefined → fallback', () => {
    expect(resolveFlag(null, 'x', true)).toBe(true)
    expect(resolveFlag(undefined, 'x')).toBe(false)
  })
})
