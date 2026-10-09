import { describe, it, expect } from 'vitest'
import { optimizeStorageImage } from '@shared/lib/images/optimize-storage-image'

const OBJ = 'https://x.supabase.co/storage/v1/object/public/ingredient-icons/vg-salade-verte.webp'

describe('optimizeStorageImage', () => {
  it('réécrit vers la vignette pré-générée (thumb/) via endpoint objet', () => {
    expect(optimizeStorageImage(OBJ, 48)).toBe(
      'https://x.supabase.co/storage/v1/object/public/ingredient-icons/thumb/vg-salade-verte.webp',
    )
  })

  it('gère aussi le bucket recipe-photos', () => {
    const r = 'https://x.supabase.co/storage/v1/object/public/recipe-photos/carbonara.webp'
    expect(optimizeStorageImage(r)).toBe(
      'https://x.supabase.co/storage/v1/object/public/recipe-photos/thumb/carbonara.webp',
    )
  })

  it('ne double pas le préfixe si déjà une vignette', () => {
    const t = 'https://x.supabase.co/storage/v1/object/public/ingredient-icons/thumb/vg-salade-verte.webp'
    expect(optimizeStorageImage(t)).toBe(t)
  })

  it('laisse intacts les buckets hors catalogue (avatars, bannières…)', () => {
    const a = 'https://x.supabase.co/storage/v1/object/public/avatars/x.webp'
    expect(optimizeStorageImage(a)).toBe(a)
  })

  it('laisse intactes les URLs non-Supabase (twemoji, fluent, externes)', () => {
    const ext = 'https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/svg/1f345.svg'
    expect(optimizeStorageImage(ext, 24)).toBe(ext)
  })

  it('gère null / non-string sans planter', () => {
    expect(optimizeStorageImage(null, 24)).toBe(null)
    expect(optimizeStorageImage(undefined, 24)).toBe(undefined)
  })
})
