import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bug 2026-07-17 : ré-avis après auto-suppression (soft-delete) échouait en
// 403 RLS car la policy engagement_update exigeait deleted_at IS NULL, qui
// bloquait TOUTE reprise d'une ligne soft-deleted par son auteur (corrigé en
// base : la policy exige maintenant deleted_by_admin = false, alignée sur
// community_posts/community_replies). Mais la policy seule ne suffit pas :
// l'upsert doit aussi remettre deleted_at à null explicitement, sinon la
// ligne redevient modifiable mais reste invisible/non comptabilisée pour
// tout le monde sauf l'auteur (cf. engagement_select).

const mockUpsert = vi.hoisted(() => vi.fn())
const mockSingle = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    from: () => ({ upsert: mockUpsert }),
  },
}))

import { upsertReview } from '@features/recipes/api/recipe-reviews'

describe('upsertReview — revit une ligne auto-supprimée', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({
      data: { id: 'e1', user_id: 'u1', target_recipe_id: 'rec1', rating: 5, body: null, created_at: '2026-07-17', updated_at: '2026-07-17' },
      error: null,
    })
    mockUpsert.mockReturnValue({ select: () => ({ single: mockSingle }) })
  })

  it('inclut deleted_at: null dans le payload upsert', async () => {
    await upsertReview('u1', { recipeId: 'rec1', recipeSource: 'base', rating: 5, body: 'Très bon' })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: null }),
      { onConflict: 'user_id,type,target_recipe_id' },
    )
  })
})
