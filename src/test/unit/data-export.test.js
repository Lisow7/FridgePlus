import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

import { exportUserData, triggerJsonDownload } from '@features/profile/api/data-export'

// Champs profiles internes/admin — jamais exposés dans un export self-service
// (RGPD Art. 20 = données fournies/générées par l'usage de l'utilisateur, pas
// l'état de modération/sécurité interne). Voir aussi Art. 5.1.c minimisation.
const FORBIDDEN_PROFILE_FIELDS = [
  'restore_token', 'stripe_customer_id', 'special_role', 'banned', 'role',
  'community_muted_until', 'inactive_warned_at', 'deleted_at',
  'username_confirmed', 'push_last_variant_index',
]

function makeBuilder(resolvedValue, { withMaybeSingle } = {}) {
  const builder = {
    select: vi.fn(() => builder),
    eq:     vi.fn(() => builder),
    in:     vi.fn(() => builder),
    then:   (resolve) => resolve(resolvedValue),
  }
  if (withMaybeSingle) builder.maybeSingle = vi.fn(() => Promise.resolve(resolvedValue))
  return builder
}

describe('exportUserData — profiles ne doit jamais faire select(*)', () => {
  let builders

  beforeEach(() => {
    mockFrom.mockReset()
    builders = {
      support_tickets:     makeBuilder({ data: [], error: null }),
      profiles:            makeBuilder({ data: { id: 'u1', username: 'foo' }, error: null }, { withMaybeSingle: true }),
      user_stock:          makeBuilder({ data: [], error: null }),
      user_favorites:      makeBuilder({ data: [], error: null }),
      custom_recipes:      makeBuilder({ data: [], error: null }),
      basket_items:        makeBuilder({ data: [], error: null }),
      user_leftovers:      makeBuilder({ data: [], error: null }),
      shopping_lists:      makeBuilder({ data: [], error: null }),
      push_subscriptions:  makeBuilder({ data: [], error: null }),
    }
    mockFrom.mockImplementation((table) => builders[table])
  })

  it('sélectionne une liste explicite de colonnes (pas "*") sur profiles', async () => {
    await exportUserData('u1')
    const selectArg = builders.profiles.select.mock.calls[0][0]
    expect(selectArg).not.toBe('*')
  })

  it('exclut chaque champ interne/admin de la sélection profiles (allow-list, pas deny-list)', async () => {
    await exportUserData('u1')
    const selectArg = builders.profiles.select.mock.calls[0][0]
    const selectedCols = selectArg.split(',').map(c => c.trim())
    for (const forbidden of FORBIDDEN_PROFILE_FIELDS) {
      expect(selectedCols).not.toContain(forbidden)
    }
  })

  it('inclut les préférences utilisateur réelles (username, allergen_prefs, language)', async () => {
    await exportUserData('u1')
    const selectArg = builders.profiles.select.mock.calls[0][0]
    const selectedCols = selectArg.split(',').map(c => c.trim())
    expect(selectedCols).toEqual(expect.arrayContaining(['username', 'allergen_prefs', 'language']))
  })
})

describe('triggerJsonDownload — contrat filename', () => {
  it('ajoute une seule extension .json quand le filename fourni n\'en a pas', () => {
    const originalCreateElement = document.createElement.bind(document)
    let capturedDownload = null
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        Object.defineProperty(el, 'download', {
          set: (v) => { capturedDownload = v },
          get: () => capturedDownload,
        })
      }
      return el
    })
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()

    triggerJsonDownload({ a: 1 }, 'fridge-data-12345')

    expect(capturedDownload.match(/\.json/g)).toHaveLength(1)
    vi.restoreAllMocks()
  })
})
