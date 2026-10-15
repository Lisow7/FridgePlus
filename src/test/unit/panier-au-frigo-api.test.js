import { describe, it, expect, vi, beforeEach } from 'vitest'

// `mettreAuFrigo` : l'écriture au frigo de « J'ai fait mes courses », dans
// l'API du panier (lot « accès à la base rangés », audit du 2026-10-04,
// ARCH-13 (6)). Elle était faite en direct par le hook, son résultat jeté.

const mockUpsert = vi.hoisted(() => vi.fn())
const mockLog = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: () => ({ upsert: mockUpsert }) } }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: mockLog }))

import { mettreAuFrigo } from '@features/cart/api/basket'

beforeEach(() => { mockUpsert.mockReset(); mockLog.mockReset() })

describe('mettreAuFrigo', () => {
  it('une ligne par ingrédient, et un ingrédient déjà au frigo n’est pas une erreur', async () => {
    mockUpsert.mockResolvedValue({ error: null })
    expect(await mettreAuFrigo('u-1', ['fr-tomate', 'vg-carotte'])).toEqual({ error: null })
    expect(mockUpsert).toHaveBeenCalledWith(
      [{ user_id: 'u-1', ingredient_id: 'fr-tomate' }, { user_id: 'u-1', ingredient_id: 'vg-carotte' }],
      { onConflict: 'user_id,ingredient_id', ignoreDuplicates: true },
    )
  })

  it('la base refuse : l’erreur est rendue et journalisée', async () => {
    const refus = { message: 'permission denied', code: '42501' }
    mockUpsert.mockResolvedValue({ error: refus })
    expect(await mettreAuFrigo('u-1', ['fr-tomate'])).toEqual({ error: refus })
    expect(mockLog).toHaveBeenCalledWith(refus, expect.objectContaining({ tag: 'basket.mettreAuFrigo' }))
  })

  it('rien à mettre : aucune requête', async () => {
    expect(await mettreAuFrigo('u-1', [])).toEqual({ error: null })
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
