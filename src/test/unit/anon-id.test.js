import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHasConsented = vi.hoisted(() => vi.fn())
vi.mock('@shared/hooks/use-consent', () => ({ hasConsentedSync: mockHasConsented }))

import { getAnonId } from '@shared/lib/observability/anon-id'

describe('getAnonId', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('null + aucun write si pas de consentement audience', () => {
    mockHasConsented.mockReturnValue(false)
    expect(getAnonId()).toBeNull()
    expect(localStorage.getItem('fridge-anon-id')).toBeNull()
  })

  it('crée et persiste un uuid si consentement', () => {
    mockHasConsented.mockReturnValue(true)
    const id = getAnonId()
    expect(id).toBeTruthy()
    expect(localStorage.getItem('fridge-anon-id')).toBe(id)
  })

  it('stable entre appels (même id réutilisé)', () => {
    mockHasConsented.mockReturnValue(true)
    expect(getAnonId()).toBe(getAnonId())
  })
})
