import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const STORAGE_KEY = 'fridge-consent-v1' // gitleaks:allow

// Recharge le module à neuf entre chaque test (store module-level).
async function freshConsent() {
  vi.resetModules()
  return await import('@shared/hooks/use-consent')
}

describe('use-consent — catégorie voice + bannerDismissed', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules() })

  it('voice par défaut = false, non consenti', async () => {
    const { hasConsentedSync } = await freshConsent()
    expect(hasConsentedSync('voice')).toBe(false)
  })

  it('setVoiceConsent(true) accorde la voix SANS masquer le bandeau global', async () => {
    const { useConsent, hasConsentedSync } = await freshConsent()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.setVoiceConsent(true))
    expect(hasConsentedSync('voice')).toBe(true)
    expect(result.current.hasDecided).toBe(false) // bandeau cookies pas encore traité
  })

  it('accept() pose bannerDismissed (bandeau masqué)', async () => {
    const { useConsent } = await freshConsent()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.accept())
    expect(result.current.hasDecided).toBe(true)
  })

  it('setVoiceConsent(false) révoque la voix', async () => {
    const { useConsent, hasConsentedSync } = await freshConsent()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.setVoiceConsent(true))
    act(() => result.current.setVoiceConsent(false))
    expect(hasConsentedSync('voice')).toBe(false)
  })

  // Version 2 (décision du 2026-10-06) : la question est reposée à tous —
  // un enregistrement v1, même récent et même sans `bannerDismissed`, ne vaut
  // plus pour les cookies.
  it('enregistrement v1 (ancien bandeau, une seule case) → bandeau réaffiché, voice=false', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, timestamp: Date.now() - 1000, essential: true, functional: true, audience: false,
    }))
    const { useConsent, hasConsentedSync } = await freshConsent()
    const { result } = renderHook(() => useConsent())
    expect(result.current.hasDecided).toBe(false)  // reposée à tous
    expect(hasConsentedSync('voice')).toBe(false)  // voice absent → false
  })

  it('receiptScan par défaut = false, non consenti', async () => {
    const { hasConsentedSync } = await freshConsent()
    expect(hasConsentedSync('receiptScan')).toBe(false)
  })

  it('setReceiptScanConsent(true) accorde le scan photo SANS masquer le bandeau global', async () => {
    const { useConsent, hasConsentedSync } = await freshConsent()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.setReceiptScanConsent(true))
    expect(hasConsentedSync('receiptScan')).toBe(true)
    expect(result.current.hasDecided).toBe(false)
  })

  it('receiptScan et voice sont des consentements indépendants', async () => {
    const { useConsent, hasConsentedSync } = await freshConsent()
    const { result } = renderHook(() => useConsent())
    act(() => result.current.setVoiceConsent(true))
    expect(hasConsentedSync('voice')).toBe(true)
    expect(hasConsentedSync('receiptScan')).toBe(false)
  })
})
