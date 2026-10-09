import { describe, it, expect, vi, beforeEach } from 'vitest'

// Allergènes déclarés en invité → compte (audit d'intuitivité du 2026-10-02).
// Depuis qu'un invité peut régler ses allergènes (tiroir des filtres), les
// perdre en créant son compte serait le pire endroit pour un oubli : c'est un
// sujet de sécurité. Règles :
//   - UNION avec ceux du profil (en ajouter n'est jamais risqué, en retirer l'est) ;
//   - la copie locale n'est effacée qu'APRÈS l'écriture confirmée (même règle
//     que le frigo et les favoris, cf. migration-ne-detruit-pas-la-source).

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))
vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  migrationUpsertCommunityRecipes: vi.fn().mockResolvedValue({ error: null }),
}))

import { migrateLocalStorageToDB } from '@shared/lib/migration'

const CLE = 'fridge-allergen-prefs'

function brancher({ profil = [], erreurLecture = null, erreurEcriture = null } = {}) {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: erreurEcriture }) }))
  const select = vi.fn(() => ({
    eq: () => ({ single: vi.fn().mockResolvedValue({ data: { allergen_prefs: profil }, error: erreurLecture }) }),
  }))
  mockFrom.mockImplementation((table) => (table === 'profiles'
    ? { select, update }
    : { upsert: vi.fn().mockResolvedValue({ error: null }) }))
  return { update, select }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('migration — allergènes d’un invité vers son compte', () => {
  it('profil vide : reprend les allergènes de l’invité, puis efface la copie locale', async () => {
    localStorage.setItem(CLE, JSON.stringify(['gluten']))
    const { update } = brancher({ profil: [] })
    await migrateLocalStorageToDB('u-1')
    expect(update).toHaveBeenCalledWith({ allergen_prefs: ['gluten'] })
    expect(localStorage.getItem(CLE)).toBeNull()
  })

  it('profil déjà rempli : fait l’union, sans rien retirer', async () => {
    localStorage.setItem(CLE, JSON.stringify(['gluten', 'lait']))
    const { update } = brancher({ profil: ['lait', 'arachides'] })
    await migrateLocalStorageToDB('u-1')
    expect(update).toHaveBeenCalledWith({ allergen_prefs: ['lait', 'arachides', 'gluten'] })
  })

  it('rien de nouveau : n’écrit pas, mais nettoie la copie locale', async () => {
    localStorage.setItem(CLE, JSON.stringify(['lait']))
    const { update } = brancher({ profil: ['lait', 'gluten'] })
    await migrateLocalStorageToDB('u-1')
    expect(update).not.toHaveBeenCalled()
    expect(localStorage.getItem(CLE)).toBeNull()
  })

  it('écriture refusée : garde la copie locale (retentée à la prochaine connexion)', async () => {
    localStorage.setItem(CLE, JSON.stringify(['gluten']))
    brancher({ profil: [], erreurEcriture: { message: 'permission denied', code: '42501' } })
    await migrateLocalStorageToDB('u-1')
    expect(localStorage.getItem(CLE)).toBe(JSON.stringify(['gluten']))
  })

  it('lecture du profil impossible : garde la copie locale', async () => {
    localStorage.setItem(CLE, JSON.stringify(['gluten']))
    const { update } = brancher({ erreurLecture: { message: 'network' } })
    await migrateLocalStorageToDB('u-1')
    expect(update).not.toHaveBeenCalled()
    expect(localStorage.getItem(CLE)).toBe(JSON.stringify(['gluten']))
  })

  it('aucun allergène local : ne touche pas au profil', async () => {
    const { select, update } = brancher()
    await migrateLocalStorageToDB('u-1')
    expect(select).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
