import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

// Une fiche demandée qui n'existe pas retombait en silence sur celle du panier :
// « Mes dépenses » (`feature="spending"`) montrait « Panier de courses » à tout
// compte gratuit (relecture du 2026-10-08, lot 13). Chaque fiche demandée par
// le code doit exister.
describe('UpgradeGate — chaque fiche demandée existe', () => {
  beforeEach(() => { mockHasPremium = false; mockEnabled = false })

  const racine = resolve(process.cwd(), 'src')
  const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = join(dossier, e.name)
    if (e.isDirectory()) return e.name === 'test' ? [] : fichiers(p)
    return /[.]jsx$/.test(e.name) ? [p] : []
  })
  const demandees = [...new Set(fichiers(racine).flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/<UpgradeGate\b[^>]*?\bfeature="([^"]+)"/g)].map((m) => m[1])))]

  it('témoin : le code demande plusieurs fiches, dont « spending »', () => {
    expect(demandees.length).toBeGreaterThan(3)
    expect(demandees).toContain('spending')
  })

  it.each(demandees.filter((f) => f !== 'basket'))('« %s » a sa propre fiche, pas celle du panier', (feature) => {
    const { unmount } = render(<UpgradeGate feature={feature} variant="hard" lang="fr" />)
    expect(screen.queryByText('Panier de courses')).not.toBeInTheDocument()
    unmount()
  })

  it('« Mes dépenses » présente l’analyse des dépenses, en français et en anglais', () => {
    const { unmount } = render(<UpgradeGate feature="spending" variant="hard" lang="fr" />)
    expect(screen.getByText('Analyse des dépenses')).toBeInTheDocument()
    unmount()
    render(<UpgradeGate feature="spending" variant="hard" lang="en" />)
    expect(screen.getByText('Spending analysis')).toBeInTheDocument()
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
    const pill = screen.getByText('Mode cuisine vocal').closest('button')
    const paddingBefore = pill.style.padding
    await user.click(screen.getByText('Mode cuisine vocal'))
    expect(pill.style.padding).toBe(paddingBefore)
  })

  // Lot 9f : le pill était une `div` cliquable — au clavier, impossible
  // d'ouvrir l'explication (ni Tab, ni Entrée), et rien ne disait qu'il s'ouvre.
  it('le pill est un vrai bouton, qui dit s’il est déplié, et s’ouvre au clavier', async () => {
    const user = userEvent.setup()
    render(<UpgradeGate feature="voice-cooking" variant="hard" collapsible lang="fr" />)
    const pill = screen.getByRole('button', { name: /Mode cuisine vocal/, expanded: false })
    await user.tab()
    expect(pill).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/mains occupées/)).toBeInTheDocument()
  })
})
