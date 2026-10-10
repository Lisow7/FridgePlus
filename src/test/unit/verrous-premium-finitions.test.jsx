import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Les verrous Premium eux-mêmes (audit du 2026-10-04, PREM-15 et PREM-09) :
// les deux choix de formule de la fenêtre Premium sont des `role="radio"` sans
// `radiogroup` ; l'accroche « machine à écrire » tourne toutes les 4 s sans
// égard pour `prefers-reduced-motion` ; dans le verrou « doux », les enfants
// sont `aria-hidden` mais restent focalisables ; et cinq clés de `FEATURE_DATA`
// ne sont appelées nulle part, dont `barcode-scan` pour une fonction qui
// n'existe pas.

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ supabase: {} }) }))
vi.mock('@shared/lib/payments/stripe', () => ({ redirectToCheckout: vi.fn() }))
vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: true }))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: false }) }))
vi.mock('@shared/contexts/subscription-modal-provider', () => ({ useUpgradeModal: () => ({ openUpgradeModal: vi.fn() }) }))

import UpgradeModal from '@features/premium/components/upgrade-modal'
import { UpgradeGate } from '@shared/ui/upgrade-gate'
import { TAGLINES } from '@shared/static/taglines'

function mockMatchMedia(reduit) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reduit : false,
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
}

describe('fenêtre Premium', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('les deux formules forment un groupe de boutons radio', () => {
    mockMatchMedia(false)
    render(<UpgradeModal isOpen onClose={vi.fn()} lang="fr" />)
    const groupe = screen.getByRole('radiogroup')
    expect(groupe).toHaveAccessibleName()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('mouvement réduit : l’accroche reste en place', () => {
    mockMatchMedia(true)
    render(<UpgradeModal isOpen onClose={vi.fn()} lang="fr" />)
    expect(screen.getByText(TAGLINES.fr[0])).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByText(TAGLINES.fr[0])).toBeInTheDocument()
  })

  it('sans préférence : l’accroche défile (témoin)', () => {
    mockMatchMedia(false)
    render(<UpgradeModal isOpen onClose={vi.fn()} lang="fr" />)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.queryByText(TAGLINES.fr[0])).toBeNull()
  })
})

describe('verrou « doux »', () => {
  it('les enfants masqués ne sont plus focalisables (inert)', () => {
    render(<UpgradeGate feature="basket" variant="soft" lang="fr"><button type="button">Enfant</button></UpgradeGate>)
    const masque = screen.getByText('Enfant').closest('[aria-hidden="true"]')
    expect(masque).not.toBeNull()
    expect(masque).toHaveAttribute('inert')
  })
})

describe('FEATURE_DATA du verrou', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/shared/ui/upgrade-gate.jsx'), 'utf8')

  it('ne porte plus les cinq clés que rien n’appelle', () => {
    expect(source).not.toMatch(/'(shopping-lists|basket-share|dlc-alerts|barcode-scan|ai-substitutes)':\s*\{/)
  })

  it('garde les quatre clés appelées', () => {
    for (const cle of ['basket:', 'spending:', "'voice-cooking':", "'recipe-cost':"]) expect(source).toContain(cle)
  })
})
