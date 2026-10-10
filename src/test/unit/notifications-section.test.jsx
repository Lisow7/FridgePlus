import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Décision du 2026-10-08 (audit du 2026-10-04) : le seul interrupteur des
// notifications vivait dans la fenêtre « Cookies et données », et allumait
// d'un coup trois envois. Désormais un bloc « Notifications » dans Profil →
// Préférences, sous « Allergènes » : l'appareil d'abord, puis les trois envois
// un par un (le serveur les distinguait déjà : inactivity_reminder,
// announcements, stock_expiry). Textes de la maquette validée.

const m = vi.hoisted(() => ({
  push: { available: true, enabled: false, loading: false, error: null, blocked: false, toggle: vi.fn() },
  profile: { push_preferences: { inactivity_reminder: true, announcements: true, stock_expiry: false } },
  maj: vi.fn(),
  signaler: vi.fn(),
}))
vi.mock('@features/push-notifications', () => ({
  usePushSubscription: () => m.push,
  updatePushPreferences: (...a) => m.maj(...a),
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ profile: m.profile }) }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => m.signaler }))

import NotificationsSection from '@features/profile/components/notifications-section'

const monter = (lang = 'fr', entree = '/profile/preferences') =>
  render(<MemoryRouter initialEntries={[entree]}><NotificationsSection lang={lang} /></MemoryRouter>)
const interrupteur = (nom) => screen.getByRole('switch', { name: nom })

beforeEach(() => {
  m.push = { available: true, enabled: false, loading: false, error: null, blocked: false, toggle: vi.fn() }
  m.profile = { push_preferences: { inactivity_reminder: true, announcements: true, stock_expiry: false } }
  m.maj.mockReset().mockResolvedValue({ error: null })
  m.signaler.mockReset()
})

describe('le bloc « Notifications » des Préférences', () => {
  it('l’appareil d’abord : éteint, les trois envois n’apparaissent pas', () => {
    monter()
    expect(screen.getByText('Notifications sur cet appareil')).toBeInTheDocument()
    expect(interrupteur('Activer sur cet appareil')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('switch', { name: 'Annonces de l’équipe' })).toBeNull()
    fireEvent.click(interrupteur('Activer sur cet appareil'))
    expect(m.push.toggle).toHaveBeenCalledTimes(1)
  })

  it('appareil activé : les trois envois, chacun à son état', () => {
    m.push.enabled = true
    monter()
    expect(interrupteur('Activer sur cet appareil')).toHaveAttribute('aria-checked', 'true')
    expect(interrupteur('Si tu n’as pas ouvert l’app depuis un moment')).toHaveAttribute('aria-checked', 'true')
    expect(interrupteur('Annonces de l’équipe')).toHaveAttribute('aria-checked', 'true')
    expect(interrupteur('Un reste arrive à péremption')).toHaveAttribute('aria-checked', 'false')
  })

  it('un envoi se règle seul, et c’est dit : « ✓ Enregistré »', async () => {
    m.push.enabled = true
    monter()
    fireEvent.click(interrupteur('Un reste arrive à péremption'))
    expect(m.maj).toHaveBeenCalledWith({ stock_expiry: true })
    await waitFor(() => expect(interrupteur('Un reste arrive à péremption')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByRole('status')).toHaveTextContent('✓ Enregistré')
  })

  it('refusé par la base : l’interrupteur revient, et c’est dit', async () => {
    m.push.enabled = true
    m.maj.mockResolvedValue({ error: { message: 'refusé' } })
    monter()
    fireEvent.click(interrupteur('Annonces de l’équipe'))
    await waitFor(() => expect(m.signaler).toHaveBeenCalledWith('setting'))
    expect(interrupteur('Annonces de l’équipe')).toHaveAttribute('aria-checked', 'true')
  })

  it('iPhone sans l’app installée : la note, et l’interrupteur éteint', () => {
    m.push.blocked = true
    monter()
    expect(screen.getByText('Installe d’abord Fridge+ sur ton écran d’accueil pour activer cette option (contrainte iOS).')).toBeInTheDocument()
    expect(interrupteur('Activer sur cet appareil')).toBeDisabled()
  })

  it('le navigateur a dit « Bloquer » : la marche à suivre', () => {
    m.push.error = 'permission_denied'
    monter()
    expect(screen.getByRole('alert')).toHaveTextContent('Ton navigateur bloque les notifications pour fridgeplus.app.')
  })

  // Venus de la fenêtre des cookies avec l'interrupteur.
  it('panne du navigateur : le texte du navigateur intégré', () => {
    m.push.error = 'failed'
    monter()
    expect(screen.getByRole('alert')).toHaveTextContent('navigateur intégré')
  })

  it('lecture de l’état impossible : le dire, sans accuser le navigateur', () => {
    m.push.error = 'read_failed'
    monter()
    expect(screen.getByRole('alert')).toHaveTextContent('n’a pas pu être lu')
    expect(screen.getByRole('alert')).not.toHaveTextContent('navigateur intégré')
  })

  it('refus du navigateur, en anglais', () => {
    m.push.error = 'permission_denied'
    monter('en')
    expect(screen.getByRole('alert')).toHaveTextContent('Your browser is blocking notifications')
  })

  it('notifications coupées pour tous (drapeau éteint) : pas de bloc', () => {
    m.push.available = false
    const { container } = monter()
    expect(container).toBeEmptyDOMElement()
  })

  it('l’ancre #notifications : le bloc porte l’ancre et vient en vue', () => {
    const vue = vi.spyOn(HTMLElement.prototype, 'scrollIntoView') // simulé par src/test/setup.js
    monter('fr', '/profile/preferences#notifications')
    expect(document.getElementById('notifications')).not.toBeNull()
    expect(vue).toHaveBeenCalled()
  })

  it('en anglais aussi', () => {
    m.push.enabled = true
    monter('en')
    expect(interrupteur('Enable on this device')).toBeInTheDocument()
    expect(interrupteur('If you haven’t opened the app in a while')).toBeInTheDocument()
    expect(interrupteur('Team announcements')).toBeInTheDocument()
    expect(interrupteur('A leftover is about to expire')).toBeInTheDocument()
  })
})
