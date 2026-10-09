import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// Retour sur l'onglet (audit du 2026-10-04, PERF-08).
//
// Dès qu'un onglet redevient visible (téléphone qui se réveille, changement
// d'onglet), supabase-js réémet SIGNED_IN avec la MÊME session. L'app relisait
// alors le profil (38 colonnes), réécrivait `last_login_at`, recevait l'écho
// temps réel de cette écriture, et posait un nouvel objet `user` : toute l'app
// re-rendait, deux ou trois fois, à chaque retour d'onglet.

const mockOnAuthStateChange = vi.hoisted(() => vi.fn())
const mockProfileSingle = vi.hoisted(() => vi.fn())
const mockProfileUpdateEq = vi.hoisted(() => vi.fn())
const mockProfileUpdate = vi.hoisted(() => vi.fn(() => ({ eq: mockProfileUpdateEq })))

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      signOut: vi.fn(() => Promise.resolve({})),
    },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
    from: (table) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: mockProfileSingle }) }),
        update: mockProfileUpdate,
      }
      return { insert: vi.fn(() => Promise.resolve({ error: null })) }
    },
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
  },
}))

import { AuthProvider, useAuth } from '@shared/contexts/auth-provider'

const wrapper = ({ children }) => React.createElement(AuthProvider, null, children)
let authCallback = null

const COMPTE = { id: 'u-1', email: 'a@exemple.test', updated_at: '2026-10-05T10:00:00Z' }

async function emettre(evenement, user) {
  await act(async () => { await authCallback(evenement, user ? { user } : null) })
  // Le chargement du profil est différé (setTimeout 0) : on le laisse passer.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const lecturesDuProfil = () => mockProfileSingle.mock.calls.length
const ecrituresDeConnexion = () => mockProfileUpdate.mock.calls.filter(([champs]) => 'last_login_at' in champs).length

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  authCallback = null
  mockOnAuthStateChange.mockImplementation((cb) => {
    authCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  mockProfileSingle.mockResolvedValue({ data: { id: 'u-1', username: 'alice' }, error: null })
  mockProfileUpdateEq.mockResolvedValue({ error: null })
})

describe('retour sur l’onglet', () => {
  it('même compte, inchangé : ni relecture, ni écriture, ni nouvel objet user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await emettre('INITIAL_SESSION', COMPTE)
    const avant = { user: result.current.user, lectures: lecturesDuProfil(), ecritures: ecrituresDeConnexion() }

    await emettre('SIGNED_IN', { ...COMPTE })

    expect(lecturesDuProfil()).toBe(avant.lectures)
    expect(ecrituresDeConnexion()).toBe(avant.ecritures)
    expect(result.current.user).toBe(avant.user)
  })

  it('un compte qui a changé (updated_at) est relu', async () => {
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await emettre('INITIAL_SESSION', COMPTE)
    const lectures = lecturesDuProfil()

    await emettre('SIGNED_IN', { ...COMPTE, updated_at: '2026-10-05T11:00:00Z' })

    expect(lecturesDuProfil()).toBe(lectures + 1)
  })

  it('après une déconnexion, se reconnecter relit le profil', async () => {
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await emettre('INITIAL_SESSION', COMPTE)
    await emettre('SIGNED_OUT', null)
    const lectures = lecturesDuProfil()

    await emettre('SIGNED_IN', COMPTE)

    expect(lecturesDuProfil()).toBe(lectures + 1)
  })
})

describe('last_login_at : une fois par session de navigateur', () => {
  it('un rechargement dans le même onglet ne le réécrit pas', async () => {
    const premier = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await emettre('INITIAL_SESSION', COMPTE)
    expect(ecrituresDeConnexion()).toBe(1)
    premier.unmount()

    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await emettre('INITIAL_SESSION', COMPTE)

    expect(ecrituresDeConnexion()).toBe(1)
  })

  it('un autre compte dans le même onglet est horodaté', async () => {
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await emettre('INITIAL_SESSION', COMPTE)
    await emettre('SIGNED_OUT', null)

    await emettre('SIGNED_IN', { id: 'u-2', email: 'b@exemple.test', updated_at: '2026-10-05T10:00:00Z' })

    expect(ecrituresDeConnexion()).toBe(2)
  })
})
