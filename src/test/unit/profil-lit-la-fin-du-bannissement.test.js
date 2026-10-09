import { describe, it, expect, vi } from 'vitest'

const lu = vi.hoisted(() => ({ colonnes: null }))
vi.mock('@shared/lib/supabase/client', () => {
  const r = {
    select: (colonnes) => { lu.colonnes = colonnes; return r },
    eq: () => r,
    single: () => Promise.resolve({ data: { id: 'u-1' }, error: null }),
  }
  return { supabase: { from: () => r } }
})

import { fetchProfile } from '@shared/lib/auth/fetch-profile'

// L'écran « Compte suspendu » suit la date de fin (`estBanni`, audit CPT-17) :
// sans `banned_until` dans le profil, un bannissement daté et échu passerait
// pour un bannissement sans fin jusqu'à la levée par la base.
describe('Le profil lit le bannissement entier', () => {
  it('le drapeau, le motif et la date de fin', async () => {
    await fetchProfile('u-1')
    const colonnes = lu.colonnes.split(',').map((c) => c.trim())
    expect(colonnes).toEqual(expect.arrayContaining(['banned', 'banned_reason', 'banned_until']))
  })
})
