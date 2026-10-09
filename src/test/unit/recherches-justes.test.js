import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit du 2026-10-04, ADM-10 : les recherches.
//
// Mesuré le 2026-10-08 sur la vraie API (lecture seule, `base_recipes`) :
//   - dans un filtre `.or()` de PostgREST, une virgule ou une parenthèse non
//     protégée CASSE la requête (400) : « poulet, riz », « tarte (aux pommes) »
//     affichaient « Aucune recette » (et l'erreur était jetée) ;
//   - entre guillemets, elle passe — mais PostgREST y retire DEUX niveaux de
//     barre oblique inverse : pour qu'ILIKE reçoive `\_`, il faut en envoyer 4 ;
//   - dans un motif ILIKE, `%` et `_` sont des jokers : le code qui les
//     RETIRAIT rendait le pseudo « jean_dupont » introuvable, celui qui les
//     laissait faisait de « _ » un « n'importe quoi » (515 recettes sur 515).

const etat = vi.hoisted(() => ({ requetes: [] }))
vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, filtres: [] }
    etat.requetes.push(trace)
    const q = {}
    for (const f of ['eq', 'neq', 'in', 'is', 'not', 'like', 'ilike', 'or', 'gte', 'lte', 'gt', 'lt', 'contains', 'order', 'limit', 'range', 'filter']) {
      q[f] = (...a) => { trace.filtres.push([f, ...a]); return q }
    }
    q.select = () => q
    q.single = () => Promise.resolve({ data: null, error: null })
    q.maybeSingle = () => Promise.resolve({ data: null, error: null })
    q.then = (ok, ko) => Promise.resolve({ data: [], error: null, count: 0 }).then(ok, ko)
    return q
  }
  return { supabase: { from: (table) => requete(table), auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) } } }
})

import { motifContient, motifDansOu } from '@shared/lib/supabase/motif-de-recherche'
import { adminGetUsers, adminGetIngredients, adminGetImportQueue } from '@features/admin/api/admin'
import { adminListPosts } from '@features/admin/api/community-admin'
import { adminListReviews } from '@features/admin/api/recipe-reviews-admin'
import { searchIngredients } from '@features/support/api/support'
import { searchCommunityRecipes, searchOfficialRecipes, adminFindOfficialRecipesPaginated } from '@shared/lib/recipes/recipes-repository'

beforeEach(() => { etat.requetes = [] })
const filtre = (table, nom) => etat.requetes.filter((r) => r.table === table).flatMap((r) => r.filtres).find((f) => f[0] === nom)

describe('le motif d’une recherche « contient »', () => {
  it('% et _ valent pour eux-mêmes, \\ aussi', () => {
    expect(motifContient('jean_dupont')).toBe('%jean\\_dupont%')
    expect(motifContient(' 100% ')).toBe('%100\\%%')
    expect(motifContient('a\\b')).toBe('%a\\\\b%')
    expect(motifContient('poulet, riz')).toBe('%poulet, riz%')
  })

  it('dans un filtre .or() : entre guillemets, barres obliques doublées deux fois (règle mesurée)', () => {
    expect(motifDansOu('poulet, riz')).toBe('"%poulet, riz%"')
    expect(motifDansOu('tarte (aux pommes)')).toBe('"%tarte (aux pommes)%"')
    expect(motifDansOu('jean_dupont')).toBe('"%jean\\\\\\\\_dupont%"')
    expect(motifDansOu('dit "chef"')).toBe('"%dit chef%"')
  })
})

describe('chaque recherche protège la saisie', () => {
  const OU = (cols, saisie) => cols.map((c) => `${c}.ilike.${motifDansOu(saisie)}`).join(',')

  it('utilisateurs : un pseudo avec un tiret bas se trouve (il était retiré)', async () => {
    await adminGetUsers({ search: 'jean_dupont' })
    expect(filtre('profiles', 'ilike')).toEqual(['ilike', 'username', '%jean\\_dupont%'])
  })

  it('ingrédients (admin) : une virgule reste une virgule', async () => {
    await adminGetIngredients({ search: 'poulet, riz' })
    expect(filtre('ingredients', 'or')).toEqual(['or', OU(['id', 'labels->>fr'], 'poulet, riz')])
  })

  it('file d’import : un tiret bas n’est plus un joker', async () => {
    await adminGetImportQueue({ search: 'a_b' })
    expect(filtre('recipe_imports_staging', 'or')).toEqual(['or', OU(['external_key', 'parsed_data->>name'], 'a_b')])
  })

  it('posts et avis de la communauté : % et _ sont des caractères', async () => {
    await adminListPosts({ search: '100%' })
    expect(filtre('community_posts', 'ilike')).toEqual(['ilike', 'title', '%100\\%%'])
    await adminListReviews({ search: '_' })
    expect(filtre('engagement', 'ilike')).toEqual(['ilike', 'body', '%\\_%'])
  })

  it('recherches publiques : ingrédients et recettes officielles ne cassent plus sur une virgule', async () => {
    await searchIngredients('poulet, riz', 'fr')
    expect(filtre('ingredients', 'or')).toEqual(['or', OU(['id', 'labels->>fr', 'labels->>fr'], 'poulet, riz')])
    etat.requetes = []
    await searchOfficialRecipes('tarte (aux pommes)', 'en')
    expect(filtre('base_recipes', 'or')).toEqual(['or', OU(['id', 'name->>en', 'name->>fr'], 'tarte (aux pommes)')])
  })

  it('recettes communautaires publiques : le tiret bas est un caractère', async () => {
    await searchCommunityRecipes('jean_x')
    expect(filtre('custom_recipes', 'ilike')).toEqual(['ilike', 'title', '%jean\\_x%'])
  })

  it('catalogue des recettes de base (admin) : « poulet, riz » ne renvoie plus « Aucune recette »', async () => {
    await adminFindOfficialRecipesPaginated({ search: 'poulet, riz' })
    expect(filtre('base_recipes', 'or')).toEqual(['or', OU(['id', 'name->>fr'], 'poulet, riz')])
  })
})
