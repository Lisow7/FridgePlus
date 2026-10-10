import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

// Décision du 2026-10-08 — les deux écrans du compte :
//   · une session perdue : le bandeau du haut, avec « Me reconnecter » ; il reste
//     jusqu'à ce qu'on le ferme ;
//   · « Déconnecter tous mes appareils » dans Compte & sécurité.
// Textes de la maquette validée.

const etat = vi.hoisted(() => ({ auth: {}, lang: 'fr' }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => etat.auth }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: etat.lang }) }))

import BandeauSessionPerdue from '@app/components/bandeau-session-perdue'
import AppareilsSection from '@features/profile/components/appareils-section'

function Lieu() {
  const { pathname, state } = useLocation()
  return <p data-testid="lieu">{pathname}{state?.from ? ` ← ${state.from.pathname}` : ''}</p>
}

const avecRouteur = (element, entree = '/recettes') => render(
  <MemoryRouter initialEntries={[entree]}>
    {element}
    <Routes>
      <Route path="*" element={<Lieu />} />
    </Routes>
  </MemoryRouter>,
)

beforeEach(() => {
  etat.lang = 'fr'
  etat.auth = {}
})

describe('le bandeau de la session perdue', () => {
  const oublier = vi.fn()
  beforeEach(() => {
    oublier.mockReset()
    etat.auth = { user: null, sessionPerdue: true, oublierLaSessionPerdue: oublier }
  })

  it('dit ce qui s’est passé, comme une alerte', () => {
    avecRouteur(<BandeauSessionPerdue />)
    expect(screen.getByRole('alert')).toHaveTextContent('Ta session a expiré. Reconnecte-toi pour retrouver ton frigo.')
  })

  it('« Me reconnecter » mène à la connexion, qui ramènera ici', () => {
    avecRouteur(<BandeauSessionPerdue />)
    fireEvent.click(screen.getByRole('button', { name: 'Me reconnecter' }))
    expect(screen.getByTestId('lieu')).toHaveTextContent('/login ← /recettes')
    expect(oublier).toHaveBeenCalledTimes(1)
  })

  it('« Fermer » le retire', () => {
    avecRouteur(<BandeauSessionPerdue />)
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(oublier).toHaveBeenCalledTimes(1)
  })

  it('en anglais aussi', () => {
    etat.lang = 'en'
    avecRouteur(<BandeauSessionPerdue />)
    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired. Sign in again to get your fridge back.')
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('rien à dire (session là, ou fin voulue) : rien d’affiché', () => {
    etat.auth = { user: null, sessionPerdue: false, oublierLaSessionPerdue: oublier }
    avecRouteur(<BandeauSessionPerdue />)
    expect(screen.queryByRole('alert')).toBeNull()
    etat.auth = { user: { id: 'u1' }, sessionPerdue: true, oublierLaSessionPerdue: oublier }
    avecRouteur(<BandeauSessionPerdue />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('« Déconnecter tous mes appareils »', () => {
  const deconnecter = vi.fn()
  beforeEach(() => {
    deconnecter.mockReset()
    deconnecter.mockResolvedValue({ error: null })
    etat.auth = { deconnecterTousLesAppareils: deconnecter }
  })

  it('la ligne « Appareils » de la maquette, et son bouton', async () => {
    render(<AppareilsSection lang="fr" />)
    expect(screen.getByText('Appareils')).toBeInTheDocument()
    expect(screen.getByText('Un téléphone perdu, une session restée ouverte chez quelqu’un ? Ferme ta session partout, ici compris.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Déconnecter tous mes appareils' }))
    await waitFor(() => expect(deconnecter).toHaveBeenCalledTimes(1))
  })

  it('un échec se dit, et le bouton revient', async () => {
    deconnecter.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    render(<AppareilsSection lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: 'Déconnecter tous mes appareils' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La déconnexion de tes appareils n’a pas abouti. Réessaie.')
    expect(screen.getByRole('button', { name: 'Déconnecter tous mes appareils' })).toBeEnabled()
  })

  it('en anglais aussi', () => {
    render(<AppareilsSection lang="en" />)
    expect(screen.getByText('Devices')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out of all my devices' })).toBeInTheDocument()
  })
})
