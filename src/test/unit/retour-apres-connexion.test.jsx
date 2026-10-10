import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

// Audit du 2026-10-04, CPT-18 : un visiteur sans session qui ouvrait une page
// réservée (/cart depuis une notification, un favori, un lien partagé) était
// renvoyé à l'accueil, sans explication — `AuthGuard` visait « / » alors que
// la configuration des routes annonçait « /login », et la page d'origine
// (`state.from`) n'était relue par personne sur l'accueil.

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: vi.fn() }))
import { useAuth } from '@shared/contexts/auth-provider'
import AuthGuard from '@routes/guards/auth-guard'
import RedirectIfAuthGuard from '@routes/guards/redirect-if-auth-guard'

function Lieu() {
  const { pathname, search, hash } = useLocation()
  return <p data-testid="lieu">{pathname + search + hash}</p>
}

const arbre = (entree) => (
  <MemoryRouter initialEntries={[entree]}>
    <Routes>
      <Route path="/" element={<Lieu />} />
      <Route path="/login" element={<RedirectIfAuthGuard><Lieu /></RedirectIfAuthGuard>} />
      <Route path="/cart" element={<AuthGuard><Lieu /></AuthGuard>} />
      <Route path="/profile/*" element={<AuthGuard><Lieu /></AuthGuard>} />
    </Routes>
  </MemoryRouter>
)

const compte = (user, { recoveryMode = false, aEuUneSession = false } = {}) =>
  useAuth.mockReturnValue({ user, loading: false, recoveryMode, aEuUneSession })
const lieu = () => screen.getByTestId('lieu').textContent

beforeEach(() => { useAuth.mockReset() })

describe('un visiteur sans session devant une page réservée', () => {
  it('est invité à se connecter, plus renvoyé à l’accueil', () => {
    compte(null)
    render(arbre('/cart'))
    expect(lieu()).toBe('/login')
  })

  it('une fois connecté, revient sur la page demandée — requête et ancre comprises', () => {
    compte(null)
    const { rerender } = render(arbre('/profile/recompenses?reward=volume-1#haut'))
    expect(lieu()).toBe('/login')

    compte({ id: 'u-1' }, { aEuUneSession: true })
    rerender(arbre('/profile/recompenses?reward=volume-1#haut'))
    expect(lieu()).toBe('/profile/recompenses?reward=volume-1#haut')
  })
})

describe('ce qui ne change pas', () => {
  it('une session qui se ferme sur une page réservée ramène à l’accueil, pas à la connexion', () => {
    compte({ id: 'u-1' }, { aEuUneSession: true })
    const { rerender } = render(arbre('/cart'))
    expect(lieu()).toBe('/cart')

    compte(null, { aEuUneSession: true })
    rerender(arbre('/cart'))
    expect(lieu()).toBe('/')
  })

  // L'écran « Compte désactivé » remplace l'application : le garde de la page
  // n'existe plus quand la session se ferme, il est monté de neuf ensuite.
  it('un écran qui remplaçait l’application rend la main sur une page réservée : l’accueil aussi', () => {
    compte(null, { aEuUneSession: true })
    render(arbre('/profile/compte'))
    expect(lieu()).toBe('/')
  })

  it('le parcours « nouveau mot de passe » ramène toujours à l’accueil', () => {
    compte({ id: 'u-1' }, { recoveryMode: true, aEuUneSession: true })
    render(arbre('/cart'))
    expect(lieu()).toBe('/')
  })

  it('connecté sans page d’origine, /login mène à l’accueil', () => {
    compte({ id: 'u-1' }, { aEuUneSession: true })
    render(arbre('/login'))
    expect(lieu()).toBe('/')
  })
})
