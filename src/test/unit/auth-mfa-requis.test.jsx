import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

// AuthProvider dit si le code de double authentification est dû (audit du
// 2026-10-04, CPT-01, CPT-02).
//
// La porte « Vérification en 2 étapes » lit `mfaRequired`. Il doit être posé
// dans le MÊME rendu que l'utilisateur (pas d'image où l'app est visible), sur
// tout événement — y compris PASSWORD_RECOVERY, qui ne posait pas
// l'utilisateur : le lien « mot de passe oublié » ouvrait le compte sans code.
// Et `isAdmin` reste faux tant que le code n'est pas donné.

const mockOnAuthStateChange = vi.hoisted(() => vi.fn())
const mockProfileSingle = vi.hoisted(() => vi.fn())

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
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
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

const encoder = (objet) => btoa(JSON.stringify(objet)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jeton = (aal) => `${encoder({ alg: 'HS256' })}.${encoder({ sub: 'u-1', aal })}.signature`
const ADMIN = { id: 'u-1', email: 'admin@exemple.test', updated_at: '2026-10-05T10:00:00Z', factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] }
const SANS_FACTEUR = { ...ADMIN, factors: [] }
const session = (user, aal) => ({ user, access_token: jeton(aal) })

async function emettre(evenement, s) {
  await act(async () => { await authCallback(evenement, s) })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  mockProfileSingle.mockResolvedValue({ data: { id: 'u-1', role: 'admin', username: 'admin' }, error: null })
  mockOnAuthStateChange.mockImplementation((cb) => {
    authCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

describe('le code de double authentification, vu par AuthProvider', () => {
  it('connexion au mot de passe d’un compte protégé : code dû, et pas encore admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', session(ADMIN, 'aal1'))
    expect(result.current.mfaRequired).toBe(true)
    expect(result.current.mfaFactorId).toBe('f1')
    expect(result.current.isAdmin).toBe(false)
  })

  it('code donné (MFA_CHALLENGE_VERIFIED, aal2) : plus rien n’est dû, l’admin redevient admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', session(ADMIN, 'aal1'))
    await emettre('MFA_CHALLENGE_VERIFIED', session(ADMIN, 'aal2'))
    expect(result.current.mfaRequired).toBe(false)
    expect(result.current.isAdmin).toBe(true)
  })

  it('lien « mot de passe oublié » (PASSWORD_RECOVERY) d’un compte protégé : le code est dû', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('PASSWORD_RECOVERY', session(ADMIN, 'aal1'))
    expect(result.current.recoveryMode).toBe(true)
    expect(result.current.mfaRequired).toBe(true)
  })

  it('posé dans le même rendu que l’utilisateur : jamais un rendu « connecté sans porte »', async () => {
    const vus = []
    renderHook(() => { const a = useAuth(); vus.push({ user: !!a.user, mfa: a.mfaRequired }); return a }, { wrapper })
    await emettre('SIGNED_IN', session(ADMIN, 'aal1'))
    expect(vus.some((v) => v.user && !v.mfa)).toBe(false)
  })

  it('compte sans double authentification : rien n’est dû', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', session(SANS_FACTEUR, 'aal1'))
    expect(result.current.mfaRequired).toBe(false)
    expect(result.current.isAdmin).toBe(true)
  })

  it('déconnexion : rien n’est dû', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', session(ADMIN, 'aal1'))
    await emettre('SIGNED_OUT', null)
    expect(result.current.mfaRequired).toBe(false)
  })
})
