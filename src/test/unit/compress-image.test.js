import { describe, it, expect } from 'vitest'
import { computeScaledDimensions } from '@shared/lib/media/compress-image'

describe('computeScaledDimensions', () => {
  it('ne change rien si l\'image est déjà sous la limite', () => {
    expect(computeScaledDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('réduit proportionnellement si la largeur dépasse la limite', () => {
    expect(computeScaledDimensions(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it('réduit proportionnellement si la hauteur dépasse la limite (portrait)', () => {
    expect(computeScaledDimensions(1200, 4000, 1600)).toEqual({ width: 480, height: 1600 })
  })

  it('ne remonte jamais l\'échelle au-delà de 1 (jamais d\'agrandissement)', () => {
    expect(computeScaledDimensions(400, 300, 1600)).toEqual({ width: 400, height: 300 })
  })
})
