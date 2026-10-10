import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Les notes des recettes (audit du 2026-10-04, PERF-12) : à chaque ouverture du
// panneau, SIX requêtes relisaient tous les avis des 515 recettes, ligne à
// ligne, et le navigateur faisait les moyennes — fausses sans bruit au-delà de
// la limite de 1 000 lignes de l'API, et un lot en échec passait sous silence.
// Désormais : une vue SQL `recipe_rating_aggregates` (moyenne et compte par
// recette, calculés par la base), lue en UNE requête, au plus une ligne par
// recette notée ; l'erreur est rendue.

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))
vi.mock('@shared/api/community', () => ({ signalerContenu: vi.fn() }))
vi.mock('@shared/api/public-profiles', () => ({ withAuthorProfiles: async (lignes) => lignes }))

import * as api from '@features/recipes/api/recipe-reviews'

function builder(reponse) {
  const b = {
    select: vi.fn(() => b), eq: () => b, in: vi.fn(() => b), is: () => b, order: () => b, limit: () => b,
    then: (resolve, reject) => Promise.resolve(reponse).then(resolve, reject),
  }
  return b
}
let tables
beforeEach(() => {
  tables = []
  mockFrom.mockReset()
})

describe('loadBulkAggregates : une lecture, par la base', () => {
  it('lit la vue des agrégats une seule fois, avec le compte exact, et ne garde que les recettes demandées', async () => {
    const b = builder({ data: [
      { recipe_id: 'omelette', avg: '4.3', count: 7 },
      { recipe_id: 'autre', avg: '2.0', count: 1 },
    ], error: null, count: 2 })
    mockFrom.mockImplementation((table) => { tables.push(table); return b })

    const { aggregates, error } = await api.loadBulkAggregates(['omelette', 'carbonara'])

    expect(tables).toEqual(['recipe_rating_aggregates'])
    expect(b.select).toHaveBeenCalledWith(expect.stringContaining('recipe_id'), { count: 'exact' })
    expect(b.in).not.toHaveBeenCalled() // pas de `in.(515 ids)` : l'URL ne grandit pas avec le catalogue
    expect(error).toBeNull()
    expect(aggregates).toEqual({ omelette: { avg: 4.3, count: 7 } })
  })

  it('rend l’erreur au lieu de l’avaler', async () => {
    mockFrom.mockImplementation(() => builder({ data: null, error: { message: 'panne' }, count: null }))
    const { aggregates, error } = await api.loadBulkAggregates(['omelette'])
    expect(aggregates).toEqual({})
    expect(error).toEqual({ message: 'panne' })
  })

  it('moins de lignes reçues que comptées : les notes servent, et l’erreur le dit', async () => {
    mockFrom.mockImplementation(() => builder({ data: [{ recipe_id: 'omelette', avg: '5', count: 1 }], error: null, count: 2 }))
    const { aggregates, error } = await api.loadBulkAggregates(['omelette'])
    expect(aggregates).toEqual({ omelette: { avg: 5, count: 1 } })
    expect(error?.message).toMatch(/tronqu/)
  })

  it('aucune recette demandée : rien ne part', async () => {
    const r = await api.loadBulkAggregates([])
    expect(r).toEqual({ aggregates: {}, error: null })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('l’ancienne agrégation ligne à ligne n’existe plus', () => {
    expect(api.listBulkAggregates).toBeUndefined()
    const source = readFileSync(resolve(process.cwd(), 'src/features/recipes/api/recipe-reviews.js'), 'utf8')
    expect(source).not.toContain('BULK_AGG_CHUNK')
  })
})

describe('le panneau des recettes', () => {
  it('lit les agrégats par la vue et dit l’erreur au journal', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/recipes/components/recipe-panel.jsx'), 'utf8')
    expect(source).toContain('loadBulkAggregates')
    expect(source).not.toContain('listBulkAggregates')
    expect(source).toMatch(/logError\(/)
  })
})

describe('la vue, sa sonde, le registre', () => {
  const MIGRATION = 'supabase/migrations/20261010014610_notes_en_une_lecture.sql'
  const SONDE = 'supabase/probes/20261009_notes_en_une_lecture.sql'
  const lire = (c) => readFileSync(resolve(process.cwd(), c), 'utf8')

  it('la migration crée la vue, sous les droits de l’appelant, lisible par tous', () => {
    expect(existsSync(resolve(process.cwd(), MIGRATION))).toBe(true)
    const sql = lire(MIGRATION)
    expect(sql).toMatch(/CREATE OR REPLACE VIEW public\.recipe_rating_aggregates/)
    expect(sql).toMatch(/security_invoker = true/)
    expect(sql).toMatch(/type = 'review'/)
    expect(sql).toMatch(/deleted_at IS NULL/)
    expect(sql).toMatch(/GROUP BY target_recipe_id/)
    expect(sql).toMatch(/GRANT SELECT ON public\.recipe_rating_aggregates TO anon, authenticated/)
  })

  it('sa sonde existe et n’écrit rien (un seul bloc DO, terminé par RAISE EXCEPTION)', () => {
    expect(existsSync(resolve(process.cwd(), SONDE))).toBe(true)
    const sonde = lire(SONDE)
    expect(sonde.match(/DO \$probe\$/g)).toHaveLength(1)
    expect(sonde).toMatch(/RAISE EXCEPTION 'SONDE notes_en_une_lecture/)
  })

  it('le registre la liste comme en attente de la confirmation d’Antoine', () => {
    const readme = lire('supabase/migrations/README.md')
    expect(readme).toContain('20261010014610_notes_en_une_lecture.sql')
    expect(readme).toMatch(/notes_en_une_lecture[\s\S]{0,400}confirmation d'Antoine|confirmation d'Antoine[\s\S]{0,400}notes_en_une_lecture/)
  })
})
