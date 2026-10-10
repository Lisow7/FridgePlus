import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// La carte 2FA affichait « Inactive / Activer la 2FA » le temps de lister les
// facteurs, même pour un compte protégé (audit du 2026-10-04, comptes et
// authentification). Le hook dit désormais s'il SAIT (`pret`).

let mockUser = { id: 'u-1' }
let resoudreLesFacteurs
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: mockUser }) }))
vi.mock('@shared/api/mfa', () => ({
  listMFAFactors: () => new Promise((r) => { resoudreLesFacteurs = r }),
  getAAL: () => Promise.resolve({ current: 'aal1', next: 'aal2' }),
  enrollTOTP: vi.fn(),
  verifyTOTP: vi.fn(),
  unenrollFactor: vi.fn(),
}))

import { useMFA } from '@shared/hooks/use-mfa'

beforeEach(() => { mockUser = { id: 'u-1' }; resoudreLesFacteurs = null })

describe('useMFA().pret', () => {
  it('faux tant que les facteurs ne sont pas lus, vrai ensuite', async () => {
    const { result } = renderHook(() => useMFA())
    expect(result.current.pret).toBe(false)
    expect(result.current.hasVerifiedFactor).toBe(false)

    await act(async () => {
      resoudreLesFacteurs({ totp: [{ id: 'f-1', status: 'verified', friendly_name: 'TOTP' }], all: [] })
    })
    expect(result.current.pret).toBe(true)
    expect(result.current.hasVerifiedFactor).toBe(true)
  })

  it('vrai tout de suite sans compte : il n’y a rien à lire', async () => {
    mockUser = null
    const { result } = renderHook(() => useMFA())
    await act(async () => {})
    expect(result.current.pret).toBe(true)
  })
})
