import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Lot 9e : des informations posées en `aria-label` sur des `span`/`div` sans
// rôle — les lecteurs d'écran les ignoraient (voir
// `noms-sur-elements-sans-role.test.js`). Ici, ce qu'on entend désormais.

const notif = vi.hoisted(() => ({ unreadCount: 0 }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }))
vi.mock('@features/notifications/hooks/use-notifications', () => ({ useNotifications: () => ({ unreadCount: notif.unreadCount }) }))
vi.mock('@features/notifications/components/notifications-panel', () => ({ default: () => null }))
vi.mock('@shared/ui/tooltip', () => ({ default: ({ children }) => children }))

import NotificationsBell from '@features/notifications/components/notifications-bell'
import CountBadge from '@shared/ui/count-badge'
import CookingProgressDots from '@features/cooking-mode/components/cooking-progress-dots'
import { Stars } from '@features/recipes/components/recipe-reviews-section'

describe('la cloche dit combien de notifications attendent', () => {
  it('trois non lues : le bouton le dit (la pastille seule ne s’entendait pas)', () => {
    notif.unreadCount = 3
    render(<NotificationsBell lang="fr" />)
    expect(screen.getByRole('button', { name: 'Notifications, 3 notifications non lues' })).toBeInTheDocument()
  })

  it('aucune : le bouton s’appelle « Notifications », sans plus', () => {
    notif.unreadCount = 0
    render(<NotificationsBell lang="fr" />)
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('en anglais aussi', () => {
    notif.unreadCount = 1
    render(<NotificationsBell lang="en" />)
    expect(screen.getByRole('button', { name: 'Notifications, 1 unread notification' })).toBeInTheDocument()
  })
})

describe('pastille de compte nommée', () => {
  it('le nom donné est lu, le chiffre seul est caché du lecteur d’écran', () => {
    render(<CountBadge count={3} aria-label="3 articles dans le panier" />)
    expect(screen.getByText('3 articles dans le panier')).toHaveClass('sr-only')
    expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true')
  })

  it('sans nom donné, le chiffre reste lu', () => {
    render(<CountBadge count={3} />)
    expect(screen.getByText('3')).not.toHaveAttribute('aria-hidden')
  })
})

describe('des images faites de morceaux', () => {
  it('les points de progression du mode cuisine forment une image nommée', () => {
    render(<CookingProgressDots current={2} total={5} />)
    expect(screen.getByRole('img', { name: '2 / 5' })).toBeInTheDocument()
  })

  it('les étoiles d’une note affichée forment une image nommée', () => {
    render(<Stars value={4} />)
    expect(screen.getByRole('img', { name: '4/5' })).toBeInTheDocument()
  })
})
