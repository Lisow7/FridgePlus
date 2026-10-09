import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode } from 'react'
import { render, act, waitFor } from '@testing-library/react'

// Pureté des updaters de `NotificationsProvider`.
//
// POURQUOI CE TEST — même classe de défaut que la régression v0.120 sur
// `useFridgeStock` et que celle corrigée sur `UndoProvider` : un appel placé
// DANS l'updater de `setState`, or React invoque les updaters DEUX FOIS en
// StrictMode (actif en dev, cf. main.jsx) pour débusquer les effets de bord.
//
// Ici c'est PIRE que les deux précédents, et c'est ce qui rend le test utile :
// les cas d'avant étaient idempotents (un upsert rejoué écrit la même ligne),
// donc sans conséquence sur les données. `setUnreadCount(c => c - 1)` ne l'est
// pas : deux invocations décrémentent de DEUX. Le badge de la cloche affichait
// donc un non-lu de moins que la réalité à chaque suppression.
//
// `markRead` faisait déjà son décrément hors de l'updater — seul `deleteNotif`
// l'imbriquait. Ce test verrouille les deux.

const mockGetMy = vi.fn()
const mockCountUnread = vi.fn()
const mockDelete = vi.fn()
const mockMarkRead = vi.fn()

vi.mock('@features/notifications/api/notifications', () => ({
  getMyNotifications: (...a) => mockGetMy(...a),
  countUnreadNotifications: (...a) => mockCountUnread(...a),
  markNotificationRead: (...a) => mockMarkRead(...a),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ error: null }),
  deleteNotification: (...a) => mockDelete(...a),
  deleteAllReadNotifications: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}))

// Canal realtime inerte : le provider s'y abonne au montage, on ne teste pas ça.
vi.mock('@shared/lib/supabase/client', () => {
  const canal = { on: () => canal, subscribe: () => canal }
  return { supabase: { channel: () => canal, removeChannel: () => {} } }
})

import { NotificationsProvider, useNotifications } from '@features/notifications/providers/notifications-provider'

// Rappel `onReady` plutot qu'une ecriture dans une variable externe : le
// compilateur React refuse qu'un composant modifie une valeur declaree hors de
// lui. Meme idiome que `undo-provider-updater-purity.test.jsx`, qui verrouille
// la meme classe de defaut sur le fournisseur d'annulation.
function Sonde({ onReady }) {
  onReady(useNotifications())
  return null
}

let api = null
function monter() {
  return render(
    <StrictMode>
      <NotificationsProvider>
        <Sonde onReady={(v) => { api = v }} />
      </NotificationsProvider>
    </StrictMode>
  )
}

describe('NotificationsProvider — pureté des updaters (StrictMode)', () => {
  beforeEach(() => {
    api = null
    mockGetMy.mockResolvedValue({ data: [
      { id: 'n-1', read_at: null },
      { id: 'n-2', read_at: null },
      { id: 'n-3', read_at: '2026-08-01T00:00:00.000Z' },
    ] })
    mockCountUnread.mockResolvedValue(2)
    mockDelete.mockResolvedValue({ error: null })
    mockMarkRead.mockResolvedValue({ error: null })
  })

  it('supprimer UNE notification non lue décrémente le compteur de UN', async () => {
    monter()
    await waitFor(() => expect(api?.unreadCount).toBe(2))
    await act(async () => { await api.deleteNotif('n-1') })
    // Deux invocations de l'updater décrémentaient de 2 → 0 au lieu de 1.
    expect(api.unreadCount).toBe(1)
    expect(api.notifications.map(n => n.id)).toEqual(['n-2', 'n-3'])
  })

  it('supprimer une notification DÉJÀ LUE ne touche pas le compteur', async () => {
    monter()
    await waitFor(() => expect(api?.unreadCount).toBe(2))
    await act(async () => { await api.deleteNotif('n-3') })
    expect(api.unreadCount).toBe(2)
  })

  it('marquer comme lu décrémente de UN', async () => {
    monter()
    await waitFor(() => expect(api?.unreadCount).toBe(2))
    await act(async () => { await api.markRead('n-1') })
    expect(api.unreadCount).toBe(1)
  })

  it('un échec de suppression ne touche ni la liste ni le compteur', async () => {
    mockDelete.mockResolvedValue({ error: new Error('réseau') })
    monter()
    await waitFor(() => expect(api?.unreadCount).toBe(2))
    await act(async () => { await api.deleteNotif('n-1') })
    expect(api.unreadCount).toBe(2)
    expect(api.notifications).toHaveLength(3)
  })
})
