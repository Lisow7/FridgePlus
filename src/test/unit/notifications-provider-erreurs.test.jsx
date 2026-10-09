import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'

const getMyNotifications = vi.hoisted(() => vi.fn())
const countUnreadNotifications = vi.hoisted(() => vi.fn())
const markNotificationRead = vi.hoisted(() => vi.fn())
const markAllNotificationsRead = vi.hoisted(() => vi.fn())
const deleteNotification = vi.hoisted(() => vi.fn())
const deleteAllReadNotifications = vi.hoisted(() => vi.fn())

vi.mock('@features/notifications/api/notifications', () => ({
  getMyNotifications, countUnreadNotifications, markNotificationRead,
  markAllNotificationsRead, deleteNotification, deleteAllReadNotifications,
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }))
vi.mock('@shared/lib/supabase/client', () => {
  const canal = { on: () => canal, subscribe: () => canal }
  return { supabase: { channel: () => canal, removeChannel: () => {} } }
})

import { NotificationsProvider, useNotifications } from '@features/notifications/providers/notifications-provider'

// Audit du 2026-10-04, UX-02. Une liste de notifications qui n'a pas chargé
// s'affichait « Aucune notification » : `refresh` ne regardait pas l'erreur, et
// posait la liste vide rendue par l'API. Un appel qui lève laissait en plus
// `loading` bloqué à vrai (pas de `finally`). Et une action refusée (marquer
// comme lu, supprimer) ne rendait rien à l'appelant : elle ne faisait… rien.
function Sonde({ onReady }) {
  onReady(useNotifications())
  return null
}
let api = null
const monter = () => render(<NotificationsProvider><Sonde onReady={(v) => { api = v }} /></NotificationsProvider>)

const LISTE = [{ id: 'n-1', read_at: null }, { id: 'n-2', read_at: '2026-08-01T00:00:00.000Z' }]
const PANNE = { message: 'Failed to fetch' }

describe('NotificationsProvider — chargement en échec', () => {
  beforeEach(() => {
    api = null
    getMyNotifications.mockReset(); getMyNotifications.mockResolvedValue({ data: LISTE, count: 2, error: null })
    countUnreadNotifications.mockReset(); countUnreadNotifications.mockResolvedValue(1)
    markNotificationRead.mockReset(); markNotificationRead.mockResolvedValue({ error: null })
    markAllNotificationsRead.mockReset(); markAllNotificationsRead.mockResolvedValue({ error: null })
    deleteNotification.mockReset(); deleteNotification.mockResolvedValue({ error: null })
    deleteAllReadNotifications.mockReset(); deleteAllReadNotifications.mockResolvedValue({ error: null })
  })

  it('chargement réussi : pas d’erreur', async () => {
    monter()
    await waitFor(() => expect(api.notifications).toHaveLength(2))
    expect(api.loadError).toBe(false)
    expect(api.loading).toBe(false)
  })

  it('chargement refusé : c’est dit (`loadError`), ce n’est pas « aucune notification »', async () => {
    getMyNotifications.mockResolvedValue({ data: [], count: 0, error: PANNE })
    monter()
    await waitFor(() => expect(api.loadError).toBe(true))
    expect(api.loading).toBe(false)
  })

  it('un chargement qui lève ne laisse pas « chargement » bloqué', async () => {
    getMyNotifications.mockRejectedValue(new TypeError('Failed to fetch'))
    monter()
    await waitFor(() => expect(api.loadError).toBe(true))
    expect(api.loading).toBe(false)
  })

  it('un rechargement raté garde la liste déjà affichée', async () => {
    monter()
    await waitFor(() => expect(api.notifications).toHaveLength(2))
    getMyNotifications.mockResolvedValue({ data: [], count: 0, error: PANNE })
    await act(async () => { await api.refresh() })
    expect(api.notifications).toHaveLength(2)
    expect(api.unreadCount).toBe(1)
    expect(api.loadError).toBe(true)
  })

  it('« Réessayer » (refresh) réussi : l’erreur disparaît', async () => {
    getMyNotifications.mockResolvedValueOnce({ data: [], count: 0, error: PANNE })
    monter()
    await waitFor(() => expect(api.loadError).toBe(true))
    await act(async () => { await api.refresh() })
    expect(api.loadError).toBe(false)
    expect(api.notifications).toHaveLength(2)
  })
})

describe('NotificationsProvider — action refusée', () => {
  beforeEach(() => {
    api = null
    getMyNotifications.mockReset(); getMyNotifications.mockResolvedValue({ data: LISTE, count: 2, error: null })
    countUnreadNotifications.mockReset(); countUnreadNotifications.mockResolvedValue(1)
    markNotificationRead.mockReset(); markAllNotificationsRead.mockReset()
    deleteNotification.mockReset(); deleteAllReadNotifications.mockReset()
  })

  it.each([
    ['markRead', markNotificationRead, (a) => a.markRead('n-1')],
    ['markAllRead', markAllNotificationsRead, (a) => a.markAllRead()],
    ['deleteNotif', deleteNotification, (a) => a.deleteNotif('n-1')],
    ['deleteAllRead', deleteAllReadNotifications, (a) => a.deleteAllRead()],
  ])('%s refusé : l’erreur est rendue à l’appelant, et rien ne bouge à l’écran', async (_nom, appel, agir) => {
    appel.mockResolvedValue({ error: PANNE })
    monter()
    await waitFor(() => expect(api.notifications).toHaveLength(2))
    let retour
    await act(async () => { retour = await agir(api) })
    expect(retour.error).toBeTruthy()
    expect(api.notifications).toEqual(LISTE)
    expect(api.unreadCount).toBe(1)
  })

  it.each([
    ['markRead', markNotificationRead, (a) => a.markRead('n-1')],
    ['markAllRead', markAllNotificationsRead, (a) => a.markAllRead()],
    ['deleteNotif', deleteNotification, (a) => a.deleteNotif('n-1')],
    ['deleteAllRead', deleteAllReadNotifications, (a) => a.deleteAllRead()],
  ])('%s qui lève (réseau coupé) : une erreur rendue, pas une exception', async (_nom, appel, agir) => {
    appel.mockRejectedValue(new TypeError('Failed to fetch'))
    monter()
    await waitFor(() => expect(api.notifications).toHaveLength(2))
    let retour
    await act(async () => { retour = await agir(api) })
    expect(retour.error).toBeTruthy()
  })

  it('action acceptée : `{ error: null }`', async () => {
    markNotificationRead.mockResolvedValue({ error: null })
    monter()
    await waitFor(() => expect(api.notifications).toHaveLength(2))
    let retour
    await act(async () => { retour = await api.markRead('n-1') })
    expect(retour).toEqual({ error: null })
    expect(api.unreadCount).toBe(0)
  })
})
