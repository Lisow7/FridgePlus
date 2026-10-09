import { describe, it, expect, vi, beforeEach } from 'vitest'

// La « base » : chaque requête rend ce qu'on lui a prévu ; on garde la trace de
// chaque requête (table, verbe, filtres, sélection et ses options).
const etat = vi.hoisted(() => ({ resultats: [], requetes: [], utilisateur: { id: 'admin-1' } }))
vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, verbe: null, filtres: [], selection: null, options: null }
    etat.requetes.push(trace)
    const resultat = () => etat.resultats.shift() ?? { data: [], error: null }
    const q = {}
    for (const verbe of ['insert', 'update', 'delete', 'upsert']) q[verbe] = (...a) => { trace.verbe = verbe; trace.args = a; return q }
    for (const f of ['eq', 'in', 'is', 'like', 'contains', 'order', 'limit', 'range']) q[f] = (...a) => { trace.filtres.push([f, ...a]); return q }
    q.select = (cols, options) => { trace.selection = cols; trace.options = options ?? null; return q }
    q.single = () => Promise.resolve(resultat())
    q.maybeSingle = () => Promise.resolve(resultat())
    q.then = (ok, ko) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }
  return {
    supabase: {
      from: (table) => requete(table),
      auth: { getUser: () => Promise.resolve({ data: { user: etat.utilisateur } }) },
    },
  }
})

import { adminUpsertIngredient, adminUpsertBaseRecipe, adminCountIngredientUsage } from '@features/admin/api/admin'
import { choisirUnIdLibre } from '@features/admin/lib/id-libre'

beforeEach(() => { etat.resultats = []; etat.requetes = [] })
const ecritures = () => etat.requetes.filter((r) => r.verbe && r.table !== 'activity_logs')

// Audit du 2026-10-04, ADM-16 — vérifié sur la vraie base le 2026-10-08, dans
// des blocs annulés : une recette de base créée sans identifiant échoue
// toujours (23502), et la vue `base_recipes` REMPLACE la recette qui porte
// déjà l'identifiant (le nom d'« Affogato » a été écrasé).

describe('ingrédients — un nouvel identifiant n’écrase rien', () => {
  it('un NOUVEL ingrédient s’insère : la base refuse un identifiant déjà pris au lieu de l’écraser', async () => {
    await adminUpsertIngredient({ _isNew: true, id: 'gp-cafe', labels: { fr: 'Café' } })
    expect(ecritures()).toMatchObject([{ table: 'ingredients', verbe: 'insert' }])
    expect(ecritures()[0].args[0]).not.toHaveProperty('_isNew')
  })

  it('modifier un ingrédient existant reste une mise à jour par identifiant', async () => {
    await adminUpsertIngredient({ _isNew: false, id: 'gp-cafe', labels: { fr: 'Café' } })
    expect(ecritures()).toMatchObject([{ table: 'ingredients', verbe: 'upsert', args: [expect.anything(), { onConflict: 'id' }] }])
  })
})

describe('recettes de base — une recette neuve reçoit un identifiant libre', () => {
  it('tiré de son nom, et suffixé s’il est déjà pris', async () => {
    etat.resultats = [{ data: [{ id: 'soupe-de-legumes' }], error: null }]
    const { error } = await adminUpsertBaseRecipe({ _isNew: true, name: { fr: 'Soupe de légumes' }, emoji: '🍲' })
    expect(error).toBeNull()
    const lecture = etat.requetes[0]
    expect(lecture).toMatchObject({ table: 'base_recipes', verbe: null, filtres: [['like', 'id', 'soupe-de-legumes%']] })
    expect(ecritures()).toMatchObject([{ table: 'base_recipes', verbe: 'insert' }])
    expect(ecritures()[0].args[0].id).toBe('soupe-de-legumes-2')
  })

  it('sans nom français, rien n’est écrit', async () => {
    const { error } = await adminUpsertBaseRecipe({ _isNew: true, name: { fr: '  ' }, emoji: '🍲' })
    expect(error).toBeTruthy()
    expect(ecritures()).toEqual([])
  })

  it('la lecture des identifiants échoue : rien n’est écrit, l’erreur remonte', async () => {
    etat.resultats = [{ data: null, error: { message: 'réseau' } }]
    const { error } = await adminUpsertBaseRecipe({ _isNew: true, name: { fr: 'Soupe' }, emoji: '🍲' })
    expect(error).toEqual({ message: 'réseau' })
    expect(ecritures()).toEqual([])
  })

  it('modifier une recette existante garde son identifiant', async () => {
    await adminUpsertBaseRecipe({ _isNew: false, id: 'affogato', name: { fr: 'Affogato' } })
    expect(ecritures()).toMatchObject([{ table: 'base_recipes', verbe: 'insert' }])
    expect(ecritures()[0].args[0].id).toBe('affogato')
  })
})

describe('compter les recettes qui utilisent un ingrédient', () => {
  it('cherche l’identifiant dans les ingrédients des recettes (contenance jsonb, en texte)', async () => {
    etat.resultats = [{ data: null, count: 3, error: null }]
    const { count, error } = await adminCountIngredientUsage('gp-cafe')
    expect(error).toBeNull()
    expect(count).toBe(3)
    const r = etat.requetes[0]
    expect(r).toMatchObject({ table: 'recipes_unified', options: { count: 'exact', head: true } })
    // Un TABLEAU deviendrait un littéral de tableau PostgreSQL (`cs.{…}`),
    // faux pour du jsonb : postgrest-js l'encode ainsi. D'où la chaîne JSON.
    expect(r.filtres).toEqual([['contains', 'ingredients', '[{"ids":["gp-cafe"]}]']])
  })
})

describe('choisirUnIdLibre', () => {
  it('la base si elle est libre, sinon le premier suffixe libre', () => {
    expect(choisirUnIdLibre('soupe', [])).toBe('soupe')
    expect(choisirUnIdLibre('soupe', ['soupe'])).toBe('soupe-2')
    expect(choisirUnIdLibre('soupe', ['soupe', 'soupe-2', 'soupe-3'])).toBe('soupe-4')
    expect(choisirUnIdLibre('soupe', ['soupe-2'])).toBe('soupe')
  })
})
