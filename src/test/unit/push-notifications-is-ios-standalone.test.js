import { describe, it, expect, vi, afterEach } from 'vitest'
import { iosPushBlocked } from '@features/push-notifications/lib/is-ios-standalone'

describe('iosPushBlocked', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retourne false sur un navigateur non-iOS (Android/desktop)', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' })
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    expect(iosPushBlocked()).toBe(false)
  })

  it('retourne true sur iOS hors mode standalone (PWA non installée)', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    expect(iosPushBlocked()).toBe(true)
  })

  it('retourne false sur iOS en mode standalone (PWA installée)', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    expect(iosPushBlocked()).toBe(false)
  })
})
