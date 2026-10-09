import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

const mockInitialize        = vi.hoisted(() => vi.fn())
const mockGetSession        = vi.hoisted(() => vi.fn())
const mockOnAuthStateChange = vi.hoisted(() => vi.fn())
const ordre                 = vi.hoisted(() => [])

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      initialize: mockInitialize,
      getSession: mockGetSession,
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
  },
}))

import { AuthProvider, useAuth } from '@shared/contexts/auth-provider'

const wrapper = ({ children }) => React.createElement(AuthProvider, null, children)
const arriverSur = (chemin) => window.history.replaceState(null, '', chemin)
const adresse = () => window.location.pathname + window.location.search + window.location.hash

// Audit du 2026-10-04, CPT-03 : un lien e-mail expiré, déjà utilisé ou ouvert
// dans un autre navigateur ne produisait ni session ni message.
describe('AuthProvider — retour d’un lien e-mail qui n’aboutit pas', () => {
  beforeEach(() => {
    ordre.length = 0
    mockOnAuthStateChange.mockReset()
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    mockInitialize.mockReset()
    mockInitialize.mockImplementation(async () => { ordre.push('initialize'); return { error: null } })
    mockGetSession.mockReset()
    mockGetSession.mockImplementation(async () => { ordre.push('getSession'); return { data: { session: null } } })
  })
  afterEach(() => arriverSur('/'))

  it('adresse ordinaire : rien à dire, et rien n’est demandé à la bibliothèque', async () => {
    arriverSur('/?recettes=1')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    expect(result.current.authLinkProblem).toBeNull()
    expect(mockInitialize).not.toHaveBeenCalled()
    expect(adresse()).toBe('/?recettes=1')
  })

  it('lien expiré ou déjà utilisé : le dit, et nettoie l’adresse', async () => {
    arriverSur('/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.authLinkProblem).toBe('expired'))
    expect(adresse()).toBe('/')
  })

  it('autre échec annoncé par le service : « échec »', async () => {
    arriverSur('/?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.authLinkProblem).toBe('failed'))
  })

  it('code ouvert dans un autre navigateur : aucune session → le dit', async () => {
    arriverSur('/?code=abc-123')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.authLinkProblem).toBe('no-session'))
    // La session est lue APRÈS que la bibliothèque a fini de traiter l'adresse.
    expect(ordre.indexOf('initialize')).toBeGreaterThanOrEqual(0)
    expect(ordre.indexOf('initialize')).toBeLessThan(ordre.lastIndexOf('getSession'))
    expect(adresse()).toBe('/')
  })

  it('code qui a bien ouvert une session : rien à dire', async () => {
    mockGetSession.mockImplementation(async () => { ordre.push('getSession'); return { data: { session: { user: { id: 'u-1' } } } } })
    arriverSur('/?code=abc-123')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())
    await act(async () => {})
    expect(result.current.authLinkProblem).toBeNull()
  })

  it('la bibliothèque qui lève n’empêche pas de répondre', async () => {
    mockInitialize.mockRejectedValue(new Error('boom'))
    arriverSur('/?code=abc-123')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.authLinkProblem).toBe('no-session'))
  })

  it('le message se ferme', async () => {
    arriverSur('/?error_code=otp_expired&error=access_denied')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.authLinkProblem).toBe('expired'))
    act(() => result.current.clearAuthLinkProblem())
    expect(result.current.authLinkProblem).toBeNull()
  })
})
