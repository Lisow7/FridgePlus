import { describe, it, expect } from 'vitest'
import { needsUsername } from '@features/auth/lib/needs-username'

describe('needsUsername', () => {
  it('false si pas de user', () => {
    expect(needsUsername(null, null)).toBe(false)
  })
  it('false tant que le profil n\'est pas chargé (anti-flash)', () => {
    expect(needsUsername({ id: 'u1' }, null)).toBe(false)
  })
  it('true si profil chargé et username non confirmé', () => {
    expect(needsUsername({ id: 'u1' }, { username_confirmed: false })).toBe(true)
  })
  it('false si username confirmé', () => {
    expect(needsUsername({ id: 'u1' }, { username_confirmed: true })).toBe(false)
  })
})
