import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Audit du 2026-10-04, SEC-12 : `window.location.href = data.url` suivait la
// réponse brute de nos fonctions edge, sans vérifier que l'adresse menait bien à
// Stripe. Défense en profondeur (le parcours est éteint, la fonction est la
// nôtre) : seule une adresse https de checkout.stripe.com (paiement) ou de
// billing.stripe.com (portail) est suivie.

vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: true }))

import { redirectToCheckout, redirectToPortal, adresseStripeSure } from '@shared/lib/payments/stripe'

const supabase = { functions: { invoke: vi.fn() } }
beforeEach(() => {
  supabase.functions.invoke.mockReset()
  vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_fictive')
})
afterEach(() => { vi.unstubAllEnvs() })

describe('adresseStripeSure', () => {
  it('une adresse https de l’hôte attendu passe', () => {
    expect(adresseStripeSure('https://checkout.stripe.com/c/pay/cs_test_123', 'checkout.stripe.com'))
      .toBe('https://checkout.stripe.com/c/pay/cs_test_123')
  })

  it('tout le reste est refusé', () => {
    for (const url of [
      'http://checkout.stripe.com/c/pay/cs_test_123',      // pas https
      'https://evil.example/pay',                           // autre hôte
      'https://checkout.stripe.com.evil.example/pay',      // suffixe trompeur
      'https://checkout.stripe.com@evil.example/pay',      // identifiants trompeurs
      'https://billing.stripe.com/p/session/x',            // le portail n'est pas le paiement
      'javascript:alert(1)',
      'pas une adresse',
      undefined,
    ]) expect(adresseStripeSure(url, 'checkout.stripe.com'), String(url)).toBeNull()
  })
})

describe('les redirections ne suivent que Stripe', () => {
  it('paiement : une adresse étrangère est refusée, sans navigation', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { url: 'https://evil.example/pay' }, error: null })
    const avant = window.location.href
    await expect(redirectToCheckout('annual', supabase)).rejects.toThrow('redirection_refusee')
    expect(window.location.href).toBe(avant)
  })

  it('portail : une adresse de paiement n’est pas le portail', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/c/pay/x' }, error: null })
    await expect(redirectToPortal(supabase)).rejects.toThrow('redirection_refusee')
  })

  it('adresse absente : le message d’avant', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null })
    await expect(redirectToCheckout('monthly', supabase)).rejects.toThrow('URL de paiement manquante')
  })
})
