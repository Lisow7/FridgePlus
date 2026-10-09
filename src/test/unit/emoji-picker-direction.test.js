import { describe, it, expect } from 'vitest'
import { pickReactionPickerSide } from '@features/community/lib/emoji-picker-direction'

describe('pickReactionPickerSide', () => {
  it('ouvre à droite quand il y a assez de place', () => {
    expect(pickReactionPickerSide(300)).toBe('right')
  })

  it('ouvre au-dessus (fallback) quand la place à droite est insuffisante', () => {
    expect(pickReactionPickerSide(80)).toBe('above')
  })

  it('la limite exacte (== largeur estimée) compte comme suffisante', () => {
    expect(pickReactionPickerSide(200, 200)).toBe('right')
  })

  it('accepte une largeur estimée personnalisée', () => {
    expect(pickReactionPickerSide(150, 120)).toBe('right')
    expect(pickReactionPickerSide(100, 120)).toBe('above')
  })
})
