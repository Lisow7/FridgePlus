import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let mockHasPremium = false
vi.mock('@shared/hooks/use-subscription', () => ({
  useSubscription: () => ({ hasPremiumAccess: mockHasPremium }),
}))
vi.mock('@shared/contexts/subscription-modal-provider', () => ({
  useUpgradeModal: () => ({ openUpgradeModal: vi.fn() }),
}))
let mockEnabled = false
vi.mock('@shared/lib/premium-config', () => ({ get PREMIUM_ENABLED() { return mockEnabled } }))

import { UpgradeGate } from '@shared/ui/upgrade-gate'

describe('UpgradeGate mode Prochainement', () => {
  beforeEach(() => { mockHasPremium = false; mockEnabled = false })

  it('premium désactivé + pas premium → badge Prochainement, pas de CTA achat', () => {
    render(<UpgradeGate feature="basket" variant="hard" lang="fr"><div>contenu</div></UpgradeGate>)
    expect(screen.getByText('Bientôt disponible')).toBeInTheDocument()
    expect(screen.queryByText(/Commencer l'essai/)).not.toBeInTheDocument()
  })

  it('a un accès premium (admin) → rend les enfants', () => {
    mockHasPremium = true
    render(<UpgradeGate feature="basket" variant="hard" lang="fr"><div>contenu premium</div></UpgradeGate>)
    expect(screen.getByText('contenu premium')).toBeInTheDocument()
  })

  it('premium activé + pas premium → CTA essai (comportement legacy)', () => {
    mockEnabled = true
    render(<UpgradeGate feature="basket" variant="hard" lang="fr"><div>contenu</div></UpgradeGate>)
    expect(screen.getByText(/Commencer l'essai/)).toBeInTheDocument()
  })
})

describe('UpgradeGate mode collapsible (popover ancré, pas de layout shift)', () => {
  beforeEach(() => { mockHasPremium = false; mockEnabled = false })

  it('le contenu détaillé est masqué tant que le pill n\'est pas cliqué', () => {
    render(<UpgradeGate feature="voice-cooking" variant="hard" collapsible lang="fr" />)
    expect(screen.getByText('Mode cuisine vocal')).toBeInTheDocument()
    expect(screen.queryByText(/mains occupées/)).not.toBeInTheDocument()
  })

  it('clic sur le pill ouvre la bulle avec le contenu détaillé', async () => {
    const user = userEvent.setup()
    render(<UpgradeGate feature="voice-cooking" variant="hard" collapsible lang="fr" />)
    await user.click(screen.getByText('Mode cuisine vocal'))
    expect(screen.getByText(/mains occupées/)).toBeInTheDocument()
  })

  it('clic extérieur referme la bulle', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <UpgradeGate feature="voice-cooking" variant="hard" collapsible lang="fr" />
        <button>ailleurs</button>
      </div>,
    )
    await user.click(screen.getByText('Mode cuisine vocal'))
    expect(screen.getByText(/mains occupées/)).toBeInTheDocument()
    await user.click(screen.getByText('ailleurs'))
    expect(screen.queryByText(/mains occupées/)).not.toBeInTheDocument()
  })

  it('le pill ne change pas de taille (padding) entre fermé et ouvert', async () => {
    const user = userEvent.setup()
    render(<UpgradeGate feature="voice-cooking" variant="hard" collapsible lang="fr" />)
    const pill = screen.getByText('Mode cuisine vocal').closest('div')
    const paddingBefore = pill.style.padding
    await user.click(screen.getByText('Mode cuisine vocal'))
    expect(pill.style.padding).toBe(paddingBefore)
  })
})
