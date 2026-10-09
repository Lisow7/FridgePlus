import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Audit du 2026-10-04, RGPD-05 : le choix des cookies n'expirait jamais, et
// le retrait du consentement ne coupait pas Sentry (le code appelait
// `window.Sentry.close`, qui n'existe qu'en développement) ni n'effaçait
// l'identifiant anonyme du suivi d'usage. Depuis la version 2 (décision du
// 2026-10-06), deux cases : « errors » (Sentry) et « usage » (suivi d'usage).

const CLE = 'fridge-consent-v1' // gitleaks:allow
const MOIS = 30 * 24 * 3600 * 1000

async function frais() {
  vi.resetModules()
  return await import('@shared/hooks/use-consent')
}
function poser(choix) {
  localStorage.setItem(CLE, JSON.stringify({
    version: 2, essential: true, errors: true, usage: true, voice: true, receiptScan: false, bannerDismissed: true, ...choix,
  }))
}

describe('le choix des cookies expire au bout de 6 mois (recommandation de la CNIL)', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules() })

  it('choix de plus de 6 mois : le bandeau revient, rapports d’erreurs et statistiques ne sont plus accordés', async () => {
    poser({ timestamp: Date.now() - 7 * MOIS, decisionAt: Date.now() - 7 * MOIS })
    const { hasConsentedSync, getConsentSync } = await frais()
    expect(hasConsentedSync('errors')).toBe(false)
    expect(hasConsentedSync('usage')).toBe(false)
    expect(getConsentSync().bannerDismissed).toBe(false)
  })

  it('… et l’identifiant anonyme du suivi d’usage s’efface avec lui', async () => {
    poser({ timestamp: Date.now() - 7 * MOIS, decisionAt: Date.now() - 7 * MOIS })
    localStorage.setItem('fridge-anon-id', 'ancien')
    await frais()
    expect(localStorage.getItem('fridge-anon-id')).toBeNull()
  })

  it('un consentement d’usage (micro) reste : ce n’est pas un cookie', async () => {
    poser({ timestamp: Date.now() - 7 * MOIS, decisionAt: Date.now() - 7 * MOIS })
    const { hasConsentedSync } = await frais()
    expect(hasConsentedSync('voice')).toBe(true)
  })

  it('choix de 5 mois : gardé', async () => {
    poser({ timestamp: Date.now() - 5 * MOIS, decisionAt: Date.now() - 5 * MOIS })
    const { hasConsentedSync } = await frais()
    expect(hasConsentedSync('usage')).toBe(true)
  })

  it('un consentement vocal récent ne prolonge pas un choix de bandeau ancien', async () => {
    poser({ timestamp: Date.now() - 1 * MOIS, decisionAt: Date.now() - 7 * MOIS })
    const { hasConsentedSync } = await frais()
    expect(hasConsentedSync('usage')).toBe(false)
  })

  it('ancien enregistrement sans date de choix : la date est son timestamp', async () => {
    poser({ timestamp: Date.now() - 7 * MOIS })
    const { hasConsentedSync } = await frais()
    expect(hasConsentedSync('usage')).toBe(false)
  })

  it('un nouveau choix repart pour 6 mois', async () => {
    const { useConsent } = await frais()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.accept())
    expect(JSON.parse(localStorage.getItem(CLE)).decisionAt).toBeGreaterThan(Date.now() - 5000)
  })
})

describe('retirer son accord le retire vraiment', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules() })

  it('l’identifiant anonyme du suivi d’usage est effacé', async () => {
    const { useConsent } = await frais()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.accept())
    localStorage.setItem('fridge-anon-id', 'abc')
    act(() => result.current.save({ errors: true, usage: false }))
    expect(localStorage.getItem('fridge-anon-id')).toBeNull()
  })

  it('les abonnés au consentement sont prévenus', async () => {
    const { useConsent, abonnerAuConsentement } = await frais()
    const vu = []
    abonnerAuConsentement((c) => vu.push(c.errors))
    const { result } = renderHook(() => useConsent())
    act(() => result.current.accept())
    act(() => result.current.refuse())
    expect(vu).toEqual([true, false])
  })
})

describe('Sentry se ferme au retrait du consentement', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules() })
  afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock('@sentry/react') })

  it('retiré : Sentry fermé, et plus aucune erreur ne part', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://cle@exemple.ingest.sentry.io/1')
    const close = vi.fn()
    const captureException = vi.fn()
    vi.doMock('@sentry/react', () => ({ init: vi.fn(), close, captureException, setUser: vi.fn() }))
    poser({ timestamp: Date.now(), decisionAt: Date.now() })
    vi.resetModules()
    const consent = await import('@shared/hooks/use-consent')
    const sentry = await import('@shared/lib/observability/sentry')
    await sentry.initSentry()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sentry.logError(new Error('avant'))
    expect(captureException).toHaveBeenCalledTimes(1)

    const { result } = renderHook(() => consent.useConsent())
    act(() => result.current.refuse())
    expect(close).toHaveBeenCalled()
    sentry.logError(new Error('après'))
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
