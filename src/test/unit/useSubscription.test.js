import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSubscription } from '@shared/hooks/use-subscription'

// Mock AuthContext
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@shared/contexts/auth-provider'

function mockAuth(profileOverrides = {}, isAdmin = false) {
  useAuth.mockReturnValue({
    profile: {
      subscription_status:  'free',
      subscription_plan:    null,
      trial_ends_at:        null,
      subscription_ends_at: null,
      ...profileOverrides,
    },
    isAdmin,
  })
}

describe('useSubscription', () => {
  describe('statut free', () => {
    it('retourne hasPremiumAccess=false pour un user gratuit', () => {
      mockAuth({ subscription_status: 'free' })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(false)
      expect(result.current.isPremium).toBe(false)
      expect(result.current.isTrialing).toBe(false)
      expect(result.current.isComped).toBe(false)
      expect(result.current.subscriptionStatus).toBe('free')
    })
  })

  describe('statut active', () => {
    it('retourne hasPremiumAccess=true pour un abonné actif', () => {
      mockAuth({ subscription_status: 'active', subscription_plan: 'monthly' })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(true)
      expect(result.current.isPremium).toBe(true)
      expect(result.current.plan).toBe('monthly')
    })
  })

  describe('statut trialing', () => {
    it('retourne hasPremiumAccess=true si trial non expiré', () => {
      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // +3j
      mockAuth({ subscription_status: 'trialing', trial_ends_at: future })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(true)
      expect(result.current.isTrialing).toBe(true)
      expect(result.current.trialDaysLeft).toBeGreaterThanOrEqual(2)
    })

    it('retourne hasPremiumAccess=false si trial expiré', () => {
      const past = new Date(Date.now() - 1000).toISOString()
      mockAuth({ subscription_status: 'trialing', trial_ends_at: past })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(false)
      expect(result.current.isTrialing).toBe(false)
      expect(result.current.trialDaysLeft).toBe(0)
    })
  })

  describe('statut comped', () => {
    it('retourne hasPremiumAccess=true et isComped=true', () => {
      mockAuth({ subscription_status: 'comped' })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(true)
      expect(result.current.isPremium).toBe(true)
      expect(result.current.isComped).toBe(true)
    })
  })

  describe('statuts sans accès premium', () => {
    it.each(['past_due', 'canceled', 'paused'])('retourne hasPremiumAccess=false pour %s', (status) => {
      mockAuth({ subscription_status: status })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(false)
      expect(result.current.isPremium).toBe(false)
    })
  })

  describe('admin', () => {
    it('un admin a toujours hasPremiumAccess=true même avec statut free', () => {
      mockAuth({ subscription_status: 'free' }, true)
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(true)
      // Sprint 11 — isPremium passe à true pour admin (bypass dev/test).
      // Ils doivent avoir accès aux features Premium sans payer.
      expect(result.current.isPremium).toBe(true)
    })

    it('un admin avec statut canceled a toujours hasPremiumAccess=true', () => {
      mockAuth({ subscription_status: 'canceled' }, true)
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(true)
    })
  })

  describe('profile null', () => {
    it('ne plante pas si profile est null (user non connecté)', () => {
      useAuth.mockReturnValue({ profile: null, isAdmin: false })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.hasPremiumAccess).toBe(false)
      expect(result.current.subscriptionStatus).toBe('free')
    })
  })

  describe('specialRole', () => {
    it('specialRole = null quand aucun rôle spécial', () => {
      mockAuth({ subscription_status: 'free', special_role: null })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.specialRole).toBeNull()
      expect(result.current.isSpecialAccess).toBe(false)
    })

    it('specialRole = tester quand comped + special_role=tester', () => {
      mockAuth({ subscription_status: 'comped', special_role: 'tester' })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.specialRole).toBe('tester')
      expect(result.current.isSpecialAccess).toBe(true)
      expect(result.current.isPremium).toBe(true)
    })

    it('specialRole = partner, hasPremiumAccess = true', () => {
      mockAuth({ subscription_status: 'comped', special_role: 'partner' })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.specialRole).toBe('partner')
      expect(result.current.hasPremiumAccess).toBe(true)
    })

    it('isSpecialAccess = false si comped mais special_role null (comped legacy)', () => {
      mockAuth({ subscription_status: 'comped', special_role: null })
      const { result } = renderHook(() => useSubscription())
      expect(result.current.isSpecialAccess).toBe(false)
      expect(result.current.isPremium).toBe(true)
    })
  })
})
