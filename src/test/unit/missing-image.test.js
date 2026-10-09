import { describe, it, expect } from 'vitest'
import { hasNoImage, countMissingImages } from '@features/admin/lib/missing-image'

describe('hasNoImage', () => {
  it('base : image_url absent/vide → true', () => {
    expect(hasNoImage({ image_url: null })).toBe(true)
    expect(hasNoImage({ image_url: '' })).toBe(true)
    expect(hasNoImage({ image_url: '   ' })).toBe(true)
    expect(hasNoImage({})).toBe(true)
  })
  it('base : image_url renseigné → false', () => {
    expect(hasNoImage({ image_url: 'https://x/y.png' })).toBe(false)
  })
  it('communauté : data.image_url absent/vide → true, renseigné → false', () => {
    expect(hasNoImage({ data: { image_url: '' } })).toBe(true)
    expect(hasNoImage({ data: {} })).toBe(true)
    expect(hasNoImage({ data: { image_url: 'https://x/y.png' } })).toBe(false)
  })
})

describe('countMissingImages', () => {
  it('compte les recettes sans image (formes mixtes)', () => {
    const list = [
      { image_url: 'https://x.png' },
      { image_url: '' },
      { data: { image_url: 'https://y.png' } },
      { data: {} },
    ]
    expect(countMissingImages(list)).toBe(2)
  })
})
