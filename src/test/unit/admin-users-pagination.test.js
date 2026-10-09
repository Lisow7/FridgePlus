// Tests unit — pagination serveur de la liste admin des utilisateurs.
// Audit front §3 : adminGetAllUsers() rapatriait toute la table `profiles`
// (pagination + recherche + filtres côté client). On la remplace par une
// requête paginée serveur (.range + count exact + filtres/tri SQL), plus des
// requêtes count dédiées pour les badges de filtre.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock du client Supabase ────────────────────────────────────────────────
// Chaque appel .from() crée un builder chainable neuf, poussé dans
// _state.builders pour que les tests inspectent les appels (range, eq, neq…).

vi.mock('@shared/lib/supabase/client', () => {
  function makeBuilder(result) {
    return {
      _result: result,
      select: vi.fn(function () { return this }),
      eq:     vi.fn(function () { return this }),
      neq:    vi.fn(function () { return this }),
      ilike:  vi.fn(function () { return this }),
      or:     vi.fn(function () { return this }),
      in:     vi.fn(function () { return this }),
      order:  vi.fn(function () { return this }),
      range:  vi.fn(function () { return this }),
      then(resolve) { return Promise.resolve(this._result).then(resolve) },
    }
  }
  const state = {
    result: { data: [{ id: 'u1' }, { id: 'u2' }], count: 7, error: null },
    builders: [],
  }
  const supabaseMock = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-uuid' } }, error: null })) },
    from: vi.fn(() => {
      const b = makeBuilder(state.result)
      state.builders.push(b)
      return b
    }),
    _state: state,
  }
  return { supabase: supabaseMock }
})

import { adminGetUsers, adminGetUserCounts } from '@features/admin/api/admin'
import { supabase } from '@shared/lib/supabase/client'

const lastBuilder = () => supabase._state.builders[supabase._state.builders.length - 1]

beforeEach(() => {
  vi.clearAllMocks()
  supabase._state.builders = []
  supabase._state.result = { data: [{ id: 'u1' }, { id: 'u2' }], count: 7, error: null }
})

describe('adminGetUsers', () => {
  it('retourne { data, count, error } et pagine via .range (pas de fetch-all)', async () => {
    const res = await adminGetUsers({ page: 0 })
    expect(res).toHaveProperty('data')
    expect(res).toHaveProperty('count')
    expect(res.error).toBeNull()
    expect(lastBuilder().range).toHaveBeenCalledOnce()
  })

  it('applique le bon offset .range selon la page (30 par page)', async () => {
    await adminGetUsers({ page: 2 })
    expect(lastBuilder().range).toHaveBeenCalledWith(60, 89)
  })

  it('demande un count exact au serveur', async () => {
    await adminGetUsers({ page: 0 })
    const selectArgs = lastBuilder().select.mock.calls[0]
    expect(selectArgs[1]).toMatchObject({ count: 'exact' })
  })

  it("filtre 'banned' → .eq('banned', true)", async () => {
    await adminGetUsers({ filter: 'banned' })
    expect(lastBuilder().eq).toHaveBeenCalledWith('banned', true)
  })

  it("filtre 'admins' → .eq('role', 'admin')", async () => {
    await adminGetUsers({ filter: 'admins' })
    expect(lastBuilder().eq).toHaveBeenCalledWith('role', 'admin')
  })

  it("filtre 'active' → non banni ET non admin", async () => {
    await adminGetUsers({ filter: 'active' })
    expect(lastBuilder().eq).toHaveBeenCalledWith('banned', false)
    expect(lastBuilder().neq).toHaveBeenCalledWith('role', 'admin')
  })

  it("filtre 'all' → aucun filtre eq/neq de statut", async () => {
    await adminGetUsers({ filter: 'all' })
    expect(lastBuilder().eq).not.toHaveBeenCalled()
    expect(lastBuilder().neq).not.toHaveBeenCalled()
  })

  it('recherche non vide → .ilike sur username', async () => {
    await adminGetUsers({ search: 'bob' })
    expect(lastBuilder().ilike).toHaveBeenCalled()
    const [col] = lastBuilder().ilike.mock.calls[0]
    expect(col).toBe('username')
  })

  it('recherche vide → pas de .ilike', async () => {
    await adminGetUsers({ search: '   ' })
    expect(lastBuilder().ilike).not.toHaveBeenCalled()
  })

  it("tri 'az' → .order('username', ascending)", async () => {
    await adminGetUsers({ sort: 'az' })
    expect(lastBuilder().order).toHaveBeenCalledWith('username', { ascending: true })
  })

  it("tri 'oldest' → .order('created_at', ascending)", async () => {
    await adminGetUsers({ sort: 'oldest' })
    expect(lastBuilder().order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it("tri par défaut 'newest' → .order('created_at', descending)", async () => {
    await adminGetUsers({})
    expect(lastBuilder().order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('adminGetUserCounts', () => {
  it('retourne les 4 compteurs de badge', async () => {
    const counts = await adminGetUserCounts()
    expect(counts).toHaveProperty('all')
    expect(counts).toHaveProperty('active')
    expect(counts).toHaveProperty('banned')
    expect(counts).toHaveProperty('admins')
    expect(typeof counts.all).toBe('number')
  })

  it('utilise des requêtes count (head), jamais de .range', async () => {
    await adminGetUserCounts()
    // 4 requêtes count → 4 builders, aucun ne doit paginer
    expect(supabase._state.builders.length).toBe(4)
    for (const b of supabase._state.builders) {
      expect(b.range).not.toHaveBeenCalled()
      expect(b.select.mock.calls[0][1]).toMatchObject({ count: 'exact', head: true })
    }
  })
})
