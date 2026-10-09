import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture les upserts ET inserts par table.
const upsertCalls = {}
const insertCalls = {}
const mockFrom = vi.fn((table) => ({
  upsert: (rows) => { upsertCalls[table] = rows; return Promise.resolve({ error: null }) },
  insert: (rows) => { insertCalls[table] = rows; return Promise.resolve({ error: null }) },
}))

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: (...a) => mockFrom(...a) },
}))
vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  migrationUpsertCommunityRecipes: vi.fn(() => Promise.resolve({ error: null })),
}))

import { migrateLocalStorageToDB } from '@shared/lib/migration'

describe('migrateLocalStorageToDB — fraîcheur du stock', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const k of Object.keys(upsertCalls)) delete upsertCalls[k]
    for (const k of Object.keys(insertCalls)) delete insertCalls[k]
    mockFrom.mockClear()
  })

  it('migre le nouveau format en conservant added_at/expires_at', async () => {
    localStorage.setItem('fridge-stock', JSON.stringify([
      { id: 'fr-tomate', addedAt: '2026-06-01T00:00:00Z', expiresAt: '2026-06-05T00:00:00Z' },
    ]))
    await migrateLocalStorageToDB('u-1')
    expect(upsertCalls['user_stock']).toContainEqual(
      expect.objectContaining({ user_id: 'u-1', ingredient_id: 'fr-tomate', added_at: '2026-06-01T00:00:00Z', expires_at: '2026-06-05T00:00:00Z' }),
    )
  })

  it('tolère l\'ancien format (strings) en stampant added_at', async () => {
    localStorage.setItem('fridge-stock', JSON.stringify(['fr-oeuf']))
    await migrateLocalStorageToDB('u-1')
    const row = upsertCalls['user_stock'].find(r => r.ingredient_id === 'fr-oeuf')
    expect(row.user_id).toBe('u-1')
    expect(row.expires_at).toBe(null)
    expect(typeof row.added_at).toBe('string')
  })
})

describe('migrateLocalStorageToDB — événements anti-gaspi (1B-i)', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const k of Object.keys(insertCalls)) delete insertCalls[k]
    mockFrom.mockClear()
  })

  // Le bloc « événements anti-gaspi » a été RETIRÉ le 2026-08-28 : plus aucun
  // code n'écrit `fridge-anti-gaspi-events` depuis le retrait de l'anti-gaspi,
  // et c'était le seul bloc non idempotent du fichier (insert sans onConflict).
  // Le test verrouille désormais son absence : une clé résiduelle sur un vieux
  // navigateur ne doit RIEN déclencher.
  it('ignore une clé anti-gaspi résiduelle (bloc retiré, aucune écriture)', async () => {
    localStorage.setItem('fridge-anti-gaspi-events', JSON.stringify([
      { ingredient_id: 'vg-tomate', outcome: 'consumed', est_price_eur: 2, est_carbon_g: 300, removed_at: '2026-06-20T00:00:00Z' },
    ]))
    await migrateLocalStorageToDB('u-1')
    expect(insertCalls['stock_events']).toBeUndefined()
  })
})

describe('migrateLocalStorageToDB — report onboarding invité', () => {
  beforeEach(() => localStorage.clear())

  it('reporte la progression guest → user et supprime la clé guest', async () => {
    localStorage.setItem('fridge-getting-started-v1:guest', JSON.stringify({ step2_opened: true, dismissed: true }))
    await migrateLocalStorageToDB('u-9')
    const userState = JSON.parse(localStorage.getItem('fridge-getting-started-v1:u-9') || '{}')
    expect(userState.step2_opened).toBe(true)
    expect(userState.dismissed).toBe(true)
    expect(localStorage.getItem('fridge-getting-started-v1:guest')).toBeNull()
  })

  it('merge OR-wins si la clé user existe déjà', async () => {
    localStorage.setItem('fridge-getting-started-v1:guest', JSON.stringify({ step2_opened: true, dismissed: false }))
    localStorage.setItem('fridge-getting-started-v1:u-9', JSON.stringify({ step2_opened: false, dismissed: true }))
    await migrateLocalStorageToDB('u-9')
    const s = JSON.parse(localStorage.getItem('fridge-getting-started-v1:u-9') || '{}')
    expect(s.step2_opened).toBe(true)
    expect(s.dismissed).toBe(true)
  })
})
