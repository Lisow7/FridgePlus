import { describe, it, expect, vi, afterEach } from 'vitest'

// On teste la résolution du flag via import dynamique + stub d'env.
describe('PREMIUM_ENABLED', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('vrai uniquement si VITE_PREMIUM_ENABLED === "true"', async () => {
    vi.stubEnv('VITE_PREMIUM_ENABLED', 'true')
    const mod = await import('@shared/lib/premium-config?t=' + Date.now())
    expect(mod.PREMIUM_ENABLED).toBe(true)
  })

  it('faux par défaut (absent)', async () => {
    vi.stubEnv('VITE_PREMIUM_ENABLED', '')
    const mod = await import('@shared/lib/premium-config?t=' + Date.now())
    expect(mod.PREMIUM_ENABLED).toBe(false)
  })

  it('faux pour toute valeur autre que "true"', async () => {
    vi.stubEnv('VITE_PREMIUM_ENABLED', 'false')
    const mod = await import('@shared/lib/premium-config?t=' + Date.now())
    expect(mod.PREMIUM_ENABLED).toBe(false)
  })
})
