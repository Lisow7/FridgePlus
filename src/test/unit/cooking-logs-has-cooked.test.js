import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = { count: 0, error: null }
const builder = {
  select() { return this }, eq() { return this }, limit() { return Promise.resolve({ count: state.count, error: state.error }) },
}
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: () => builder } }))

import { hasCookedAtLeastOnce } from '@shared/api/cooking-logs'

describe('hasCookedAtLeastOnce', () => {
  beforeEach(() => { state.count = 0; state.error = null })
  it('false si userId absent (pas de requête)', async () => {
    expect(await hasCookedAtLeastOnce(null)).toBe(false)
  })
  it('false si 0 log', async () => {
    state.count = 0
    expect(await hasCookedAtLeastOnce('u1')).toBe(false)
  })
  it('true si ≥ 1 log', async () => {
    state.count = 1
    expect(await hasCookedAtLeastOnce('u1')).toBe(true)
  })
  it('false si erreur', async () => {
    state.error = { message: 'x' }
    expect(await hasCookedAtLeastOnce('u1')).toBe(false)
  })
})
