import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit du 2026-10-04, ADM-05 — le côté API. La base écrit la trace d'une
// consultation AVANT de rendre la donnée (`admin_reveler_compte`, migration
// 20261008095232) ; le panneau ne doit donc plus lire ces données autrement.

// La « base » : enregistre chaque appel et rend ce qu'on lui a prévu.
const base = vi.hoisted(() => ({ appels: [], rpc: null, resultats: [] }))

vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const q = {}
    for (const f of ['eq', 'in', 'is', 'not', 'neq', 'ilike', 'order', 'limit', 'range', 'gte', 'or']) {
      q[f] = (...args) => { base.appels.push({ table, f, args }); return q }
    }
    q.select = (...args) => { base.appels.push({ table, f: 'select', args }); return q }
    const resultat = () => base.resultats.shift() ?? { data: [], count: 0, error: null }
    q.single = () => Promise.resolve(resultat())
    q.maybeSingle = () => Promise.resolve(resultat())
    q.then = (ok, ko) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }
  return {
    supabase: {
      from: (table) => { base.appels.push({ table, f: 'from' }); return requete(table) },
      rpc: (nom, params) => { base.appels.push({ f: 'rpc', nom, params }); return Promise.resolve(base.rpc ?? { data: [], error: null }) },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) },
    },
  }
})
vi.mock('@shared/lib/recipes/recipes-repository', async (original) => ({
  ...(await original()),
  adminFindRecentCommunityRecipesByUser: vi.fn(() => Promise.resolve([])),
}))

import * as adminApi from '@features/admin/api/admin'

beforeEach(() => {
  base.appels = []
  base.rpc = null
  base.resultats = []
})

describe('adminRevelerCompte — une consultation, une trace, par la base', () => {
  it('appelle `admin_reveler_compte` avec le compte et le motif, rien d’autre', async () => {
    base.rpc = { data: [{ email: 'bob@exemple.fr', derniere_connexion: '2026-10-01T08:00:00Z', allergenes: ['peanuts'] }], error: null }
    await adminApi.adminRevelerCompte('u-2', 'Demande RGPD — ticket 42')
    expect(base.appels).toEqual([{ f: 'rpc', nom: 'admin_reveler_compte', params: { p_user_id: 'u-2', p_motif: 'Demande RGPD — ticket 42' } }])
  })

  it('la base répond : la donnée, prête à afficher', async () => {
    base.rpc = { data: [{ email: 'bob@exemple.fr', derniere_connexion: '2026-10-01T08:00:00Z', allergenes: ['peanuts'] }], error: null }
    expect(await adminApi.adminRevelerCompte('u-2', 'Enquête de sécurité')).toEqual({
      donnee: { email: 'bob@exemple.fr', derniereConnexion: '2026-10-01T08:00:00Z', allergenes: ['peanuts'] },
      error: null,
    })
  })

  it('la base refuse : aucune donnée, l’erreur est rendue', async () => {
    base.rpc = { data: null, error: { code: '42501', message: 'Réservé aux administrateurs' } }
    expect(await adminApi.adminRevelerCompte('u-2', 'Curiosité')).toEqual({ donnee: null, error: { code: '42501', message: 'Réservé aux administrateurs' } })
  })

  it('aucune ligne : c’est une erreur, pas une donnée vide', async () => {
    base.rpc = { data: [], error: null }
    const { donnee, error } = await adminApi.adminRevelerCompte('u-2', 'Enquête de sécurité')
    expect(donnee).toBeNull()
    expect(error).toBeTruthy()
  })
})

describe('plus aucun autre chemin vers ces données', () => {
  it('l’API ne propose plus de lire les e-mails de tous les comptes', () => {
    expect(adminApi.adminGetAuthUsers).toBeUndefined()
  })

  it('la fiche d’un compte ne lit plus ses allergènes', async () => {
    const fiche = await adminApi.adminGetUserProfile('u-2')
    expect(fiche).not.toHaveProperty('allergens')
    const lectures = base.appels.filter((a) => a.f === 'select').map((a) => `${a.table}:${a.args[0]}`)
    expect(lectures.join(' ')).not.toMatch(/allergen/)
  })
})

describe('le Journal lit le motif d’une consultation', () => {
  it('`adminGetLogs` sélectionne les métadonnées', async () => {
    await adminApi.adminGetLogs(0)
    const selection = base.appels.find((a) => a.table === 'activity_logs' && a.f === 'select')
    expect(selection?.args[0]).toMatch(/\bmetadata\b/)
  })
})
