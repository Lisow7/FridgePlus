import { createContext, useEffect, useState, useCallback, useMemo, useRef, useContext } from 'react'
import { supabase } from '@shared/lib/supabase/client'
import { useAuth } from '@shared/contexts/auth-provider'
import {
  getMyNotifications, countUnreadNotifications,
  markNotificationRead, markAllNotificationsRead,
  deleteNotification, deleteAllReadNotifications,
} from '@features/notifications/api/notifications'

// Context partagé pour les notifications utilisateur.
//
// Avant v3.22.0, ce module exposait un hook `useNotifications()` qui créait
// un state local à chaque appel. Conséquence : `NotificationsBell` et
// `NotificationsPanel` (rendu dans la cloche ouverte) avaient chacun leur
// propre `unreadCount` et leur propre liste. Un `markRead` déclenché depuis
// le Panel décrémentait SON compteur mais pas celui du Bell — l'user voyait
// le badge rester collé jusqu'à un F5.
//
// Cette version migre tout en Context : 1 seule source de vérité, 1 seule
// subscription realtime Supabase, état synchronisé partout.
//
// 2026-10-04 (audit UX-02) — les échecs ne se taisent plus :
//   - un chargement raté pose `loadError` au lieu d'afficher une liste vide
//     (« Aucune notification » était alors un mensonge), garde la liste déjà là,
//     et ne laisse plus `loading` bloqué quand l'appel lève ;
//   - chaque action rend `{ error }` : l'appelant peut dire « Pas enregistré ».

// Une action de l'API ; un appel qui lève (réseau coupé) rend une erreur comme
// les autres au lieu de remonter en exception non gérée.
async function tenter(action) {
  try {
    const { error } = await action()
    return { error: error ?? null }
  } catch (err) {
    return { error: err ?? new Error('unknown') }
  }
}

const NotificationsContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: false,
  loadError: false,
  refresh: () => {},
  markRead: () => {},
  markAllRead: () => {},
  deleteNotif: () => {},
  deleteAllRead: () => {},
})

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(false)
  const [loadError,     setLoadError]     = useState(false)
  const channelRef = useRef(null)
  // Miroir de `notifications`, synchronisé APRÈS commit (pas pendant le rendu).
  // Sert aux callbacks asynchrones qui ont besoin de la liste sans la prendre
  // en dépendance — voir `deleteNotif`.
  const notificationsRef = useRef(notifications)
  useEffect(() => { notificationsRef.current = notifications }, [notifications])

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      setUnreadCount(0)
      setLoadError(false)
      return
    }
    setLoading(true)
    try {
      const [{ data, error }, count] = await Promise.all([
        getMyNotifications({ page: 0 }),
        countUnreadNotifications(),
      ])
      // Chargement refusé : on garde ce qui est affiché, et on le dit.
      if (error) { setLoadError(true); return }
      setNotifications(data)
      setUnreadCount(count)
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Charge initial + à chaque changement d'utilisateur
  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime : subscribe aux INSERT de notifs adressées à ce user.
  // Quand un trigger insère une notif (ex: réponse admin sur ticket),
  // on reçoit l'event en push et on met à jour le compteur + la liste
  // sans recharger.
  useEffect(() => {
    if (!user?.id) return

    /* v3.17.2 — Suffix unique par mount pour éviter l'erreur StrictMode
       dev (double-mount) : « cannot add postgres_changes callbacks for
       realtime:notifications:UID after subscribe() ». Sans cet ID
       unique, le second mount React tente de souscrire au même channel
       déjà actif. */
    const channelId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase
      .channel(`notifications:${user.id}:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const fresh = payload.new
          if (!fresh) return
          setNotifications((prev) => [fresh, ...prev].slice(0, 30))
          setUnreadCount((c) => c + 1)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user?.id])

  const markRead = useCallback(async (id) => {
    const { error } = await tenter(() => markNotificationRead(id))
    if (!error) {
      setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    return { error }
  }, [])

  const markAllRead = useCallback(async () => {
    const { error } = await tenter(() => markAllNotificationsRead())
    if (!error) {
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map(n => n.read_at ? n : { ...n, read_at: now }))
      setUnreadCount(0)
    }
    return { error }
  }, [])

  const deleteNotif = useCallback(async (id) => {
    const { error } = await tenter(() => deleteNotification(id))
    if (error) return { error }
    // Le décrément était fait DANS l'updater de `setNotifications`. Un updater
    // doit être pur : React l'invoque deux fois en StrictMode, et `c - 1` n'est
    // PAS idempotent — le badge perdait DEUX non-lus par suppression (mesuré le
    // 2026-08-28). `markRead`, juste au-dessus, décrémentait déjà hors updater.
    //
    // On lit donc la notification supprimée depuis `notificationsRef`, que
    // l'effet ci-dessous synchronise après chaque commit. Pas d'écriture de ref
    // pendant le rendu : cet appel est asynchrone (il suit l'aller-retour
    // réseau), les effets ont donc déjà été purgés quand on la lit.
    const supprimee = notificationsRef.current.find(n => n.id === id)
    setNotifications((prev) => prev.filter(n => n.id !== id))
    if (supprimee && !supprimee.read_at) setUnreadCount((c) => Math.max(0, c - 1))
    return { error: null }
  }, [])

  const deleteAllRead = useCallback(async () => {
    const { error } = await tenter(() => deleteAllReadNotifications())
    if (!error) {
      setNotifications((prev) => prev.filter(n => !n.read_at))
    }
    return { error }
  }, [])

  // Mémoïsation du value Provider (cf. PR S3.b).
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    loadError,
    refresh,
    markRead,
    markAllRead,
    deleteNotif,
    deleteAllRead,
  }), [notifications, unreadCount, loading, loadError, refresh, markRead, markAllRead, deleteNotif, deleteAllRead])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
