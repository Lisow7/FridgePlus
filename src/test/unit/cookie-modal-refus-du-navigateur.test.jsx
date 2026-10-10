import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Audit du 2026-10-04, lot 16c (CPT-15 (4)) : un refus du navigateur (« Bloquer ») recevait
// « ouvre fridgeplus.app dans Chrome », le texte d'une panne de navigateur intégré. Il dit
// désormais où autoriser les notifications. Une lecture de l'état qui échoue a son mot aussi.

const mockState = vi.hoisted(() => ({ push: { available: true, enabled: false, error: null, blocked: false, loading: false, toggle: () => {} } }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => false }))
vi.mock('@features/push-notifications', () => ({ usePushSubscription: () => mockState.push }))
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({ consent: { errors: false, usage: false, voice: false, receiptScan: false }, save: vi.fn() }),
}))

import CookieModal from '@features/legal/components/cookie-modal'

describe('CookieModal — les notifications disent pourquoi elles n’ont pas pu s’activer', () => {
  it('refus du navigateur : où les autoriser, et pas le texte du navigateur intégré', () => {
    mockState.push = { ...mockState.push, error: 'permission_denied' }
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    expect(screen.getByText(/Ton navigateur bloque les notifications/)).toBeInTheDocument()
    expect(screen.queryByText(/navigateur intégré/)).not.toBeInTheDocument()
  })

  it('panne du navigateur : le texte du navigateur intégré, comme avant', () => {
    mockState.push = { ...mockState.push, error: 'failed' }
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    expect(screen.getByText(/navigateur intégré/)).toBeInTheDocument()
  })

  it('lecture de l’état impossible : le dire, sans accuser le navigateur', () => {
    mockState.push = { ...mockState.push, error: 'read_failed' }
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    expect(screen.getByText(/n'a pas pu être lu/)).toBeInTheDocument()
    expect(screen.queryByText(/navigateur intégré/)).not.toBeInTheDocument()
  })

  it('en anglais aussi', () => {
    mockState.push = { ...mockState.push, error: 'permission_denied' }
    render(<CookieModal lang="en" onClose={vi.fn()} />)
    expect(screen.getByText(/Your browser is blocking notifications/)).toBeInTheDocument()
  })
})
