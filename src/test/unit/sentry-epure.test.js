import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { epurerLUrl, epurerLEvenement, epurerLeFilDAriane } from '@shared/lib/observability/sentry'

// Sentry joint l'URL de la page à chaque événement, et les miettes de
// navigation et d'appels réseau portent aussi des URL. Or un lien de
// restauration de compte porte `?restore-account=<jeton>`, le retour de Google
// `?code=`, et les appels REST des filtres `?id=eq.<uuid>` (audit du
// 2026-10-04, RGPD-18). Rien de la requête ni du fragment ne doit partir.

describe('Sentry : ni requête ni fragment dans ce qui part', () => {
  it('epurerLUrl garde l’origine et le chemin, rien d’autre', () => {
    expect(epurerLUrl('https://fridgeplus.app/FridgePlus/?restore-account=jeton-secret#x')).toBe('https://fridgeplus.app/FridgePlus/')
    expect(epurerLUrl('/profile/compte?code=abc')).toBe('/profile/compte')
    expect(epurerLUrl('/recipe/omelette#etape-2')).toBe('/recipe/omelette')
    expect(epurerLUrl('https://fridgeplus.app/')).toBe('https://fridgeplus.app/')
  })

  it('epurerLUrl laisse passer ce qui n’est pas une chaîne', () => {
    expect(epurerLUrl(undefined)).toBeUndefined()
    expect(epurerLUrl(null)).toBeNull()
  })

  it('beforeSend retire la requête de request.url et ne touche à rien d’autre', () => {
    const e = epurerLEvenement({ request: { url: 'https://fridgeplus.app/?restore-account=jeton', headers: { 'User-Agent': 'x' } }, message: 'boum' })
    expect(e.request.url).toBe('https://fridgeplus.app/')
    expect(e.request.headers).toEqual({ 'User-Agent': 'x' })
    expect(e.message).toBe('boum')
  })

  it('beforeSend rend tel quel un événement sans requête', () => {
    const e = { message: 'boum' }
    expect(epurerLEvenement(e)).toBe(e)
  })

  it('beforeBreadcrumb épure les URL de navigation et des appels réseau', () => {
    const nav = epurerLeFilDAriane({ category: 'navigation', data: { from: '/?code=abc', to: '/profile/compte?x=1#y' } })
    expect(nav.data).toEqual({ from: '/', to: '/profile/compte' })
    const appel = epurerLeFilDAriane({
      category: 'fetch',
      data: { url: 'https://x.supabase.co/rest/v1/profiles?id=eq.123&select=*', method: 'GET', status_code: 200 },
    })
    expect(appel.data).toEqual({ url: 'https://x.supabase.co/rest/v1/profiles', method: 'GET', status_code: 200 })
  })

  it('beforeBreadcrumb rend telle quelle une miette sans URL', () => {
    const miette = { category: 'console', message: 'x' }
    expect(epurerLeFilDAriane(miette)).toBe(miette)
  })
})

describe('initSentry branche les deux épurations', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock('@sentry/react'); vi.doUnmock('@shared/hooks/use-consent') })

  it('init reçoit beforeSend et beforeBreadcrumb, et ils épurent', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://cle@exemple.ingest.de.sentry.io/1')
    const init = vi.fn()
    vi.doMock('@sentry/react', () => ({ init, close: vi.fn(), captureException: vi.fn(), setUser: vi.fn() }))
    vi.doMock('@shared/hooks/use-consent', () => ({ hasConsentedSync: () => true, abonnerAuConsentement: vi.fn() }))
    const sentry = await import('@shared/lib/observability/sentry')
    await sentry.initSentry()

    expect(init).toHaveBeenCalledTimes(1)
    const options = init.mock.calls[0][0]
    expect(options.beforeSend({ request: { url: 'https://fridgeplus.app/?restore-account=jeton' } }).request.url).toBe('https://fridgeplus.app/')
    expect(options.beforeBreadcrumb({ category: 'navigation', data: { from: '/?code=x', to: '/' } }).data.from).toBe('/')
  })
})
