import { describe, it, expect, vi, beforeEach } from 'vitest'

const etat = vi.hoisted(() => ({ lignes: [], count: 0, error: null }))

// Une requête simulée : elle se résout sur `.limit()` (listes) ou directement
// (compte), avec l'erreur du moment.
vi.mock('@shared/lib/supabase/client', () => {
  const reponse = () => Promise.resolve(etat.error
    ? { data: null, count: null, error: etat.error }
    : { data: etat.lignes, count: etat.count, error: null })
  const requete = {
    select: () => requete, eq: () => requete, order: () => requete,
    limit: () => reponse(),
    then: (resolu, rejete) => reponse().then(resolu, rejete),
  }
  return { supabase: { from: () => requete } }
})

import * as api from '@shared/api/cooking-logs'

const { loadRecentCookingLogs, loadAllCookingLogs, loadCookingLogsCount } = api

// Audit du 2026-10-04, CPT-11. Les lectures du journal rendaient une liste vide
// quand la base refusait : « pas chargé » et « jamais cuisiné » étaient le même
// résultat, et les onglets Activité et Récompenses affichaient leur état vide.
// Les `load…` disent l'échec.
const LOG = { id: 'l1', recipe_id: 'r1', recipe_source: 'base', servings: 2, cooked_at: '2026-05-10T10:00:00Z' }
const PANNE = { message: 'Failed to fetch' }

describe('lectures du journal de cuisine', () => {
  beforeEach(() => { etat.lignes = [LOG]; etat.count = 1; etat.error = null })

  describe('load… — disent l’échec', () => {
    it('lecture acceptée : les lignes, sans erreur', async () => {
      expect(await loadRecentCookingLogs('u1')).toEqual({ logs: [LOG], error: null })
      expect(await loadAllCookingLogs('u1')).toEqual({ logs: [LOG], error: null })
      expect(await loadCookingLogsCount('u1')).toEqual({ count: 1, error: null })
    })

    it('lecture refusée : l’erreur est rendue — ce n’est pas un journal vide', async () => {
      etat.error = PANNE
      expect(await loadRecentCookingLogs('u1')).toEqual({ logs: [], error: PANNE })
      expect(await loadAllCookingLogs('u1')).toEqual({ logs: [], error: PANNE })
      expect(await loadCookingLogsCount('u1')).toEqual({ count: 0, error: PANNE })
    })

    it('journal réellement vide : une liste vide, SANS erreur', async () => {
      etat.lignes = []; etat.count = 0
      expect(await loadRecentCookingLogs('u1')).toEqual({ logs: [], error: null })
      expect(await loadAllCookingLogs('u1')).toEqual({ logs: [], error: null })
      expect(await loadCookingLogsCount('u1')).toEqual({ count: 0, error: null })
    })

    it('sans compte : rien à lire, pas d’erreur', async () => {
      etat.error = PANNE
      expect(await loadRecentCookingLogs(null)).toEqual({ logs: [], error: null })
      expect(await loadAllCookingLogs(null)).toEqual({ logs: [], error: null })
      expect(await loadCookingLogsCount(null)).toEqual({ count: 0, error: null })
    })
  })

  // Les anciennes lectures (`list…`, `count…`) rendaient du vide sur erreur ;
  // plus personne ne les appelait. Si l'une revenait, un écran pourrait de
  // nouveau confondre « pas chargé » et « rien ».
  it('les lectures `list…` et `count…`, qui rendaient du vide sur erreur, ont disparu', () => {
    expect(Object.keys(api).filter((nom) => /^(list|count)/.test(nom))).toEqual([])
  })
})
