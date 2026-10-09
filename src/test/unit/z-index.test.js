import { describe, it, expect } from 'vitest'
import { Z_INDEX } from '@shared/lib/z-index'

describe('Z_INDEX.CONFIRM', () => {
  it('est strictement au-dessus de TOP_MODAL', () => {
    expect(Z_INDEX.CONFIRM).toBeGreaterThan(Z_INDEX.TOP_MODAL)
  })

  it('reste sous les surcouches système (VOICE_PANEL)', () => {
    expect(Z_INDEX.CONFIRM).toBeLessThan(Z_INDEX.VOICE_PANEL)
  })
})
