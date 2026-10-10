import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockEnabled = false
vi.mock('@shared/lib/premium-config', () => ({ get PREMIUM_ENABLED() { return mockEnabled } }))

import TierBadge from '@shared/ui/tier-badge'

// (`FEATURE_TIER` n'existe plus : rien dans l'app ne le lisait — audit du
// 2026-10-04, ARCH-14. Les pastilles reçoivent leur tier en prop.)

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
  it('soon → « Bientôt » quand premium off (sans émoji)', () => {
    mockEnabled = false
    render(<TierBadge tier="soon" lang="fr" />)
    expect(screen.getByText('Bientôt')).toBeInTheDocument()
  })
  it('soon → « Premium » quand premium on', () => {
    mockEnabled = true
    render(<TierBadge tier="soon" lang="fr" />)
    expect(screen.getByText('Premium')).toBeInTheDocument()
  })
})
