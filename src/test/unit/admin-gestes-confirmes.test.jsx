import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { UIProvider } from '@shared/contexts/ui-provider'
import { ConfirmProvider } from '@shared/ui/confirm-dialog/confirm-provider'

const notifs = vi.hoisted(() => ({
  getAdminFeed: vi.fn(), adminDeleteNotification: vi.fn(), adminSendNotification: vi.fn(),
  sendAnnouncementPush: vi.fn(), getAdminFeedCounts: vi.fn(),
}))
const drapeaux = vi.hoisted(() => ({ loadFeatureFlags: vi.fn(), setFeatureFlag: vi.fn(), push: true }))

vi.mock('@features/notifications/api/notifications', () => notifs)
vi.mock('@features/notifications/components/notifications-panel', () => ({ NotifItem: () => null }))
vi.mock('@shared/api/feature-flags', () => ({ loadFeatureFlags: drapeaux.loadFeatureFlags, setFeatureFlag: drapeaux.setFeatureFlag }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({
  useFeatureFlag: (cle) => (cle === 'push_notifications' ? drapeaux.push : false),
  useFeatureFlags: () => ({ reload: vi.fn() }),
}))
vi.mock('@features/admin/providers/admin-provider', () => ({ useAdmin: () => ({ setSection: vi.fn() }) }))
vi.mock('@shared/ui/pagination', () => ({ default: () => null }))

import NotificationsSection from '@features/admin/components/sections/notifications-section'
import FeaturesSection from '@features/admin/components/sections/features-section'

// Audit du 2026-10-04, ADM-03 et ADM-04 : les gestes les plus lourds du
// panneau partaient au premier clic — une annonce dans la cloche de TOUS les
// comptes, le retrait d'une diffusion chez tous ses destinataires, une
// fonctionnalité coupée en production. Chacun demande désormais confirmation,
// et dit ce qui s'est vraiment passé. Le vrai fournisseur de confirmation est
// monté : « Revenir » doit empêcher l'écriture, pas seulement fermer une fenêtre.

const monter = (ui) => render(<UIProvider><ConfirmProvider>{ui}</ConfirmProvider></UIProvider>)
const confirmation = (nom) => screen.findByRole('dialog', { name: nom })

beforeEach(() => {
  localStorage.setItem('fridge-lang', 'fr')
  Object.values(notifs).forEach((m) => m.mockReset())
  drapeaux.loadFeatureFlags.mockReset()
  drapeaux.setFeatureFlag.mockReset()
  drapeaux.push = true
  notifs.getAdminFeed.mockResolvedValue({ data: [], count: 0, error: null })
  notifs.getAdminFeedCounts.mockResolvedValue({ counts: {} })
  notifs.adminSendNotification.mockResolvedValue({ data: null, error: null })
  notifs.sendAnnouncementPush.mockResolvedValue({ data: {}, error: null })
})

async function ouvrirLaRedaction() {
  monter(<NotificationsSection lang="fr" />)
  fireEvent.click(await screen.findByRole('button', { name: /^Envoyer$/ }))
  const fenetre = await screen.findByRole('dialog', { name: 'Envoyer une notification' })
  fireEvent.change(within(fenetre).getByLabelText('Titre (FR) *'), { target: { value: 'Maintenance ce soir' } })
  return fenetre
}

describe('notifications — envoyer à tous se confirme', () => {
  it('aucun type n’est choisi d’avance : sans type, rien ne part', async () => {
    const fenetre = await ouvrirLaRedaction()
    fireEvent.click(within(fenetre).getByRole('button', { name: /^Envoyer$/ }))
    expect(await within(fenetre).findByText('Choisis le type de notification.')).toBeInTheDocument()
    expect(notifs.adminSendNotification).not.toHaveBeenCalled()
  })

  it('une annonce demande confirmation ; « Revenir au message » n’envoie rien et garde la saisie', async () => {
    const fenetre = await ouvrirLaRedaction()
    fireEvent.click(within(fenetre).getByRole('button', { name: /Annonce/ }))
    fireEvent.click(within(fenetre).getByRole('button', { name: /^Envoyer$/ }))

    const question = await confirmation('Envoyer à tous les comptes ?')
    expect(question).toHaveTextContent('« Maintenance ce soir » arrivera dans la cloche de chaque compte')
    fireEvent.click(within(question).getByRole('button', { name: 'Revenir au message' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Envoyer à tous les comptes ?' })).not.toBeInTheDocument())
    expect(notifs.adminSendNotification).not.toHaveBeenCalled()
    expect(within(fenetre).getByLabelText('Titre (FR) *')).toHaveValue('Maintenance ce soir')
  })

  it('confirmée, l’annonce part à tous, et l’échec de l’envoi sur les téléphones est dit', async () => {
    notifs.sendAnnouncementPush.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } })
    const fenetre = await ouvrirLaRedaction()
    fireEvent.click(within(fenetre).getByRole('button', { name: /Annonce/ }))
    fireEvent.click(within(fenetre).getByRole('button', { name: /^Envoyer$/ }))
    fireEvent.click(within(await confirmation('Envoyer à tous les comptes ?')).getByRole('button', { name: 'Envoyer à tous' }))

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent("Notification envoyée dans l'app, mais pas sur les téléphones : Edge Function returned a non-2xx status code.")
    expect(notifs.adminSendNotification).toHaveBeenCalledTimes(1)
    expect(notifs.adminSendNotification.mock.calls[0][0]).toMatchObject({ type: 'announcement', recipientId: null })
  })

  it('envoi sur les téléphones désactivé : le bandeau le dit', async () => {
    drapeaux.push = false
    const fenetre = await ouvrirLaRedaction()
    fireEvent.click(within(fenetre).getByRole('button', { name: /Maintenance/ }))
    fireEvent.click(within(fenetre).getByRole('button', { name: /^Envoyer$/ }))
    fireEvent.click(within(await confirmation('Envoyer à tous les comptes ?')).getByRole('button', { name: 'Envoyer à tous' }))

    expect(await screen.findByRole('status')).toHaveTextContent("Notification envoyée dans l'app. L'envoi sur les téléphones est désactivé.")
    expect(notifs.sendAnnouncementPush).not.toHaveBeenCalled()
  })

  it('un message ciblé part sans confirmation (un seul destinataire, nommé)', async () => {
    const fenetre = await ouvrirLaRedaction()
    fireEvent.click(within(fenetre).getByRole('button', { name: /Message ciblé/ }))
    fireEvent.change(within(fenetre).getByLabelText('User ID (UUID)'), { target: { value: '00000000-0000-0000-0000-000000000009' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: /^Envoyer$/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Message envoyé.')
    expect(notifs.adminSendNotification.mock.calls[0][0]).toMatchObject({ type: 'admin_message', recipientId: '00000000-0000-0000-0000-000000000009' })
    expect(screen.queryByRole('dialog', { name: 'Envoyer à tous les comptes ?' })).not.toBeInTheDocument()
  })
})

// ADM-18 : le brouillon d'une annonce se perdait sur un clic (fond, croix,
// « Annuler »), et un cliquer-glisser relâché hors de la carte fermait aussi.
describe('notifications — le brouillon ne se perd pas sur un clic', () => {
  it('avec un titre écrit, « Annuler » demande d’abord ; « Continuer » garde la saisie', async () => {
    const fenetre = await ouvrirLaRedaction()
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Annuler' }))
    const question = await confirmation('Abandonner ce brouillon ?')
    fireEvent.click(within(question).getByRole('button', { name: 'Continuer' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Abandonner ce brouillon ?' })).not.toBeInTheDocument())
    expect(within(fenetre).getByLabelText('Titre (FR) *')).toHaveValue('Maintenance ce soir')
  })

  it('un cliquer-glisser commencé dans un champ et relâché sur le fond ne ferme pas', async () => {
    const fenetre = await ouvrirLaRedaction()
    fireEvent.mouseDown(within(fenetre).getByLabelText('Titre (FR) *'))
    fireEvent.click(fenetre.parentElement)
    expect(screen.queryByRole('dialog', { name: 'Abandonner ce brouillon ?' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Envoyer une notification' })).toBeInTheDocument()
  })
})

describe('notifications — retirer du fil se confirme, et l’échec est dit', () => {
  const DIFFUSION = { id: 'n-1', type: 'announcement', batch_id: 'b-1', recipient_id: null, recipient_role: 'admin', title: { fr: 'Nouveautés' }, created_at: '2026-10-08T03:00:00Z', expires_at: '2099-01-01T00:00:00Z' }
  const LIGNE = { id: 'n-2', type: 'recipe_pending', batch_id: null, recipient_id: null, recipient_role: 'admin', title: { fr: 'Recette à modérer' }, created_at: '2026-10-08T03:00:00Z', expires_at: '2099-01-01T00:00:00Z' }

  beforeEach(() => notifs.getAdminFeed.mockResolvedValue({ data: [DIFFUSION, LIGNE], count: 2, error: null }))
  const corbeilles = async () => screen.findAllByRole('button', { name: 'Supprimer du feed' })

  it('une diffusion : « pour tous ses destinataires » ; « Garder » ne retire rien', async () => {
    monter(<NotificationsSection lang="fr" />)
    fireEvent.click((await corbeilles())[0])
    const question = await confirmation('Retirer cette notification pour tous ses destinataires ?')
    expect(question).toHaveTextContent("Elle disparaît de la cloche de chaque compte qui l'a reçue, et de cette liste.")
    fireEvent.click(within(question).getByRole('button', { name: 'Garder' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Retirer cette notification/ })).not.toBeInTheDocument())
    expect(notifs.adminDeleteNotification).not.toHaveBeenCalled()
    expect(screen.getByText('Nouveautés')).toBeInTheDocument()
  })

  it('une ligne sans diffusion : seulement cette ligne', async () => {
    monter(<NotificationsSection lang="fr" />)
    fireEvent.click((await corbeilles())[1])
    expect(await confirmation('Retirer cette ligne du fil ?')).toHaveTextContent("Elle disparaît de cette liste ; rien d'autre n'est touché.")
  })

  it('la base refuse : la ligne reste, et c’est dit', async () => {
    notifs.adminDeleteNotification.mockResolvedValue({ data: null, error: { message: 'admin_delete_notification_batch: permission denied' } })
    monter(<NotificationsSection lang="fr" />)
    fireEvent.click((await corbeilles())[0])
    fireEvent.click(within(await confirmation(/Retirer cette notification/)).getByRole('button', { name: 'Retirer pour tous' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Échec : admin_delete_notification_batch: permission denied')
    expect(notifs.adminDeleteNotification).toHaveBeenCalledWith('n-1')
    expect(screen.getByText('Nouveautés')).toBeInTheDocument()
  })
})

describe('fonctionnalités — basculer en production se confirme', () => {
  beforeEach(() => {
    drapeaux.loadFeatureFlags.mockResolvedValue({ error: null, data: [
      { key: 'receipt_scan', enabled: true, label: 'Photo du ticket', description: 'Lire un ticket de caisse.' },
    ] })
    drapeaux.setFeatureFlag.mockResolvedValue({ error: null })
  })

  it('la question nomme la fonctionnalité et l’effet ; « Annuler » ne touche à rien', async () => {
    monter(<FeaturesSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /Activée/ }))
    const question = await confirmation('Désactiver « Photo du ticket » ?')
    expect(question).toHaveTextContent('Le changement est immédiat, pour tous les visiteurs. Clé : receipt_scan.')
    fireEvent.click(within(question).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Désactiver/ })).not.toBeInTheDocument())
    expect(drapeaux.setFeatureFlag).not.toHaveBeenCalled()
  })

  it('confirmée, la bascule part', async () => {
    monter(<FeaturesSection lang="fr" />)
    fireEvent.click(await screen.findByRole('button', { name: /Activée/ }))
    fireEvent.click(within(await confirmation('Désactiver « Photo du ticket » ?')).getByRole('button', { name: 'Désactiver' }))
    await waitFor(() => expect(drapeaux.setFeatureFlag).toHaveBeenCalledWith('receipt_scan', false))
    expect(await screen.findByRole('button', { name: /Désactivée/ })).toBeInTheDocument()
  })
})
