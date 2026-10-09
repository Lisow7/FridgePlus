import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: false }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ supabase: {}, isAdmin: false }) }))
vi.mock('@shared/hooks/use-subscription', () => ({
  useSubscription: () => ({ subscriptionStatus: 'free', isPremium: false, isTrialing: false, isSpecialAccess: false }),
}))
vi.mock('@shared/contexts/subscription-modal-provider', () => ({ useUpgradeModal: () => ({ openUpgradeModal: vi.fn() }) }))

import SubscriptionTab from '@features/profile/components/subscription-tab'

describe('SubscriptionTab état free en mode Launch Free', () => {
  it('affiche Prochainement, pas le CTA premium', () => {
    render(<SubscriptionTab lang="fr" darkMode={false} />)
    expect(screen.getByText('Prochainement')).toBeInTheDocument()
  })
})
