import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

// Une suppression de compte qui tient (audit du 2026-10-04, lot 4 : BDD-04,
// CPT-04 ; écrans validés par Antoine le 2026-10-05).
//
// (1) À CHAQUE événement d'authentification portant un utilisateur —
//     rechargement, retour d'onglet, rafraîchissement du jeton — AuthProvider
//     voyait `deleted_at` et l'effaçait : la suppression s'annulait en silence,
//     et la purge à 30 jours ne trouvait plus rien (droit à l'effacement).
//     Désormais : rien n'est annulé sans un geste explicite
//     (`annulerLaSuppression`, le bouton de l'écran « en cours de suppression »).
// (2) Après la suppression, le client fermait seulement son état
//     (`setUser(null)`) : la session restait dans le navigateur. Il se
//     déconnecte vraiment, et garde la date d'effacement pour l'écran
//     « Compte désactivé ».
// (3) La trace « account_soft_deleted » était écrite AVANT l'appel : elle
//     existait même quand la suppression échouait.

const mockOnAuthStateChange = vi.hoisted(() => vi.fn())
const mockProfileSingle = vi.hoisted(() => vi.fn())
const mockProfileUpdate = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))
const mockInsert = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))
const mockGetSession = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: { session: { access_token: 'jeton' } } })))

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: { onAuthStateChange: mockOnAuthStateChange, getSession: mockGetSession, signOut: mockSignOut },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
    from: (table) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: mockProfileSingle }) }),
        update: (champs) => { mockProfileUpdate(champs); return { eq: () => Promise.resolve({ error: null }) } },
      }
      return { insert: mockInsert }
    },
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
  },
}))

import { AuthProvider, useAuth } from '@shared/contexts/auth-provider'

const wrapper = ({ children }) => React.createElement(AuthProvider, null, children)
let authCallback = null
const COMPTE = { id: 'u-1', email: 'a@exemple.test', updated_at: '2026-10-05T10:00:00Z' }
const SUPPRIME_LE = '2026-10-05T10:00:00.000Z'

async function emettre(evenement, user) {
  await act(async () => { await authCallback(evenement, user ? { user, access_token: 'x.e30.y' } : null) })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const annulations = () => mockProfileUpdate.mock.calls.filter(([c]) => 'deleted_at' in c && c.deleted_at === null)

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
  mockProfileSingle.mockResolvedValue({ data: { id: 'u-1', username: 'moi', deleted_at: SUPPRIME_LE }, error: null })
  mockOnAuthStateChange.mockImplementation((cb) => {
    authCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

describe('rien n’annule une suppression sans un geste explicite', () => {
  it.each(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'])('%s d’un compte en cours de suppression : AUCUNE annulation', async (evenement) => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre(evenement, COMPTE)
    expect(annulations()).toEqual([])
    expect(result.current.profile?.deleted_at).toBe(SUPPRIME_LE)
  })

  it('« Annuler la suppression » (annulerLaSuppression) : l’annulation est écrite, et le profil la reflète', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', COMPTE)
    let retour
    await act(async () => { retour = await result.current.annulerLaSuppression() })
    expect(retour.error).toBeNull()
    expect(annulations()).toEqual([[{ deleted_at: null, restore_token: null }]])
    expect(result.current.profile.deleted_at).toBeNull()
  })
})

describe('la suppression ferme vraiment la session', () => {
  const reponse = (ok, corps) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(corps) })

  it('succès : la session est fermée, la date d’effacement est gardée, la trace est écrite APRÈS', async () => {
    fetch.mockReturnValue(reponse(true, { success: true, retentionDays: 30, expiresAt: '2026-11-04T10:00:00.000Z' }))
    mockProfileSingle.mockResolvedValue({ data: { id: 'u-1', username: 'moi', deleted_at: null }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', COMPTE)
    let retour
    await act(async () => { retour = await result.current.deleteAccount('fr') })
    expect(retour.error).toBeNull()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(result.current.compteDesactive).toEqual({ effaceLe: '2026-11-04T10:00:00.000Z' })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ action: 'account_soft_deleted' }))
    expect(mockInsert.mock.invocationCallOrder[0]).toBeGreaterThan(fetch.mock.invocationCallOrder[0])
  })

  it('échec : ni déconnexion, ni trace, ni écran « désactivé »', async () => {
    fetch.mockReturnValue(reponse(false, { error: 'server_error' }))
    mockProfileSingle.mockResolvedValue({ data: { id: 'u-1', username: 'moi', deleted_at: null }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', COMPTE)
    let retour
    await act(async () => { retour = await result.current.deleteAccount('fr') })
    expect(retour.error).toBeTruthy()
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'account_soft_deleted' }))
    expect(result.current.compteDesactive).toBeNull()
  })

  it('« Retour à l’accueil » oublie l’écran « Compte désactivé »', async () => {
    fetch.mockReturnValue(reponse(true, { success: true, retentionDays: 30, expiresAt: '2026-11-04T10:00:00.000Z' }))
    mockProfileSingle.mockResolvedValue({ data: { id: 'u-1', username: 'moi', deleted_at: null }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await emettre('SIGNED_IN', COMPTE)
    await act(async () => { await result.current.deleteAccount('fr') })
    act(() => { result.current.oublierCompteDesactive() })
    expect(result.current.compteDesactive).toBeNull()
  })
})
