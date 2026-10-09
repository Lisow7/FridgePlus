import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtl, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let mockWidth = 320
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => mockWidth }))
let mockAuth = () => ({ user: null, profile: null, isAdmin: false })
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => mockAuth() }))
vi.mock('@shared/ui/avatar-img', () => ({ default: () => <div data-testid="avatar" /> }))
// HelpGuide (rendu par HeaderActions) consomme useRecipeForm + useFeatureFlag — mock (pas de provider en test).
vi.mock('@shared/contexts/recipe-form-context', () => ({ useRecipeForm: () => ({ openCreate: () => {} }) }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => false }))

// Mocks for subscription and upgrade modal hooks
vi.mock('@shared/hooks/use-subscription', () => ({
  useSubscription: () => ({
    hasPremiumAccess: false,
    isPremium: false,
    isTrialing: false,
    subscriptionStatus: 'free',
  }),
}))

vi.mock('@shared/contexts/subscription-modal-provider', () => ({
  useUpgradeModal: () => ({
    openUpgradeModal: vi.fn(),
    closeUpgradeModal: vi.fn(),
    isUpgradeOpen: false,
  }),
}))

// Mock notifications hook
vi.mock('@features/notifications/hooks/use-notifications', () => ({
  useNotifications: () => ({
    unreadCount: 0,
    notifications: [],
  }),
}))

import Header from '@app/layout/header'
const render = (ui) => rtl(<MemoryRouter>{ui}</MemoryRouter>)
const props = { lang: 'fr', onReset: vi.fn(), onLangChange: vi.fn(), onShowAuth: vi.fn(), darkMode: false }

beforeEach(() => { mockAuth = () => ({ user: null, profile: null, isAdmin: false }) })

describe('Header — pas de débordement (garde-fou multi-largeurs)', () => {
  for (const w of [320, 360, 375, 640, 768, 1024, 1280]) {
    it(`rend logo + actions sans crash à ${w}px (invité)`, () => {
      mockWidth = w
      render(<Header {...props} />)
      expect(screen.getByText('Fridge')).toBeInTheDocument()
      expect(screen.getByText('+')).toBeInTheDocument()
    })
    it(`rend logo + actions sans crash à ${w}px (connecté)`, () => {
      mockWidth = w
      mockAuth = () => ({ user: { id: 'u' }, profile: { username: 'A', avatar_id: null }, isAdmin: false })
      render(<Header {...props} />)
      expect(screen.getByText('Fridge')).toBeInTheDocument()
    })
  }
})
