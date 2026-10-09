import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertion = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: () => ({ insert: insertion }) } }))

import { logCooking } from '@shared/api/cooking-logs'

// Hors audit, trouvé le 2026-10-05. « J'ai cuisiné » : `logCooking` ne rendait
// rien. Les appelants enchaînaient donc la célébration du badge et l'invite à
// noter même quand rien n'était noté — et la fiche affichait « Ajoutée à ton
// journal de cuisine ».
const ENTREE = { recipeId: 'r1', recipeSource: 'base', servings: 2 }
const PANNE = { message: 'Failed to fetch' }

describe('logCooking — dit si le plat est noté au journal', () => {
  beforeEach(() => { insertion.mockReset(); insertion.mockResolvedValue({ error: null }) })

  it('la base accepte : aucune erreur', async () => {
    expect(await logCooking('u1', ENTREE)).toEqual({ error: null })
    expect(insertion).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', recipe_id: 'r1', recipe_source: 'base', servings: 2 }))
  })

  it('la base refuse : l’erreur est rendue', async () => {
    insertion.mockResolvedValue({ error: PANNE })
    expect(await logCooking('u1', ENTREE)).toEqual({ error: PANNE })
  })

  it('un appel qui lève (réseau coupé) : l’erreur est rendue, sans exception', async () => {
    insertion.mockRejectedValue(new TypeError('Failed to fetch'))
    const resultat = await logCooking('u1', ENTREE)
    expect(resultat.error).toBeTruthy()
  })

  it('il manque de quoi noter (compte, recette ou source) : rien ne part, et ce n’est PAS un succès', async () => {
    for (const [compte, entree] of [[null, ENTREE], ['u1', { ...ENTREE, recipeId: '' }], ['u1', { ...ENTREE, recipeSource: undefined }]]) {
      const resultat = await logCooking(compte, entree)
      expect(resultat.error).toBeTruthy()
    }
    expect(insertion).not.toHaveBeenCalled()
  })
})
