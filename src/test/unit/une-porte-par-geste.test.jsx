import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Plusieurs portes pour la même action (audit du 2026-10-04, UX-17 ; planche
// n° 4 tranchée par Antoine le 2026-10-08) :
// - la bienvenue avait « Passer × » en haut ET « Entrer directement → » en bas,
//   qui faisaient la même chose (`bienvenue_sortie = entrer`) ;
// - le pied de page disait « Aide & Mentions légales » pour un lien qui n'ouvre
//   que les mentions légales : le « ? » est LA porte de l'aide
//   (`aide_porte = point_interrogation`).

vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => true }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@features/onboarding/lib/welcome-storage', () => ({ hasSeenWelcome: () => true, markWelcomeSeen: vi.fn() }))

import WelcomeScreen from '@features/onboarding/components/welcome-screen'
import Footer from '@app/layout/footer'
import { SUPPORT_SELF_HELP } from '@features/support/data/support-self-help'

beforeEach(() => localStorage.clear())

describe('bienvenue : une seule façon d’entrer', () => {
  it('plus de « Passer » : « Entrer directement » et la visite restent', () => {
    render(<WelcomeScreen lang="fr" onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /passer/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrer directement/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /visite guidée/i })).toBeInTheDocument()
  })

  it('en anglais non plus : pas de « Skip »', () => {
    render(<WelcomeScreen lang="en" onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
  })

  it('« Entrer directement » ferme, et Échap aussi (la sortie au clavier reste)', () => {
    const onClose = vi.fn()
    render(<WelcomeScreen lang="fr" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /entrer directement/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('le pied de page dit ce qu’il ouvre', () => {
  it('fr : « Mentions légales », plus « Aide & Mentions légales »', () => {
    render(<MemoryRouter><Footer lang="fr" darkMode={false} isHome /></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'Mentions légales' }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Aide & Mentions légales/)).not.toBeInTheDocument()
  })

  it('en : « Legal », plus « Help & Legal »', () => {
    render(<MemoryRouter><Footer lang="en" darkMode={false} isHome /></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'Legal' }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Help & Legal/)).not.toBeInTheDocument()
  })

  it('l’aide du support renvoie vers « Mentions légales »', () => {
    const textes = JSON.stringify(SUPPORT_SELF_HELP)
    expect(textes).not.toMatch(/Aide & Mentions légales|Help & Legal/)
  })
})
