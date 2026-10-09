import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const etat = vi.hoisted(() => ({ valeur: null }))
const signaler = vi.hoisted(() => vi.fn())

vi.mock('@features/notifications/hooks/use-notifications', () => ({ useNotifications: () => etat.valeur }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))

import NotificationsPanel from '@features/notifications/components/notifications-panel'

// Audit du 2026-10-04, UX-02 : une liste qui n'avait pas chargé s'affichait
// « Aucune notification », et une action refusée ne faisait… rien.
const LUE = { id: 'n-2', type: 'announcement', title: { fr: 'Nouveauté' }, body: { fr: 'Du neuf.' }, read_at: '2026-08-01T00:00:00Z', created_at: '2026-08-01T00:00:00Z' }
const NON_LUE = { id: 'n-1', type: 'announcement', title: { fr: 'Bienvenue' }, body: { fr: 'Bonjour.' }, read_at: null, created_at: '2026-08-02T00:00:00Z' }

function notifications(surcharge = {}) {
  return {
    notifications: [], unreadCount: 0, loading: false, loadError: false,
    refresh: vi.fn(),
    markRead: vi.fn().mockResolvedValue({ error: null }),
    markAllRead: vi.fn().mockResolvedValue({ error: null }),
    deleteNotif: vi.fn().mockResolvedValue({ error: null }),
    deleteAllRead: vi.fn().mockResolvedValue({ error: null }),
    ...surcharge,
  }
}
const monter = () => render(<NotificationsPanel lang="fr" onClose={() => {}} />)

describe('NotificationsPanel — quand ça ne charge pas', () => {
  beforeEach(() => { signaler.mockReset() })

  it('liste vide et chargée : « Aucune notification » (témoin)', () => {
    etat.valeur = notifications()
    monter()
    expect(screen.getByText('Aucune notification')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  })

  it('chargement raté : le dit, et propose de réessayer — pas « Aucune notification »', () => {
    etat.valeur = notifications({ loadError: true })
    monter()
    expect(screen.queryByText('Aucune notification')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(/n'ont pas pu être chargées/i)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(etat.valeur.refresh).toHaveBeenCalledTimes(1)
  })

  it('pendant la nouvelle tentative, « Réessayer » est inactif : le clic a été pris', () => {
    etat.valeur = notifications({ loadError: true, loading: true })
    monter()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeDisabled()
  })

  it('rechargement raté alors qu’une liste est déjà affichée : la liste reste lisible', () => {
    etat.valeur = notifications({ loadError: true, notifications: [NON_LUE] })
    monter()
    expect(screen.getByText('Bienvenue')).toBeInTheDocument()
  })
})

describe('NotificationsPanel — action refusée', () => {
  beforeEach(() => { signaler.mockReset() })

  it('« Tout marquer comme lu » refusé : « Pas enregistré »', async () => {
    etat.valeur = notifications({ notifications: [NON_LUE], markAllRead: vi.fn().mockResolvedValue({ error: { message: 'Failed to fetch' } }) })
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }))
    await waitFor(() => expect(signaler).toHaveBeenCalledTimes(1))
  })

  // Trouvé en écrivant ce test : le bouton ✓ de CHAQUE notification portait le
  // nom « Tout marquer comme lu » (infobulle et lecteur d'écran), alors qu'il
  // n'en marque qu'une.
  it('le bouton ✓ d’une notification dit « Marquer comme lu », pas « Tout marquer »', async () => {
    etat.valeur = notifications({ notifications: [NON_LUE] })
    monter()
    expect(screen.getAllByRole('button', { name: 'Tout marquer comme lu' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme lu' }))
    await waitFor(() => expect(etat.valeur.markRead).toHaveBeenCalledWith('n-1'))
    expect(etat.valeur.markAllRead).not.toHaveBeenCalled()
  })

  it('« Effacer les notifications lues » refusé : « Pas enregistré »', async () => {
    etat.valeur = notifications({ notifications: [LUE], deleteAllRead: vi.fn().mockResolvedValue({ error: { message: 'Failed to fetch' } }) })
    monter()
    fireEvent.click(screen.getByRole('button', { name: /effacer les notifications lues/i }))
    await waitFor(() => expect(signaler).toHaveBeenCalledTimes(1))
  })

  it('action acceptée : rien n’est dit', async () => {
    etat.valeur = notifications({ notifications: [NON_LUE] })
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }))
    await waitFor(() => expect(etat.valeur.markAllRead).toHaveBeenCalled())
    expect(signaler).not.toHaveBeenCalled()
  })
})
