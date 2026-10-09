import { describe, it, expect, vi, beforeEach } from 'vitest'

const etat = vi.hoisted(() => ({ reponse: { data: [], error: null } }))
vi.mock('@shared/lib/supabase/client', () => {
  const requete = {
    select: () => requete, eq: () => requete, is: () => requete, order: () => requete,
    limit: () => Promise.resolve(etat.reponse),
  }
  return { supabase: { from: () => requete } }
})

import { loadReviews, listReviews } from '@features/recipes/api/recipe-reviews'

// Hors audit, trouvé le 2026-10-05 : la lecture des avis rendait une liste vide
// sur erreur, et la section affichait « Pas encore d'avis. Sois le premier à
// noter ! » pour des avis qui n'avaient simplement pas pu être lus.
const LIGNE = { id: 'a1', user_id: 'u1', target_recipe_id: 'r1', rating: 4, body: 'Bon', created_at: '2026-09-01T10:00:00Z' }
const PANNE = { message: 'Failed to fetch' }

describe('loadReviews — « pas chargés » n’est pas « pas encore d’avis »', () => {
  beforeEach(() => { etat.reponse = { data: [LIGNE], error: null } })

  it('lecture acceptée : les avis, mis en forme, sans erreur', async () => {
    const { reviews, error } = await loadReviews('r1', 'base')
    expect(error).toBeNull()
    expect(reviews).toEqual([expect.objectContaining({ id: 'a1', recipe_id: 'r1', recipe_source: 'base', rating: 4 })])
  })

  it('lecture refusée : l’erreur est rendue', async () => {
    etat.reponse = { data: null, error: PANNE }
    expect(await loadReviews('r1', 'base')).toEqual({ reviews: [], error: PANNE })
  })

  it('recette sans avis : une liste vide, SANS erreur', async () => {
    etat.reponse = { data: [], error: null }
    expect(await loadReviews('r1', 'base')).toEqual({ reviews: [], error: null })
  })

  it('source inconnue ou recette absente : rien à lire, pas d’erreur', async () => {
    etat.reponse = { data: null, error: PANNE }
    expect(await loadReviews('', 'base')).toEqual({ reviews: [], error: null })
    expect(await loadReviews('r1', 'ailleurs')).toEqual({ reviews: [], error: null })
  })

  // `listReviews` reste pour le badge ⭐ de l'en-tête, qui n'affiche rien sans avis.
  it('`listReviews` rend la liste seule — vide sur erreur', async () => {
    expect(await listReviews('r1', 'base')).toHaveLength(1)
    etat.reponse = { data: null, error: PANNE }
    expect(await listReviews('r1', 'base')).toEqual([])
  })
})
