import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router-dom'

// Audit du 2026-10-04, ARCH-06 : un seul filet contre les plantages, au-dessus
// de toute l'app. Une erreur dans la fiche recette, le panier ou une fenêtre
// blanchissait l'application entière ; le filet, monté au-dessus du fournisseur
// de langue, parlait français à tout le monde ; et un morceau de code
// introuvable après un déploiement (onglet resté ouvert) tombait sur ce filet.

const recharger = vi.hoisted(() => vi.fn())
vi.mock('@features/pwa/lib/version-perimee', () => ({ rechargerSurLaDerniereVersion: recharger }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: () => {} }))
// Deux routes : une page qui plante, une page saine.
vi.mock('@routes/routes-config', () => ({
  ROUTES: [
    { path: '/casse', Component: () => { throw new Error('rendu cassé') } },
    { path: '/ailleurs', Component: () => <p>Tout va bien ici</p> },
  ],
}))

import ErrorBoundary from '@app/error/error-boundary'
import AppRoutes from '@routes/index'
import { estUnMorceauIntrouvable } from '@app/error/morceau-introuvable'

const Boum = () => { throw new Error('rendu cassé') }
const MorceauPerdu = () => { throw new TypeError('Failed to fetch dynamically imported module: https://fridgeplus.app/assets/recipe-page-abc123.js') }

beforeEach(() => {
  recharger.mockReset()
  sessionStorage.clear()
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('le filet racine parle la langue du visiteur', () => {
  it('sans langue donnée, il lit celle que le visiteur a choisie', () => {
    localStorage.setItem('fridge-lang', 'en')
    render(<ErrorBoundary level="app"><Boum /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  })
})

describe('un plantage reste dans sa page (le vrai routeur de l’app)', () => {
  function App() {
    return (
      <MemoryRouter initialEntries={['/casse']}>
        <nav><Link to="/ailleurs">Ailleurs</Link></nav>
        <AppRoutes lang="fr" darkMode={false} />
      </MemoryRouter>
    )
  }

  it('la page cassée le dit ; la navigation reste là, et changer de page repart à neuf', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Cette page a rencontré un problème' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à l’accueil' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Ailleurs' }))
    expect(screen.getByText('Tout va bien ici')).toBeInTheDocument()
  })
})

// La récupération elle-même existe depuis le lot SEO-08 (`installerLaRecuperation`
// sur `vite:preloadError`, une seule tentative). Ce qui manquait : sur un filet
// de PAGE, « Réessayer » rejouait l'import du même fichier disparu.
describe('un morceau de code introuvable après un déploiement', () => {
  it('« Réessayer » recharge sur la dernière version (rejouer l’import redemanderait le fichier disparu)', () => {
    render(<ErrorBoundary level="page" lang="fr"><MorceauPerdu /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(recharger).toHaveBeenCalledTimes(1)
  })

  it('une erreur ordinaire : « Réessayer » rejoue la page, sans recharger', () => {
    render(<ErrorBoundary level="page" lang="fr"><Boum /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(recharger).not.toHaveBeenCalled()
  })

  it('reconnaît les messages des navigateurs, et pas une erreur ordinaire', () => {
    expect(estUnMorceauIntrouvable(new TypeError('Failed to fetch dynamically imported module: x.js'))).toBe(true)
    expect(estUnMorceauIntrouvable(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(estUnMorceauIntrouvable(new Error('error loading dynamically imported module: x.js'))).toBe(true)
    expect(estUnMorceauIntrouvable(new Error('rendu cassé'))).toBe(false)
  })
})
