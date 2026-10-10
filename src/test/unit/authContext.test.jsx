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
const mockRpc                = vi.hoisted(() => vi.fn())
const mockResend             = vi.hoisted(() => vi.fn())
const mockInvoke             = vi.hoisted(() => vi.fn())

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
      resend:                 mockResend,
    },
    rpc: mockRpc,
    functions: { invoke: mockInvoke },
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
  // `last_login_at` ne s'écrit qu'une fois par session de navigateur
  // (PERF-08) : chaque test part d'une session vierge.
  sessionStorage.clear()
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
  mockRpc.mockResolvedValue({ data: null, error: null })
  mockResend.mockResolvedValue({ error: null })
  mockInvoke.mockResolvedValue({ data: null, error: null })
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
    it('appelle signInWithPassword avec l’e-mail sans ses espaces et le mot de passe', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.signInWithEmail('  alice@test.com  ', 'Pass1!')
      })
      expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'alice@test.com', password: 'Pass1!' })
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

    // « Se souvenir de moi » : la case existe encore à l'écran mais rien ne la
    // lit (`signInWithEmail` ne reçoit plus `rememberMe`). Un test ignoré
    // promettait `persistSession: false` depuis la v3.18 ; retiré — la planche
    // n° 5 (`se_souvenir`) tranche si la case agit de nouveau ou disparaît, et
    // le lot qui en sortira écrira ses tests.
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

    // Audit du 2026-10-04, CPT-06 : la case « j'accepte » ne faisait
    // qu'autoriser le bouton, rien ne partait vers la base. Le déclencheur
    // `handle_new_user` date maintenant l'acceptation quand elle est transmise.
    it('transmet l\'acceptation des conditions quand la case est cochée', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.signUpWithEmail('bob@test.com', 'Pass1!', 'Bob', 'fr', { consentAccepted: true })
      })
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'bob@test.com',
        password: 'Pass1!',
        options: { data: { username: 'Bob', lang: 'fr', consent_accepted: true } },
      })
    })

    it('ne transmet AUCUNE acceptation quand elle n\'est pas donnée', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.signUpWithEmail('bob@test.com', 'Pass1!', 'Bob', 'fr', { consentAccepted: false })
      })
      expect(mockSignUp.mock.calls[0][0].options.data).not.toHaveProperty('consent_accepted')
    })
  })

  // ─── Preuve d'acceptation (parcours Google) ───────────────────────────────
  describe('recordSignupConsent', () => {
    it('demande à la base de dater l\'acceptation, et la reporte dans le profil', async () => {
      mockRpc.mockResolvedValueOnce({ data: '2026-10-04T21:38:50+00:00', error: null })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', consent_terms_accepted_at: null })
      let res
      await act(async () => { res = await result.current.recordSignupConsent() })
      expect(mockRpc).toHaveBeenCalledWith('record_signup_consent')
      expect(res.error).toBeNull()
      expect(result.current.profile.consent_terms_accepted_at).toBe('2026-10-04T21:38:50+00:00')
      expect(result.current.profile.consent_privacy_accepted_at).toBe('2026-10-04T21:38:50+00:00')
    })

    it('la date vient du serveur : le navigateur n\'en écrit aucune dans profiles', async () => {
      mockRpc.mockResolvedValueOnce({ data: '2026-10-04T21:38:50+00:00', error: null })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', consent_terms_accepted_at: null })
      mockProfileUpdate.mockClear()
      await act(async () => { await result.current.recordSignupConsent() })
      for (const [champs] of mockProfileUpdate.mock.calls) {
        expect(champs).not.toHaveProperty('consent_terms_accepted_at')
        expect(champs).not.toHaveProperty('consent_privacy_accepted_at')
      }
    })

    it('rend l\'erreur et laisse le profil tel quel', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', consent_terms_accepted_at: null })
      let res
      await act(async () => { res = await result.current.recordSignupConsent() })
      expect(res.error).toBeTruthy()
      expect(result.current.profile.consent_terms_accepted_at).toBeNull()
    })

    it('un appel qui lève rend une erreur au lieu de casser l\'écran', async () => {
      mockRpc.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', consent_terms_accepted_at: null })
      let res
      await act(async () => { res = await result.current.recordSignupConsent() })
      expect(res.error).toBeTruthy()
    })
  })

  // ─── Accord aux allergènes (décision du 2026-10-06) ─────────────────────
  // Une donnée de santé ne s'enregistre qu'avec un accord explicite (RGPD
  // art. 9.2.a). La base le date ; le retirer efface les allergènes ET la date.
  describe('accord aux allergènes', () => {
    it('donner son accord : la base le date, et le profil le sait', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: [], allergen_consent_at: null })
      expect(result.current.allergenConsentAt).toBeNull()
      mockRpc.mockResolvedValueOnce({ data: '2026-10-06T12:00:00+00:00', error: null })
      let res
      await act(async () => { res = await result.current.acceptAllergenConsent() })
      expect(mockRpc).toHaveBeenCalledWith('accepter_l_enregistrement_des_allergenes')
      expect(res.error).toBeNull()
      expect(result.current.allergenConsentAt).toBe('2026-10-06T12:00:00+00:00')
    })

    it('accord refusé par la base : rien ne change, et l’erreur est rendue', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: [], allergen_consent_at: null })
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      let res
      await act(async () => { res = await result.current.acceptAllergenConsent() })
      expect(res.error).toBeTruthy()
      expect(result.current.allergenConsentAt).toBeNull()
    })

    it('retirer son accord : les allergènes ET la date s’effacent', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: ['gluten'], allergen_consent_at: '2026-10-06T12:00:00+00:00' })
      await waitFor(() => expect(result.current.allergenPrefs).toEqual(['gluten']))
      mockRpc.mockResolvedValueOnce({ data: null, error: null })
      let res
      await act(async () => { res = await result.current.withdrawAllergenConsent() })
      expect(mockRpc).toHaveBeenCalledWith('retirer_l_accord_allergenes')
      expect(res.error).toBeNull()
      expect(result.current.allergenPrefs).toEqual([])
      expect(result.current.allergenConsentAt).toBeNull()
    })

    it('sans accord, un allergène ne part même pas vers la base', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: [], allergen_consent_at: null })
      mockProfileUpdateEq.mockClear()
      let res
      await act(async () => { res = await result.current.updateAllergenPrefs(['gluten']) })
      expect(res.error?.message).toBe('allergen_consent_required')
      expect(mockProfileUpdateEq).not.toHaveBeenCalled()
      expect(result.current.allergenPrefs).toEqual([])
    })
  })

  // ─── Allergènes (CPT-11) ──────────────────────────────────────────────────
  // Réglage de sécurité alimentaire : l'écran changeait AVANT l'écriture et
  // gardait la nouvelle valeur si elle échouait — la personne se croyait
  // protégée, l'allergie disparaissait au rechargement.
  describe('updateAllergenPrefs', () => {
    it('écriture acceptée : les allergènes sont gardés', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: ['gluten'], allergen_consent_at: '2026-10-06T12:00:00+00:00' })
      let res
      await act(async () => { res = await result.current.updateAllergenPrefs(['gluten', 'peanuts']) })
      expect(res.error).toBeNull()
      expect(result.current.allergenPrefs).toEqual(['gluten', 'peanuts'])
    })

    it('écriture refusée : l\'écran revient aux allergènes enregistrés, et l\'erreur est rendue', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: ['gluten'], allergen_consent_at: '2026-10-06T12:00:00+00:00' })
      await waitFor(() => expect(result.current.allergenPrefs).toEqual(['gluten']))
      mockProfileUpdateEq.mockResolvedValueOnce({ error: { message: 'Failed to fetch' } })
      let res
      await act(async () => { res = await result.current.updateAllergenPrefs(['gluten', 'peanuts']) })
      expect(res.error).toBeTruthy()
      expect(result.current.allergenPrefs).toEqual(['gluten'])
    })

    // Deux réglages rapprochés (deux puces cochées coup sur coup dans les
    // filtres). « Revenir à l'état d'avant le geste » peut alors afficher des
    // allergènes que la base n'a pas — ou cacher ceux qu'elle a.
    it('deux réglages rapprochés, tous deux refusés : l\'écran revient à ce qui est enregistré', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: [], allergen_consent_at: '2026-10-06T12:00:00+00:00' })
      const panne = { error: { message: 'Failed to fetch' } }
      let refuserLePremier, refuserLeSecond
      mockProfileUpdateEq
        .mockReturnValueOnce(new Promise((resolve) => { refuserLePremier = () => resolve(panne) }))
        .mockReturnValueOnce(new Promise((resolve) => { refuserLeSecond = () => resolve(panne) }))
      let premier, second
      act(() => { premier = result.current.updateAllergenPrefs(['gluten']) })
      act(() => { second = result.current.updateAllergenPrefs(['gluten', 'peanuts']) })
      expect(result.current.allergenPrefs).toEqual(['gluten', 'peanuts'])
      await act(async () => { refuserLePremier(); await premier })
      await act(async () => { refuserLeSecond(); await second })
      expect(result.current.allergenPrefs).toEqual([])
    })

    it('le premier réglage est refusé APRÈS que le second a été accepté : l\'écran garde ce que la base contient', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: [], allergen_consent_at: '2026-10-06T12:00:00+00:00' })
      let refuserLePremier
      mockProfileUpdateEq
        .mockReturnValueOnce(new Promise((resolve) => { refuserLePremier = () => resolve({ error: { message: 'Failed to fetch' } }) }))
        .mockResolvedValueOnce({ error: null })
      let premier
      act(() => { premier = result.current.updateAllergenPrefs(['gluten']) })
      await act(async () => { await result.current.updateAllergenPrefs(['gluten', 'peanuts']) })
      expect(result.current.allergenPrefs).toEqual(['gluten', 'peanuts'])
      await act(async () => { refuserLePremier(); await premier })
      expect(result.current.allergenPrefs).toEqual(['gluten', 'peanuts'])
    })

    it('un appel qui lève (réseau coupé) : l\'écran revient en arrière et l\'erreur est rendue, sans exception', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: ['gluten'], allergen_consent_at: '2026-10-06T12:00:00+00:00' })
      await waitFor(() => expect(result.current.allergenPrefs).toEqual(['gluten']))
      mockProfileUpdateEq.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      let res
      await act(async () => { res = await result.current.updateAllergenPrefs(['gluten', 'peanuts']) })
      expect(res.error).toBeTruthy()
      expect(result.current.allergenPrefs).toEqual(['gluten'])
    })

    // Les allergènes disent quelque chose de la santé de quelqu'un : une
    // réponse en retard ne doit pas les afficher à la personne suivante.
    it('déconnexion pendant l\'écriture : un refus tardif n\'affiche pas les allergènes du compte précédent', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', allergen_prefs: ['gluten'], allergen_consent_at: '2026-10-06T12:00:00+00:00' })
      await waitFor(() => expect(result.current.allergenPrefs).toEqual(['gluten']))
      let refuser
      mockProfileUpdateEq.mockReturnValueOnce(new Promise((resolve) => { refuser = () => resolve({ error: { message: 'Failed to fetch' } }) }))
      let ecriture
      act(() => { ecriture = result.current.updateAllergenPrefs(['gluten', 'peanuts']) })
      await act(async () => { await authCallback('SIGNED_OUT', null) })
      await waitFor(() => expect(result.current.allergenPrefs).toEqual([]))
      await act(async () => { refuser(); await ecriture })
      expect(result.current.allergenPrefs).toEqual([])
    })

    it('invité : gardés sur l\'appareil ; si le stockage refuse, l\'erreur est rendue', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => { res = await result.current.updateAllergenPrefs(['gluten']) })
      expect(res.error).toBeNull()
      expect(JSON.parse(localStorage.getItem('fridge-allergen-prefs'))).toEqual(['gluten'])

      const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
      try {
        await act(async () => { res = await result.current.updateAllergenPrefs(['gluten', 'peanuts']) })
      } finally { ecrire.mockRestore() }
      expect(res.error).toBeTruthy()
      expect(result.current.allergenPrefs).toEqual(['gluten'])
    })
  })

  // ─── Renvoi de l'e-mail de confirmation (CPT-13) ──────────────────────────
  describe('resendSignupEmail', () => {
    it('demande un nouvel e-mail de confirmation pour l\'adresse, sans espaces', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => { res = await result.current.resendSignupEmail('  bob@test.com ') })
      expect(mockResend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'bob@test.com' }))
      expect(res.error).toBeNull()
    })

    it('rend l\'erreur du service (trop de demandes, réseau)', async () => {
      mockResend.mockResolvedValueOnce({ error: { status: 429, message: 'For security purposes, you can only request this after 60 seconds.' } })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      let res
      await act(async () => { res = await result.current.resendSignupEmail('bob@test.com') })
      expect(res.error.status).toBe(429)
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

    // L'e-mail « ton pseudo a été modifié » est une alerte de sécurité. Le
    // PREMIER choix du pseudo (compte Google : le pseudo d'attente posé par la
    // base est remplacé) n'en est pas un : avant le 2026-10-04, toute nouvelle
    // inscription Google recevait cette alerte dès son arrivée.
    it('changer un pseudo confirmé prévient par e-mail', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', username: 'Bob', username_confirmed: true })
      await act(async () => { await result.current.updateProfile({ username: 'Bobby' }) })
      expect(mockInvoke).toHaveBeenCalledWith('send-profile-change-notification', {
        body: expect.objectContaining({ type: 'pseudo', oldValue: 'Bob', newValue: 'Bobby' }),
      })
    })

    it('premier choix du pseudo : aucun e-mail « pseudo modifié »', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await signInAs('u-1', { id: 'u-1', username: 'chef_1a2b3c4d', username_confirmed: false })
      await act(async () => { await result.current.updateProfile({ username: 'Jean_42', username_confirmed: true }) })
      expect(result.current.profile.username).toBe('Jean_42')
      expect(mockInvoke).not.toHaveBeenCalled()
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

  // ─── updateEmail ──────────────────────────────────────────────────────────
  // (updatePassword et verifyCurrentPassword, sans appelant, sont parties au lot 16c.)
  describe('updateEmail', () => {
    it('updateEmail appelle supabase.auth.updateUser', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitFor(() => expect(authCallback).not.toBeNull())
      await act(async () => { await authCallback('INITIAL_SESSION', null) })
      await act(async () => {
        await result.current.updateEmail('new@test.com')
      })
      expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'new@test.com' })
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
