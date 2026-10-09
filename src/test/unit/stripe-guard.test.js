import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: false }))

import { redirectToCheckout, redirectToPortal } from '@shared/lib/payments/stripe'

describe('garde Stripe quand premium désactivé', () => {
  const supabase = { functions: { invoke: vi.fn() } }
  beforeEach(() => supabase.functions.invoke.mockReset())

  it('redirectToCheckout throw sans appeler Stripe', async () => {
    await expect(redirectToCheckout('annual', supabase)).rejects.toThrow('premium_disabled')
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('redirectToPortal throw sans appeler Stripe', async () => {
    await expect(redirectToPortal(supabase)).rejects.toThrow('premium_disabled')
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
})
