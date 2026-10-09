import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockEnabled = false
vi.mock('@shared/lib/premium-config', () => ({ get PREMIUM_ENABLED() { return mockEnabled } }))

import TierBadge from '@shared/ui/tier-badge'
import { FEATURE_TIER } from '@features/onboarding/lib/feature-tiers'

describe('FEATURE_TIER', () => {
  it('classe les features par tier', () => {
    expect(FEATURE_TIER.fridge).toBe('free')
    expect(FEATURE_TIER.community).toBe('account')
    expect(FEATURE_TIER.cart).toBe('soon')
  })
})

describe('TierBadge', () => {
  it('free → « Gratuit »', () => {
    mockEnabled = false
    render(<TierBadge tier="free" lang="fr" />)
    expect(screen.getByText('Gratuit')).toBeInTheDocument()
  })
  it('account → « Compte »', () => {
    render(<TierBadge tier="account" lang="fr" />)
    expect(screen.getByText('Compte')).toBeInTheDocument()
  })
  it('soon → « Prochainement » quand premium off (sans émoji)', () => {
    mockEnabled = false
    render(<TierBadge tier="soon" lang="fr" />)
    expect(screen.getByText('Prochainement')).toBeInTheDocument()
  })
  it('soon → « Premium » quand premium on', () => {
    mockEnabled = true
    render(<TierBadge tier="soon" lang="fr" />)
    expect(screen.getByText('Premium')).toBeInTheDocument()
  })
})
