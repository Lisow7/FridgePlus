import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Audit du 2026-10-04, lot 16c (CPT-15 (1), (4), (5)) : l'interrupteur des notifications dit
// l'état de CET appareil — l'abonnement que tient le navigateur, rattaché au compte courant —,
// et non les préférences du compte. Avant : à la reconnexion, il disait « Activées » sans
// abonnement, et le couper éteignait les rappels sur tous les autres appareils du compte.
// Un refus du navigateur (« Bloquer ») se distingue d'une panne ; une ligne refusée ou une
// lecture qui échoue ne se tait plus.

const m = vi.hoisted(() => ({
  deleteEq: vi.fn(), compter: vi.fn(), maybeSingle: vi.fn(),
  prefsSingle: vi.fn(), prefsUpdateEq: vi.fn(), prefsUpdates: [], getUser: vi.fn(), rpc: vi.fn(), logError: vi.fn(),
}))

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: m.getUser },
    rpc: m.rpc,
    from: (table) => {
      if (table === 'push_subscriptions') return {
        delete: () => ({ eq: m.deleteEq }),
        select: (colonnes, options) => (options?.head ? m.compter() : { eq: () => ({ maybeSingle: m.maybeSingle }) }),
      }
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: m.prefsSingle }) }),
        update: (payload) => { m.prefsUpdates.push(payload); return { eq: m.prefsUpdateEq } },
      }
      return {}
    },
  },
}))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: m.logError }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => true }))

import { unsubscribeFromPush } from '@features/push-notifications/api/push-subscriptions'
import { usePushSubscription } from '@features/push-notifications/lib/use-push-subscription'

const ENDPOINT = 'https://push.exemple/abc'

function navigateurAbonne(abonnement = { endpoint: ENDPOINT, unsubscribe: vi.fn().mockResolvedValue(true) }) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: {
      getSubscription: vi.fn().mockResolvedValue(abonnement),
      subscribe: vi.fn().mockResolvedValue(abonnement),
    } }) },
  })
  return abonnement
}
function navigateurSansAbonnement() {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }) },
  })
}
const TROIS_A_FAUX = { inactivity_reminder: false, announcements: false, stock_expiry: false }

beforeEach(() => {
  vi.clearAllMocks()
  m.prefsUpdates.length = 0
  m.deleteEq.mockResolvedValue({ error: null })
  m.compter.mockResolvedValue({ count: 0, error: null })
  m.maybeSingle.mockResolvedValue({ data: null, error: null })
  m.prefsSingle.mockResolvedValue({ data: { push_preferences: { inactivity_reminder: true, announcements: true, stock_expiry: true } }, error: null })
  m.prefsUpdateEq.mockResolvedValue({ error: null })
  m.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  m.rpc.mockResolvedValue({ error: null })
})
afterEach(() => {
  delete navigator.serviceWorker
  vi.unstubAllGlobals()
})

describe('unsubscribeFromPush — désactiver sur CET appareil', () => {
  it('la ligne de cet appareil refusée : l’erreur est rendue, le navigateur reste abonné, les préférences ne bougent pas', async () => {
    const abonnement = navigateurAbonne()
    const refus = { message: 'permission denied', code: '42501' }
    m.deleteEq.mockResolvedValue({ error: refus })

    const { error } = await unsubscribeFromPush()

    expect(error).toBe(refus)
    expect(abonnement.unsubscribe).not.toHaveBeenCalled()
    expect(m.prefsUpdates).toEqual([])
  })

  it('un autre appareil du compte reste abonné : ses rappels continuent, les préférences ne bougent pas', async () => {
    const abonnement = navigateurAbonne()
    m.compter.mockResolvedValue({ count: 1, error: null })

    const { error } = await unsubscribeFromPush()

    expect(error).toBeNull()
    expect(m.deleteEq).toHaveBeenCalledWith('endpoint', ENDPOINT)
    expect(abonnement.unsubscribe).toHaveBeenCalled()
    expect(m.prefsUpdates).toEqual([])
  })

  it('plus aucun appareil : les trois envois passent à faux', async () => {
    navigateurAbonne()
    m.compter.mockResolvedValue({ count: 0, error: null })

    const { error } = await unsubscribeFromPush()

    expect(error).toBeNull()
    expect(m.prefsUpdates).toEqual([{ push_preferences: expect.objectContaining(TROIS_A_FAUX) }])
  })
})

describe('usePushSubscription — l’état de CET appareil', () => {
  it('abonnement du navigateur rattaché au compte → activé', async () => {
    navigateurAbonne()
    m.maybeSingle.mockResolvedValue({ data: { endpoint: ENDPOINT }, error: null })
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.enabled).toBe(true))
    expect(result.current.error).toBeNull()
  })

  it('l’abonnement du navigateur appartient à un autre compte → désactivé', async () => {
    navigateurAbonne()
    m.maybeSingle.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => usePushSubscription())
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.enabled).toBe(false)
  })

  it('les préférences du compte disent oui, mais cet appareil n’a pas d’abonnement → désactivé', async () => {
    navigateurSansAbonnement()
    const { result } = renderHook(() => usePushSubscription())
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current.enabled).toBe(false)
  })

  it('une lecture de l’état qui échoue se dit : error = read_failed', async () => {
    navigateurAbonne()
    m.maybeSingle.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.error).toBe('read_failed'))
    expect(result.current.enabled).toBe(false)
  })

  it('un refus du navigateur se distingue d’une panne : error = permission_denied', async () => {
    navigateurSansAbonnement()
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') })
    const { result } = renderHook(() => usePushSubscription())
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    await act(async () => { await result.current.toggle() })
    expect(result.current.error).toBe('permission_denied')
    expect(result.current.enabled).toBe(false)
  })
})
