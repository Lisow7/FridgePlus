import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Régression : avant fix, une exception jetée par pushManager.subscribe()
// (ex : navigateur in-app restreint où le service push échoue après avoir
// accordé la permission JS) remontait comme unhandled rejection au lieu
// d'être retournée comme { error }, laissant le toggle UI silencieusement
// bloqué sans aucun feedback utilisateur.

const mockRpc = vi.hoisted(() => vi.fn())
const mockLogError = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    from: () => ({ delete: () => ({ eq: vi.fn() }) }),
  },
}))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: mockLogError }))

import { subscribeToPush, unsubscribeFromPush } from '@features/push-notifications/api/push-subscriptions'

// Un `navigator.serviceWorker` avec un service worker enregistré ET actif.
const navigateurAvecServiceWorker = (registration) => ({
  getRegistration: () => Promise.resolve(registration),
  ready: Promise.resolve(registration),
})

describe('subscribeToPush — gestion d\'erreur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // urlBase64ToUint8Array(vapidPublicKey) tourne avant l'appel à
    // pushManager.subscribe() mocké ci-dessous — sans cette var d'env, elle
    // plante sur un undefined.length AVANT d'atteindre le mock, ce qui casse
    // le test uniquement quand VITE_VAPID_PUBLIC_KEY n'est pas dans l'env
    // (ex: CI, contrairement à un .env.local de dev qui la définit déjà).
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AAAAAAAA')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('retourne { error } au lieu de throw quand pushManager.subscribe() échoue', async () => {
    const subscribeError = new Error('AbortError: push service unreachable')
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    vi.stubGlobal('navigator', { serviceWorker: navigateurAvecServiceWorker({
      pushManager: { subscribe: vi.fn().mockRejectedValue(subscribeError) },
    }) })

    const result = await subscribeToPush()

    expect(result.error).toBe(subscribeError)
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(subscribeError, { tag: 'push.subscribe' })
  })

  // Vu le 2026-10-15 sur localhost (pas de service worker en dev, `devOptions.enabled:
  // false`) : `navigator.serviceWorker.ready` ne se résout jamais, l'interrupteur
  // restait « en cours » pour toujours — et la permission avait été demandée pour rien.
  it('sans service worker enregistré : { error: sw_missing } tout de suite, sans demander la permission', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('Notification', { requestPermission })
    vi.stubGlobal('navigator', { serviceWorker: {
      getRegistration: () => Promise.resolve(undefined),
      ready: new Promise(() => {}),
    } })

    const result = await subscribeToPush()

    expect(result.error.message).toBe('sw_missing')
    expect(requestPermission).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(result.error, { tag: 'push.subscribe' })
  })

  it('un service worker qui ne s’active jamais : { error: sw_timeout } après le délai, au lieu d’attendre pour toujours', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
      vi.stubGlobal('navigator', { serviceWorker: {
        getRegistration: () => Promise.resolve({ installing: {} }),
        ready: new Promise(() => {}),
      } })

      const promesse = subscribeToPush()
      await vi.advanceTimersByTimeAsync(8000)
      const result = await promesse

      expect(result.error.message).toBe('sw_timeout')
      expect(mockRpc).not.toHaveBeenCalled()
      expect(mockLogError).toHaveBeenCalledWith(result.error, { tag: 'push.subscribe' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('retourne { error: vapid_key_missing } sans planter si VITE_VAPID_PUBLIC_KEY est absente (ex: mauvais env Vercel)', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '')
    const subscribeMock = vi.fn()
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    vi.stubGlobal('navigator', { serviceWorker: navigateurAvecServiceWorker({ pushManager: { subscribe: subscribeMock } }) })

    const result = await subscribeToPush()

    expect(result.error.message).toBe('vapid_key_missing')
    expect(subscribeMock).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(result.error, { tag: 'push.subscribe' })
  })
})

describe('unsubscribeFromPush — gestion d\'erreur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retourne { error } au lieu de throw quand getSubscription() échoue', async () => {
    const unsubscribeError = new Error('service worker registration lost')
    vi.stubGlobal('navigator', { serviceWorker: navigateurAvecServiceWorker({
      pushManager: { getSubscription: vi.fn().mockRejectedValue(unsubscribeError) },
    }) })

    const result = await unsubscribeFromPush()

    expect(result.error).toBe(unsubscribeError)
    expect(mockLogError).toHaveBeenCalledWith(unsubscribeError, { tag: 'push.unsubscribe' })
  })
})
