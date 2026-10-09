import { describe, it, expect, vi, beforeEach } from 'vitest'

// Le frigo d'un SECOND visiteur invité doit être migré comme celui du premier.
//
// ── Le défaut, trouvé à l'audit du 2026-08-28 ─────────────────────────────
// Les gardes de migration étaient des drapeaux dans `localStorage`, donc à
// portée NAVIGATEUR, et n'étaient purgés nulle part — ni à la déconnexion, ni
// ailleurs dans le dépôt. Enchaînement sur un poste partagé (ou un simple
// re-test) :
//
//   A se connecte (drapeau posé) → A se déconnecte → un invité remplit le
//   frigo → n'importe qui se reconnecte → le frigo de l'invité est IGNORÉ,
//   puis détruit par le `removeItem` de la déconnexion suivante.
//
// Même résultat que l'incident du 21 août, par un autre chemin.
//
// 🥇 Le correctif ne consiste pas à mieux gérer les drapeaux, mais à s'en
// passer : depuis août, les clés de données ne sont effacées qu'APRÈS
// confirmation de l'écriture. Leur simple présence est donc déjà le signal
// « pas encore migré » — un second signal ne pouvait qu'entrer en conflit.

const mockFrom = vi.hoisted(() => vi.fn())
const mockUpsertRecettes = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({ supabase: { from: mockFrom } }))
vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  migrationUpsertCommunityRecipes: mockUpsertRecettes,
}))

import { migrateLocalStorageToDB } from '@shared/lib/migration'

const STOCK = 'fridge-stock'
const FAVORIS = 'fridge-favorites'

function supabaseQuiReussit() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({ upsert, insert: vi.fn().mockResolvedValue({ error: null }) })
  return upsert
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockUpsertRecettes.mockResolvedValue(undefined)
})

describe('Migration — second passage invité sur le même navigateur', () => {
  it('migre le frigo du SECOND invité, même après une première migration réussie', async () => {
    // 1er invité : un ingrédient, migration réussie
    localStorage.setItem(STOCK, JSON.stringify([{ id: 'fr-oeuf', addedAt: null, expiresAt: null }]))
    const upsert1 = supabaseQuiReussit()
    await migrateLocalStorageToDB('user-A')
    expect(upsert1).toHaveBeenCalled()
    expect(localStorage.getItem(STOCK)).toBeNull() // source consommée

    // 2nd invité sur le MÊME navigateur : nouveau frigo
    localStorage.setItem(STOCK, JSON.stringify([{ id: 'vg-carotte', addedAt: null, expiresAt: null }]))
    const upsert2 = supabaseQuiReussit()
    await migrateLocalStorageToDB('user-B')

    // C'est tout l'objet du correctif : avant, le drapeau posé au 1er passage
    // faisait sauter ce bloc, et la carotte n'était jamais écrite.
    expect(upsert2).toHaveBeenCalled()
    const lignes = upsert2.mock.calls[0][0]
    expect(lignes).toEqual([expect.objectContaining({ user_id: 'user-B', ingredient_id: 'vg-carotte' })])
    expect(localStorage.getItem(STOCK)).toBeNull()
  })

  it('ne touche à rien quand il n’y a aucune donnée invité (pas d’écriture inutile)', async () => {
    const upsert = supabaseQuiReussit()
    await migrateLocalStorageToDB('user-A')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('préserve la source quand l’écriture échoue, et rejoue au passage suivant', async () => {
    localStorage.setItem(STOCK, JSON.stringify([{ id: 'fr-lait', addedAt: null, expiresAt: null }]))
    localStorage.setItem(FAVORIS, JSON.stringify(['tarte-tatin']))

    mockFrom.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: '403' } }) })
    await migrateLocalStorageToDB('user-A')
    expect(localStorage.getItem(STOCK)).not.toBeNull() // rien n'est détruit

    const upsert = supabaseQuiReussit()
    await migrateLocalStorageToDB('user-A')
    expect(upsert).toHaveBeenCalled() // le rejeu a bien lieu
    expect(localStorage.getItem(STOCK)).toBeNull()
  })
})
