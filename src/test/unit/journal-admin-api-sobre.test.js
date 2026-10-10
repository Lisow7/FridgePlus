import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit du 2026-10-04, ADM-12 (4) : `adminGetLogs` lisait toujours une page
// entière avec un comptage exact (`count: 'exact'`, une seconde passe sur la
// table) — le tableau de bord n'en affiche que dix. Deux options : `limite`
// (le nombre de lignes) et `compter` (le comptage exact, utile à la pagination
// du journal, inutile aux dix dernières lignes).

const etat = vi.hoisted(() => ({ requetes: [] }))
vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, filtres: [] }
    etat.requetes.push(trace)
    const q = {}
    for (const f of ['select', 'eq', 'in', 'not', 'ilike', 'order', 'range']) {
      q[f] = (...a) => { trace.filtres.push([f, ...a]); return q }
    }
    q.then = (ok, ko) => Promise.resolve({ data: [], count: 0, error: null }).then(ok, ko)
    return q
  }
  return { supabase: { from: requete, auth: { getUser: () => Promise.resolve({ data: { user: { id: 'a' } } }) } } }
})

import { adminGetLogs } from '@features/admin/api/admin'

beforeEach(() => { etat.requetes = [] })

const journal = () => etat.requetes.find((r) => r.table === 'activity_logs')
const option = (nom) => journal().filtres.find(([f]) => f === nom)

describe('adminGetLogs — lire juste ce qu’il faut', () => {
  it('par défaut : une page entière, comptée', async () => {
    await adminGetLogs(0)
    expect(option('select')[2]).toEqual({ count: 'exact' })
    expect(option('range')[1]).toBe(0)
    expect(option('range')[2]).toBeGreaterThanOrEqual(9)
  })

  it('`limite: 10, compter: false` : dix lignes, pas de comptage', async () => {
    await adminGetLogs(0, { limite: 10, compter: false })
    expect(option('range')).toEqual(['range', 0, 9])
    expect(option('select')[2]).toBeUndefined()
  })
})
