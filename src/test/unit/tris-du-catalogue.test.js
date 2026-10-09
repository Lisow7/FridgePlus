import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit du 2026-10-04, ADM-10 : le tri « Nom / ID / Type » des Ingrédients et
// des Recettes de base ne triait que les 50 lignes de la page affichée — la
// base, elle, rendait la page dans son ordre (sous-catégorie, identifiant).
// « Nom » montrait donc les 50 premiers ingrédients de la sous-catégorie, triés
// entre eux, et non le début de l'alphabet. Le tri se fait désormais côté base,
// sur tout le catalogue (PostgREST trie bien sur `labels->>fr` : vérifié le
// 2026-10-08 sur la vraie API, en lecture seule) ; l'identifiant départage les
// égalités, pour qu'une ligne ne saute pas d'une page à l'autre.

const etat = vi.hoisted(() => ({ requetes: [] }))
vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, filtres: [] }
    etat.requetes.push(trace)
    const q = {}
    for (const f of ['eq', 'neq', 'in', 'is', 'not', 'like', 'ilike', 'or', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range']) {
      q[f] = (...a) => { trace.filtres.push([f, ...a]); return q }
    }
    q.select = () => q
    q.then = (ok, ko) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko)
    return q
  }
  return { supabase: { from: (table) => requete(table) } }
})

import { adminGetIngredients } from '@features/admin/api/admin'
import { adminFindOfficialRecipesPaginated } from '@shared/lib/recipes/recipes-repository'

beforeEach(() => { etat.requetes = [] })
const ordres = (table) => etat.requetes.filter((r) => r.table === table).flatMap((r) => r.filtres).filter((f) => f[0] === 'order').map((f) => f[1])

describe('ingrédients : le tri porte sur tout le catalogue', () => {
  it('par nom', async () => {
    await adminGetIngredients({ sort: 'name' })
    expect(ordres('ingredients')).toEqual(['labels->>fr', 'id'])
  })
  it('par identifiant', async () => {
    await adminGetIngredients({ sort: 'id' })
    expect(ordres('ingredients')).toEqual(['id'])
  })
  it('par défaut : sous-catégorie, rang, puis identifiant', async () => {
    await adminGetIngredients({})
    expect(ordres('ingredients')).toEqual(['subcategory', 'sort_order', 'id'])
  })
})

describe('recettes de base : le tri porte sur tout le catalogue', () => {
  it('par nom', async () => {
    await adminFindOfficialRecipesPaginated({ sort: 'name' })
    expect(ordres('base_recipes')).toEqual(['name->>fr', 'id'])
  })
  it('par type', async () => {
    await adminFindOfficialRecipesPaginated({ sort: 'type' })
    expect(ordres('base_recipes')).toEqual(['type', 'id'])
  })
  it('par défaut, et pour les favoris (comptés page par page) : identifiant', async () => {
    await adminFindOfficialRecipesPaginated({})
    expect(ordres('base_recipes')).toEqual(['id'])
    etat.requetes = []
    await adminFindOfficialRecipesPaginated({ sort: 'favorites' })
    expect(ordres('base_recipes')).toEqual(['id'])
  })
})
