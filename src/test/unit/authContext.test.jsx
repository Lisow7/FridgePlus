import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockSignInWithPassword = vi.hoisted(() => vi.fn())
const mockSignUp             = vi.hoisted(() => vi.fn())
const mockAuthSignOut        = vi.hoisted(() => vi.fn())
const mockResetPwdForEmail   = vi.hoisted(() => vi.fn())
const mockUpdateUser         = vi.hoisted(() => vi.fn())
const mockSignInWithOAuth    = vi.hoisted(() => vi.fn())
const mockGetSession         = vi.hoisted(() => vi.fn())
const mockOnAuthStateChange  = vi.hoisted(() => vi.fn())
const mockProfileSingle      = vi.hoisted(() => vi.fn())
const mockProfileUpdateEq    = vi.hoisted(() => vi.fn())
const mockProfileUpdate      = vi.hoisted(() => vi.fn(() => ({ eq: mockProfileUpdateEq })))
const mockActivityInsert     = vi.hoisted(() => vi.fn())
const mockRemoveChannel      = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange:      mockOnAuthStateChange,
      signInWithPassword:     mockSignInWithPassword,
      signUp:                 mockSignUp,
      signOut:                mockAuthSignOut,
      resetPasswordForEmail:  mockResetPwdForEmail,
      updateUser:             mockUpdateUser,
      signInWithOAuth:        mockSignInWithOAuth,
      getSession:             mockGetSession,
    },
    from: (table) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: mockProfileSingle }) }),
        update: mockProfileUpdate,
      }
      if (table === 'activity_logs') return { insert: mockActivityInsert }
      return {}
    },
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) }),
    removeChannel: mockRemoveChannel,
  },
}))

import { AuthProvider, useAuth } from '@shared/contexts/auth-provider'

const wrapper = ({ children }) => React.createElement(AuthProvider, null, children)
let authCallback = null

beforeEach(() => {
  vi.clearAllMocks()
  authCallback = null

  mockOnAuthStateChange.mockImplementation((cb) => {
    authCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  mockProfileSingle.mockResolvedValue({ data: null, error: null })
  mockProfileUpdateEq.mockResolvedValue({ error: null })
  mockActivityInsert.mockResolvedValue({ error: null })
  mockSignInWithPassword.mockResolvedValue({ error: null })
  mockSignUp.mockResolvedValue({ error: null })
  mockAuthSignOut.mockResolvedValue({})
  mockResetPwdForEmail.mockResolvedValue({ error: null })
  mockUpdateUser.mockResolvedValue({ error: null })
  mockSignInWithOAuth.mockResolvedValue({ error: null })
  mockGetSession.mockResolvedValue({ data: { session: null } })
})

// Helper : simule SIGNED_IN avec un profil
async function signInAs(userId, profileData = null) {
  mockProfileSingle.mockResolvedValueOnce({ data: profileData, error: null })
  await act(async () => {
    await authCallback('SIGNED_IN', { user: { id: userId } })
  })
  // Le chargement du profil est désormais différé (setTimeout 0) pour éviter
  // le deadlock du verrou auth supabase-js → on flush le timer.
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

describe('AuthContext', () => {

  // ─── État initial ─────────────────────────────────────────────────────────
  describe('état initial', () => {
    it('user = null avant tout événement', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      expect(result.current.user).toBeNull()
    })

    it('profile = null avant tout événement', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      expect(result.current.profile).toBeNull()
    })

    it('loading devient false après callback vide', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      expect(result.current.loading).toBe(false)
    })

    it('recoveryMode = false par défaut', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      expect(result.current.recoveryMode).toBe(false)
    })
  })

  // ─── signInWithGoogle (OAuth) ──────────────────────────────────────────────
  describe('signInWithGoogle', () => {
    it('appelle signInWithOAuth avec provider google + scopes minimaux', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await result.current.signInWithGoogle() })
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: window.location.origin, scopes: 'email profile' },
      })
    })
  })

  // ─── Événements auth ─────────────────────────────────────────────────────
  describe('événements auth', () => {
    it('SIGNED_IN charge le profil et met user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      const fakeUser = { id: 'u-1' }
      mockProfileSingle.mockResolvedValueOnce({ data: { id: 'u-1', username: 'Alice' }, error: null })
      await act(async () => { await authCallback('SIGNED_IN', { user: fakeUser }) })
      expect(result.current.user).toEqual(fakeUser)
      // profil chargé en différé (setTimeout) → waitFor
      await waitFor(() => expect(result.current.profile).toMatchObject({ id: 'u-1', username: 'Alice' }))
    })

    it('SIGNED_OUT vide user et profile', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', username: 'Alice' })
      await act(async () => { await authCallback('SIGNED_OUT', null) })
      expect(result.current.user).toBeNull()
      expect(result.current.profile).toBeNull()
    })

    it('PASSWORD_RECOVERY active recoveryMode', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('PASSWORD_RECOVERY', null) })
      expect(result.current.recoveryMode).toBe(true)
    })

    it('isAdmin = true si profile.role === "admin"', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', role: 'admin' })
      expect(result.current.isAdmin).toBe(true)
    })

    it('isAdmin = false si profile.role !== "admin"', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', role: 'user' })
      expect(result.current.isAdmin).toBe(false)
    })
  })

  // ─── last_login_at (rétention « retour ») ─────────────────────────────────
  describe('last_login_at', () => {
    it('SIGNED_IN horodate last_login_at', async () => {
      renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u-1' } }) })
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ last_login_at: expect.any(String) }))
    })
    it('INITIAL_SESSION (avec user) horodate last_login_at', async () => {
      renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', { user: { id: 'u-1' } }) })
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      expect(mockProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ last_login_at: expect.any(String) }))
    })
    it('TOKEN_REFRESHED n\'horodate PAS (refresh de fond)', async () => {
      renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('TOKEN_REFRESHED', { user: { id: 'u-1' } }) })
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      expect(mockProfileUpdate).not.toHaveBeenCalled()
    })
  })

  // ─── signInWithEmail ──────────────────────────────────────────────────────
  describe('signInWithEmail', () => {
    // TODO v3.18.x — la signature passée à signInWithPassword n'inclut plus
    // l'option { persistSession }. La gestion remember-me est faite ailleurs
    // (cookie / storage). Réécrire l'assertion contre l'API actuelle.
    it.skip('appelle signInWithPassword avec email trimmé + password', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.signInWithEmail('  alice@test.com  ', 'Pass1!', true)
      })
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'alice@test.com',
        password: 'Pass1!',
        options: { persistSession: true },
      })
    })

    it('retourne { error: null } en cas de succès', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => {
        res = await result.current.signInWithEmail('a@b.com', 'Pass1!')
      })
      expect(res.error).toBeNull()
    })

    it('retourne { error } en cas d\'échec', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => {
        res = await result.current.signInWithEmail('a@b.com', 'wrong')
      })
      expect(res.error).toBeDefined()
    })

    // TODO v3.18.x — option { persistSession } n'est plus passée à
    // signInWithPassword (cf. test précédent). Réécrire selon l'API actuelle.
    it.skip('rememberMe=false passe persistSession=false', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.signInWithEmail('a@b.com', 'Pass1!', false)
      })
      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        expect.objectContaining({ options: { persistSession: false } })
      )
    })
  })

  // ─── signUpWithEmail ──────────────────────────────────────────────────────
  describe('signUpWithEmail', () => {
    it('appelle signUp avec email trimmé + username trimmé', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.signUpWithEmail('  bob@test.com  ', 'Pass1!', '  Bob  ')
      })
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'bob@test.com',
        password: 'Pass1!',
        options: { data: { username: 'Bob', lang: 'fr' } },
      })
    })

    it('transmet la langue dans user_metadata (options.data.lang)', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.signUpWithEmail('bob@test.com', 'Pass1!', 'Bob', 'en')
      })
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'bob@test.com',
        password: 'Pass1!',
        options: { data: { username: 'Bob', lang: 'en' } },
      })
    })

    it('retourne { error: null } en cas de succès', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => {
        res = await result.current.signUpWithEmail('bob@test.com', 'Pass1!', 'Bob')
      })
      expect(res.error).toBeNull()
    })
  })

  // ─── signOut ──────────────────────────────────────────────────────────────
  describe('signOut', () => {
    it('appelle supabase.auth.signOut', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1' })
      await act(async () => { await result.current.signOut() })
      expect(mockAuthSignOut).toHaveBeenCalled()
    })

    it('vide user et profile immédiatement', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1' })
      await act(async () => { await result.current.signOut() })
      expect(result.current.user).toBeNull()
      expect(result.current.profile).toBeNull()
    })
  })

  // ─── resetPassword ────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    it('appelle resetPasswordForEmail avec email trimmé', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.resetPassword('  reset@test.com  ')
      })
      expect(mockResetPwdForEmail).toHaveBeenCalledWith('reset@test.com', expect.any(Object))
    })

    it('retourne { error: null } en succès', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => {
        res = await result.current.resetPassword('reset@test.com')
      })
      expect(res.error).toBeNull()
    })
  })

  // ─── updateProfile ────────────────────────────────────────────────────────
  describe('updateProfile', () => {
    it('met à jour le profile local en cas de succès', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', username: 'Alice', role: 'user' })
      await act(async () => {
        await result.current.updateProfile({ username: 'AliceNew' })
      })
      expect(result.current.profile.username).toBe('AliceNew')
    })

    it('ne met pas à jour le profile local en cas d\'erreur', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', username: 'Alice' })
      // Le once-mock d'erreur est posé APRÈS signInAs pour viser updateProfile
      // (et non l'écriture last_login_at qui se produit aussi au signin).
      mockProfileUpdateEq.mockResolvedValueOnce({ error: { message: 'update failed' } })
      await act(async () => {
        await result.current.updateProfile({ username: 'AliceNew' })
      })
      expect(result.current.profile.username).toBe('Alice')
    })
  })

  // ─── updateEmail / updatePassword ─────────────────────────────────────────
  describe('updateEmail et updatePassword', () => {
    it('updateEmail appelle supabase.auth.updateUser', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.updateEmail('new@test.com')
      })
      expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'new@test.com' })
    })

    it('updatePassword appelle supabase.auth.updateUser', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.updatePassword('NewPass1!')
      })
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass1!' })
    })
  })

  // ─── completePasswordReset ────────────────────────────────────────────────
  describe('completePasswordReset', () => {
    it('désactive recoveryMode en cas de succès', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('PASSWORD_RECOVERY', null) })
      expect(result.current.recoveryMode).toBe(true)
      await act(async () => {
        await result.current.completePasswordReset('NewPass1!')
      })
      expect(result.current.recoveryMode).toBe(false)
    })

    it('appelle supabase.auth.signOut après le reset', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('PASSWORD_RECOVERY', null) })
      await act(async () => {
        await result.current.completePasswordReset('NewPass1!')
      })
      expect(mockAuthSignOut).toHaveBeenCalled()
    })

    it('ne désactive pas recoveryMode en cas d\'erreur', async () => {
      mockUpdateUser.mockResolvedValueOnce({ error: { message: 'weak password' } })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('PASSWORD_RECOVERY', null) })
      await act(async () => {
        await result.current.completePasswordReset('weak')
      })
      expect(result.current.recoveryMode).toBe(true)
    })
  })

  // ─── deleteAccount ────────────────────────────────────────────────────────
  describe('deleteAccount', () => {
    it('retourne erreur si pas de user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => { res = await result.current.deleteAccount() })
      expect(res.error).toBeDefined()
      expect(res.error.message).toMatch(/not authenticated/i)
    })

    it('retourne erreur si session absente', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1' })
      let res
      await act(async () => { res = await result.current.deleteAccount() })
      expect(res.error).toBeDefined()
      expect(res.error.message).toMatch(/no active session/i)
    })

    it('appelle fetch vers delete-account en cas de session valide', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: 'tok-123' } } })
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      vi.stubGlobal('fetch', fetchMock)
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1' })
      await act(async () => { await result.current.deleteAccount() })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('delete-account'),
        expect.objectContaining({ method: 'POST' })
      )
      vi.unstubAllGlobals()
    })
  })
})
