import { describe, it, expect, vi, beforeEach } from 'vitest'

// La migration invité → compte ne doit JAMAIS effacer le localStorage tant que
// l'écriture en base n'est pas confirmée.
//
// ── L'incident, prouvé de bout en bout le 2026-08-21 ──────────────────────
// 6 ingrédients ajoutés en mode invité, puis connexion. Une seule ligne était
// déjà présente dans le compte (`gp-spaghetti`, depuis juin). PostgREST a
// traduit l'upsert en `ON CONFLICT DO UPDATE` — or `user_stock` n'a aucune
// policy UPDATE — d'où un **403 sur tout le lot**.
//
// Le résultat n'était pas lu. Le code enchaînait sur
// `localStorage.removeItem(...)` et posait le drapeau de migration : source
// détruite, migration plus jamais retentée. **5 ingrédients perdus sur 6.**
//
// 🥇 Deux défauts distincts, et c'est le second qui coûte :
//   A. l'upsert demandait un UPDATE interdit  → corrigé par `ignoreDuplicates`
//   B. la source était effacée sans vérifier  → corrigé ici, et c'est LUI qui
//      protège aussi des pannes réseau, d'une base indisponible pendant un
//      déploiement, ou d'une policy modifiée demain.
//
// Ce test porte sur B, parce que B est la propriété de sûreté : peu importe la
// raison de l'échec, les données de l'utilisateur doivent survivre.

const mockFrom = vi.hoisted(() => vi.fn())
const mockUpsertRecettes = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))
vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  migrationUpsertCommunityRecipes: mockUpsertRecettes,
}))

import { migrateLocalStorageToDB } from '@shared/lib/migration'

const STOCK = 'fridge-stock'
const FAVORIS = 'fridge-favorites'
const RECETTES = 'fridge-custom-recipes'
const DRAPEAU_BASE = 'fridge-migration-done'
const DRAPEAU_RECETTES = 'fridge-migration-custom-recipes-done'

/** Un client qui accepte tout. */
const clientQuiAccepte = () => ({
  upsert: vi.fn().mockResolvedValue({ error: null }),
  insert: vi.fn().mockResolvedValue({ error: null }),
})

/** Un client qui refuse l'écriture — 403 RLS, panne réseau, peu importe. */
const clientQuiRefuse = () => ({
  upsert: vi.fn().mockResolvedValue({ error: { message: 'permission denied', code: '42501' } }),
  insert: vi.fn().mockResolvedValue({ error: { message: 'permission denied', code: '42501' } }),
})

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockUpsertRecettes.mockResolvedValue({ error: null })
  localStorage.setItem(STOCK, JSON.stringify([{ id: 'fr-tomate', addedAt: '2026-08-01T00:00:00Z' }]))
  localStorage.setItem(FAVORIS, JSON.stringify(['carbonara']))
})

describe('migration invité → compte — quand l’écriture ÉCHOUE', () => {
  it('ne touche PAS au frigo local', async () => {
    mockFrom.mockReturnValue(clientQuiRefuse())
    await migrateLocalStorageToDB('u-1')
    expect(localStorage.getItem(STOCK), 'le frigo de l’invité doit survivre').not.toBeNull()
  })

  it('ne touche PAS aux favoris locaux', async () => {
    mockFrom.mockReturnValue(clientQuiRefuse())
    await migrateLocalStorageToDB('u-1')
    expect(localStorage.getItem(FAVORIS)).not.toBeNull()
  })

  it('ne pose PAS le drapeau — la migration doit être retentée', async () => {
    // C'est ce drapeau qui rendait la perte définitive : posé une fois, la
    // migration ne se rejouait plus jamais sur ce navigateur.
    mockFrom.mockReturnValue(clientQuiRefuse())
    await migrateLocalStorageToDB('u-1')
    expect(localStorage.getItem(DRAPEAU_BASE)).toBeNull()
  })

  it('ne détruit PAS les recettes créées par l’utilisateur', async () => {
    // La perte la plus coûteuse des trois : ce sont ses écrits.
    localStorage.setItem(RECETTES, JSON.stringify([{ id: 'r-1', name: 'Ma recette' }]))
    mockFrom.mockReturnValue(clientQuiAccepte())
    mockUpsertRecettes.mockResolvedValue({ error: { message: 'permission denied' } })
    await migrateLocalStorageToDB('u-1')
    expect(localStorage.getItem(RECETTES)).not.toBeNull()
    expect(localStorage.getItem(DRAPEAU_RECETTES)).toBeNull()
  })
})

describe('migration invité → compte — quand l’écriture RÉUSSIT', () => {
  it('transfère puis nettoie la source', async () => {
    // L'autre moitié du contrat : sans elle, on aurait pu « corriger » en ne
    // nettoyant plus jamais rien.
    //
    // ⚠️ Le drapeau `fridge-migration-done` a été RETIRÉ le 2026-08-28 : à
    // portée navigateur et jamais purgé, il faisait ignorer le frigo d'un
    // SECOND invité (cf. migration-second-invite.test.js). C'est désormais la
    // disparition des clés de données qui atteste la migration — et elle
    // n'arrive qu'après confirmation de l'écriture, ce que ce test vérifie.
    mockFrom.mockReturnValue(clientQuiAccepte())
    await migrateLocalStorageToDB('u-1')
    expect(localStorage.getItem(STOCK)).toBeNull()
    expect(localStorage.getItem(FAVORIS)).toBeNull()
    expect(localStorage.getItem(DRAPEAU_BASE)).toBeNull()
  })

  it('n’écrase pas ce que le compte contient déjà', async () => {
    // `ignoreDuplicates: true` : si l'ingrédient est déjà dans le compte, la
    // ligne du compte gagne — on ne réécrit pas sa fraîcheur avec celle de
    // l'invité. C'est aussi ce qui évite le `ON CONFLICT DO UPDATE` que la RLS
    // refuse.
    const client = clientQuiAccepte()
    mockFrom.mockReturnValue(client)
    await migrateLocalStorageToDB('u-1')
    const optionsUtilisees = client.upsert.mock.calls.map(appel => appel[1])
    expect(optionsUtilisees.length).toBeGreaterThan(0)
    for (const options of optionsUtilisees) {
      expect(options?.ignoreDuplicates, JSON.stringify(options)).toBe(true)
    }
  })
})
