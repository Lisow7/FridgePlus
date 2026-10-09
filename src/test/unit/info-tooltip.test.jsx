import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UIProvider } from '@shared/contexts/ui-provider'
import InfoTooltip from '@shared/ui/info-tooltip'

// Régression (2026-07-09) : sur tactile, un tap synthétise mouseenter ET
// click dans le même geste. Si le survol pilote setOpen(true) et le clic
// bascule setOpen(v => !v) dans le même batch React, le clic annule
// aussitôt l'ouverture du survol — la bulle ne s'affiche jamais au premier
// tap réel. Fix : le survol ne pilote l'état que sur un vrai pointeur
// (hover: hover / pointer: fine) ; sur tactile, seul le clic pilote l'état.

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
}

describe('InfoTooltip', () => {
  // UIProvider.detectLang() lit d'abord localStorage('fridge-lang') avant de
  // retomber sur navigator.language (qui vaut 'en-US' par défaut sous jsdom).
  // On fixe la langue ici pour que l'aria-label attendu ('Informations')
  // reste déterministe, cf. confirm-provider.test.jsx.
  beforeEach(() => { localStorage.setItem('fridge-lang', 'fr') })
  afterEach(() => { vi.restoreAllMocks() })

  it('tactile (pas de vrai pointeur) : le clic ouvre, un 2e clic referme (pas de course avec le survol)', async () => {
    mockMatchMedia(false)
    const user = userEvent.setup()
    render(<UIProvider><InfoTooltip text="Explication détaillée" /></UIProvider>)
    const btn = screen.getByRole('button', { name: 'Informations' })

    expect(screen.queryByText('Explication détaillée')).not.toBeInTheDocument()
    await user.click(btn)
    expect(screen.getByText('Explication détaillée')).toBeInTheDocument()
    await user.click(btn)
    expect(screen.queryByText('Explication détaillée')).not.toBeInTheDocument()
  })

  it('vrai pointeur (souris) : le survol ouvre la bulle', async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    render(<UIProvider><InfoTooltip text="Explication détaillée" /></UIProvider>)
    const btn = screen.getByRole('button', { name: 'Informations' })

    await user.hover(btn)
    expect(screen.getByText('Explication détaillée')).toBeInTheDocument()
    await user.unhover(btn)
    expect(screen.queryByText('Explication détaillée')).not.toBeInTheDocument()
  })
})
