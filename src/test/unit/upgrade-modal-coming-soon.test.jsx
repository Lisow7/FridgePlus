import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: false }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ supabase: {} }) }))

import UpgradeModal from '@features/premium/components/upgrade-modal'

describe('UpgradeModal mode Bientôt', () => {
  it('premium désactivé → pas de prix ni CTA checkout', () => {
    render(<UpgradeModal isOpen onClose={() => {}} lang="fr" />)
    // Pas de prix annuel affiché
    expect(screen.queryByText(/34,99/)).not.toBeInTheDocument()
    // Pas de CTA "Commencer l'essai"
    expect(screen.queryByText(/Commencer l'essai/)).not.toBeInTheDocument()
    // Message « Bientôt » présent
    expect(screen.getByText(/Bientôt — ces fonctionnalités/)).toBeInTheDocument()
  })
})
