import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit du 2026-10-04, ADM-10 : les filtres du journal (catégorie, pseudo de
// l'auteur) ne portaient que sur les 50 lignes de la page affichée. « Journal,
// catégorie Modération » pouvait dire « Aucune entrée » quand la page suivante
// en était pleine, et la pagination comptait tout le journal. Ils partent
// désormais à la base : le compte et les pages portent sur les entrées filtrées.

const etat = vi.hoisted(() => ({ requetes: [], resultats: {} }))
vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, filtres: [] }
    etat.requetes.push(trace)
    const q = {}
    for (const f of ['eq', 'in', 'is', 'not', 'ilike', 'order', 'range']) q[f] = (...a) => { trace.filtres.push([f, ...a]); return q }
    q.select = () => q
    q.then = (ok, ko) => Promise.resolve(etat.resultats[table] ?? { data: [], error: null, count: 0 }).then(ok, ko)
    return q
  }
  return { supabase: { from: (table) => requete(table) } }
})

import { adminGetLogs } from '@features/admin/api/admin'

beforeEach(() => { etat.requetes = []; etat.resultats = {} })
const filtres = (table) => etat.requetes.filter((r) => r.table === table).flatMap((r) => r.filtres)

describe('journal — les filtres partent à la base', () => {
  it('une catégorie : seules ses actions sont demandées', async () => {
    await adminGetLogs(0, { actions: ['recipe_approved', 'recipe_rejected'] })
    expect(filtres('activity_logs')).toContainEqual(['in', 'action', ['recipe_approved', 'recipe_rejected']])
  })

  it('« Autres » : tout sauf les actions qui ont un nom', async () => {
    await adminGetLogs(0, { saufActions: ['recipe_approved', 'user_banned'] })
    expect(filtres('activity_logs')).toContainEqual(['not', 'action', 'in', '(recipe_approved,user_banned)'])
  })

  it('un auteur : son pseudo (protégé) donne ses identifiants, qui filtrent le journal', async () => {
    etat.resultats.profiles = { data: [{ id: 'a-1' }, { id: 'a-2' }], error: null }
    await adminGetLogs(0, { auteur: 'jean_d' })
    expect(filtres('profiles')).toContainEqual(['ilike', 'username', '%jean\\_d%'])
    expect(filtres('activity_logs')).toContainEqual(['in', 'user_id', ['a-1', 'a-2']])
  })

  it('un auteur que personne ne porte : rien, sans lire le journal', async () => {
    const r = await adminGetLogs(0, { auteur: 'personne' })
    expect(r).toEqual({ data: [], count: 0, error: null })
    expect(etat.requetes.some((q) => q.table === 'activity_logs')).toBe(false)
  })

  it('sans filtre : tout le journal, comme avant', async () => {
    await adminGetLogs(2)
    expect(filtres('activity_logs').filter(([f]) => f === 'in' || f === 'not')).toEqual([])
    expect(filtres('activity_logs')).toContainEqual(['range', 100, 149])
  })
})
