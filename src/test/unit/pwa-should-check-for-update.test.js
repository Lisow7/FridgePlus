import { describe, it, expect } from 'vitest'
import { shouldCheckForUpdate } from '@features/pwa/lib/should-check-for-update'

describe('shouldCheckForUpdate', () => {
  it('autorise le tout premier check (aucun check précédent)', () => {
    expect(shouldCheckForUpdate(null, 1_000, 60_000)).toBe(true)
  })

  it('bloque un check déclenché juste après le précédent (dans la fenêtre de throttle)', () => {
    expect(shouldCheckForUpdate(1_000, 1_500, 60_000)).toBe(false)
  })

  it('autorise un check déclenché après expiration du délai de throttle', () => {
    expect(shouldCheckForUpdate(1_000, 61_001, 60_000)).toBe(true)
  })

  it('autorise un check exactement à la limite du délai (inclusif)', () => {
    expect(shouldCheckForUpdate(1_000, 61_000, 60_000)).toBe(true)
  })
})
