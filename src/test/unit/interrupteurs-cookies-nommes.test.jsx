import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Les interrupteurs des cookies ont un nom, et le clavier les atteint
// (audit du 2026-10-04, A11Y-05 et A11Y-04).
//
// Avant : « interrupteur, activé », sans dire de quelle catégorie — sur l'écran
// présenté à chaque nouveau visiteur. Et l'interrupteur vivait DANS l'en-tête
// d'accordéon (`role="button"`) : Espace ou Entrée dessus repliait l'accordéon
// au lieu de changer le consentement.

const save = vi.hoisted(() => vi.fn())
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => false }))
vi.mock('@features/push-notifications', () => ({ usePushSubscription: () => ({ available: false }) }))
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({ consent: { errors: false, usage: false, voice: false, receiptScan: false }, save }),
}))

import CookieModal from '@features/legal/components/cookie-modal'

beforeEach(() => { save.mockReset() })

describe('interrupteurs des cookies', () => {
  it('chaque interrupteur porte le nom de sa catégorie', () => {
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    const interrupteurs = screen.getAllByRole('switch')
    expect(interrupteurs.length).toBeGreaterThanOrEqual(3)
    for (const inter of interrupteurs) {
      expect(inter).toHaveAccessibleName(/\S{3,}/)
    }
    expect(screen.getByRole('switch', { name: /statistiques d'usage/i })).toBeInTheDocument()
  })

  it('Espace sur un interrupteur change le consentement, sans replier ni déplier la catégorie', async () => {
    const user = userEvent.setup()
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    const audience = screen.getByRole('switch', { name: /statistiques d'usage/i })
    const avant = audience.getAttribute('aria-checked')
    const deplieurs = screen.getAllByRole('button', { expanded: false }).length

    audience.focus()
    await user.keyboard(' ')

    expect(audience.getAttribute('aria-checked')).not.toBe(avant)
    expect(screen.getAllByRole('button', { expanded: false }).length).toBe(deplieurs)
  })

  it('le titre de la catégorie reste un titre, et un vrai bouton la déplie', () => {
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    const titres = screen.getAllByRole('heading', { level: 3 })
    expect(titres.length).toBeGreaterThanOrEqual(3)
    const deplieur = screen.getAllByRole('button', { expanded: false })[0]
    expect(deplieur.tagName).toBe('BUTTON')
  })
})
