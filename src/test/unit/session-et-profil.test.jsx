import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// Session et profil (audit du 2026-10-04, PREM-06 et CPT-12).
//
// `loading` passe à faux AVANT que le profil arrive : pendant ce temps, un
// abonné voit le verrou Premium, un admin perd son rôle (PREM-06). Si le
// profil ne charge pas, la personne reste « connectée sans profil », sans un
// mot (CPT-12). Une réponse tardive du compte A pouvait écraser le profil du
// compte B. Et le temps réel fusionnait la ligne ENTIÈRE de `profiles`, y
// compris `restore_token`, que `fetchProfile` exclut exprès.

const mockOnAuthStateChange = vi.hoisted(() => vi.fn())
const mockProfileSingle     = vi.hoisted(() => vi.fn())
const mockProfileUpdateEq   = vi.hoisted(() => vi.fn())
const mockProfileUpdate     = vi.hoisted(() => vi.fn(() => ({ eq: mockProfileUpdateEq })))
const mockChannelOn         = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      signOut: vi.fn().mockResolvedValue({}),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: vi.fn() },
    from: (table) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: mockProfileSingle }) }),
        update: mockProfileUpdate,
      }
      return {}
    },
    // Le temps réel : on garde le gestionnaire pour lui envoyer une ligne.
    channel: () => ({ on: (_event, _filtre, handler) => { mockChannelOn(handler); return { subscribe: vi.fn() } } }),
    removeChannel: vi.fn(),
  },
}))

import { AuthProvider, useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'

const wrapper = ({ children }) => React.createElement(AuthProvider, null, children)
let authCallback = null

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  authCallback = null
  mockOnAuthStateChange.mockImplementation((cb) => {
    authCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  // Par défaut, la base répond « pas de profil » sans erreur jetée : les
  // nouvelles tentatives de l'effet de secours ne font pas de bruit.
  mockProfileSingle.mockResolvedValue({ data: null, error: null })
  mockProfileUpdateEq.mockReturnValue({ then: (cb) => cb({ error: null }) })
})
afterEach(() => { vi.useRealTimers() })

// Le chargement du profil est différé (setTimeout 0) : on laisse passer le tour.
const laisserPartirLaLecture = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

/** Une lecture de profil que le test résout quand il veut. */
function lectureEnAttente() {
  let resoudre
  mockProfileSingle.mockImplementationOnce(() => new Promise((r) => { resoudre = r }))
  return (data) => act(async () => { resoudre({ data, error: null }); await Promise.resolve() })
}

async function monter(hook = useAuth) {
  const rendu = renderHook(hook, { wrapper })
  await waitFor(() => expect(authCallback).not.toBeNull())
  return rendu
}

describe('profileLoading : un compte connecté dont le profil n’est pas encore là', () => {
  it('vrai pendant la lecture, faux une fois le profil arrivé', async () => {
    const { result } = await monter()
    const repondre = lectureEnAttente()
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u-1' } }) })
    await laisserPartirLaLecture()

    expect(result.current.loading).toBe(false)
    expect(result.current.user).toEqual({ id: 'u-1' })
    expect(result.current.profile).toBeNull()
    expect(result.current.profileLoading).toBe(true)

    await repondre({ id: 'u-1', username: 'Alice' })
    expect(result.current.profile).toMatchObject({ username: 'Alice' })
    expect(result.current.profileLoading).toBe(false)
  })

  it('faux pour un visiteur (pas de compte, rien à attendre)', async () => {
    const { result } = await monter()
    await act(async () => { await authCallback('INITIAL_SESSION', null) })
    expect(result.current.profileLoading).toBe(false)
  })

  it('useSubscription l’expose, et ne dit pas « pas Premium » tant qu’on ne sait pas', async () => {
    const { result } = await monter(useSubscription)
    const repondre = lectureEnAttente()
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u-1' } }) })
    await laisserPartirLaLecture()
    expect(result.current.profileLoading).toBe(true)
    expect(result.current.hasPremiumAccess).toBe(false)

    await repondre({ id: 'u-1', subscription_status: 'comped' })
    expect(result.current.profileLoading).toBe(false)
    expect(result.current.hasPremiumAccess).toBe(true)
  })
})

describe('profilIndisponible : quand la base ne rend jamais le profil', () => {
  // Minuteurs réels : la lecture différée puis les quatre tentatives (200, 500,
  // 1 000, 2 000 ms) font 3,7 s — le test les attend vraiment.
  it('après les tentatives, l’app le dit ; relancerLeProfil relit', async () => {
    const { result } = await monter()
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u-1' } }) })
    await waitFor(() => expect(result.current.profilIndisponible).toBe(true), { timeout: 6000 })

    expect(result.current.profile).toBeNull()
    expect(result.current.profileLoading).toBe(false)
    const tentatives = mockProfileSingle.mock.calls.length
    expect(tentatives).toBeGreaterThanOrEqual(4)

    mockProfileSingle.mockResolvedValue({ data: { id: 'u-1', username: 'Alice' }, error: null })
    act(() => { result.current.relancerLeProfil() })
    expect(result.current.profilIndisponible).toBe(false)
    expect(result.current.profileLoading).toBe(true)
    await waitFor(() => expect(result.current.profile).toMatchObject({ username: 'Alice' }))
    expect(mockProfileSingle.mock.calls.length).toBeGreaterThan(tentatives)
  }, 10000)
})

describe('deux comptes à la suite', () => {
  it('la réponse tardive du compte A n’écrase pas le profil du compte B', async () => {
    const { result } = await monter()
    const repondreA = lectureEnAttente()
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'A' } }) })
    await laisserPartirLaLecture()

    const repondreB = lectureEnAttente()
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'B' } }) })
    await laisserPartirLaLecture()
    expect(result.current.user).toEqual({ id: 'B' })

    await repondreA({ id: 'A', username: 'Alice' })
    expect(result.current.profile).toBeNull()

    await repondreB({ id: 'B', username: 'Bob' })
    expect(result.current.profile).toMatchObject({ id: 'B', username: 'Bob' })
  })
})

describe('temps réel', () => {
  it('ne fusionne que les colonnes que fetchProfile lit — jamais restore_token', async () => {
    const { result } = await monter()
    const repondre = lectureEnAttente()
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u-1' } }) })
    await laisserPartirLaLecture()
    await repondre({ id: 'u-1', username: 'Alice', banned: false })
    await waitFor(() => expect(mockChannelOn).toHaveBeenCalled())

    const recevoir = mockChannelOn.mock.calls[0][0]
    act(() => { recevoir({ new: { id: 'u-1', username: 'Alicia', banned: true, restore_token: 'jeton-secret' } }) })

    expect(result.current.profile).toMatchObject({ username: 'Alicia', banned: true })
    expect(result.current.profile).not.toHaveProperty('restore_token')
  })
})
