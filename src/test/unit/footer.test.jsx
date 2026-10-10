import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import Footer from '@app/layout/footer'
import { CURRENT_VERSION } from '@shared/lib/version'

// Le pied de page d'aujourd'hui. L'ancien fichier, ignoré en bloc depuis la
// v3.8 (« TODO v3.18.x »), testait « Mentions & CGU », un lien Twemoji, des
// réseaux sociaux désactivés, un bouton Support et des modales qui n'existent
// plus — une promesse de vérification sans vérification (audit du 2026-10-04,
// ARCH-17 (1)). Ici : ce que le pied rend vraiment, lu dans footer.jsx.
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => false }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
// La fenêtre des cookies a ses propres tests (cookie-modal.test.jsx) : un
// double, qui ne rend que ce que le pied lui passe.
vi.mock('@features/legal/components/cookie-modal', () => ({
  default: ({ onClose, onShowLegal }) => (
    <div role="dialog" aria-label="cookies">
      <button type="button" onClick={onShowLegal}>politique</button>
      <button type="button" onClick={onClose}>fermer</button>
    </div>
  ),
}))

function OuSuisJe() { return <span data-testid="ou-suis-je">{useLocation().pathname}</span> }
const monter = (props = {}) => render(
  <MemoryRouter><OuSuisJe /><Footer lang="fr" darkMode={false} isHome {...props} /></MemoryRouter>,
)
const VERSION = new RegExp(`^v${CURRENT_VERSION.replace(/\./g, '\\.')}`)

beforeEach(() => localStorage.clear())

describe('Footer — ce qu’il rend', () => {
  it('la version courante mène au journal des versions (ligne téléphone et ligne ordinateur)', () => {
    monter()
    const liens = screen.getAllByRole('link', { name: VERSION })
    expect(liens.length).toBeGreaterThan(0)
    for (const lien of liens) expect(lien).toHaveAttribute('href', '/changelog')
  })

  it('« Mentions légales » → /legal, « Comment ça marche » → /guide, « Questions fréquentes » → /faq', () => {
    monter()
    for (const lien of screen.getAllByRole('link', { name: 'Mentions légales' })) expect(lien).toHaveAttribute('href', '/legal')
    expect(screen.getByRole('link', { name: 'Comment ça marche' })).toHaveAttribute('href', '/guide')
    expect(screen.getByRole('link', { name: 'Questions fréquentes' })).toHaveAttribute('href', '/faq')
  })

  it('en anglais : « Legal », « How it works », « FAQ »', () => {
    monter({ lang: 'en' })
    for (const lien of screen.getAllByRole('link', { name: 'Legal' })) expect(lien).toHaveAttribute('href', '/legal')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '/guide')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
  })

  it('l’année courante', () => {
    monter()
    expect(screen.getAllByText(`© ${new Date().getFullYear()}`).length).toBeGreaterThan(0)
  })

  it('« Cookies » ouvre la fenêtre des cookies ; sa politique la ferme et mène à /legal', async () => {
    monter()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cookies' })[0])
    expect(await screen.findByRole('dialog', { name: 'cookies' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'politique' }))
    expect(screen.queryByRole('dialog', { name: 'cookies' })).toBeNull()
    expect(screen.getByTestId('ou-suis-je')).toHaveTextContent('/legal')
  })

  it('« fermer » referme la fenêtre sans bouger', async () => {
    monter()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cookies' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'fermer' }))
    expect(screen.queryByRole('dialog', { name: 'cookies' })).toBeNull()
    expect(screen.getByTestId('ou-suis-je')).toHaveTextContent('/')
  })
})
