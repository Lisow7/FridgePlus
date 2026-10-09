import { supabase } from '@shared/lib/supabase/client'
import { logError } from '@shared/lib/observability/sentry'

// Convertit une clé VAPID base64url en Uint8Array (format attendu par
// PushManager.subscribe applicationServerKey).
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

// Demande la permission navigateur puis crée l'abonnement PushManager.
// Ne PAS appeler sans un geste utilisateur explicite préalable (carte de
// priming) — jamais au chargement de page.
export async function subscribeToPush() {
  if (typeof Notification === 'undefined' || !navigator.serviceWorker) {
    return { error: new Error('push_unsupported') }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { error: new Error('permission_denied') }

  // Certains navigateurs in-app (ex : navigateur intégré d'apps tierces sur
  // Android) accordent la permission JS mais échouent ensuite silencieusement
  // sur le service worker ou le push service (pas de compte FCM enregistré
  // dans ce contexte restreint). On catch tout ici pour ne jamais laisser
  // fuiter une exception non gérée jusqu'au toggle UI — voir logError ci-dessous
  // pour avoir la vraie cause en prod si ça se reproduit.
  try {
    // .trim() : une variable d'env collée à la main (Vercel) embarque facilement
    // un espace ou un retour à la ligne parasite, invisible dans l'UI mais fatal
    // pour atob() plus bas (InvalidCharacterError) — vu en prod le 2026-07-11.
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
    if (!vapidPublicKey) {
      const err = new Error('vapid_key_missing')
      logError(err, { tag: 'push.subscribe' })
      return { error: err }
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    const raw = subscription.toJSON()
    const { error: rpcError } = await supabase.rpc('subscribe_to_push', {
      p_endpoint: raw.endpoint,
      p_p256dh:   raw.keys.p256dh,
      p_auth_key: raw.keys.auth,
    })
    if (rpcError) return { error: rpcError }

    return await updatePushPreferences({ inactivity_reminder: true, announcements: true, stock_expiry: true })
  } catch (err) {
    logError(err, { tag: 'push.subscribe' })
    return { error: err }
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      await subscription.unsubscribe()
    }
    return await updatePushPreferences({ inactivity_reminder: false, announcements: false, stock_expiry: false })
  } catch (err) {
    logError(err, { tag: 'push.unsubscribe' })
    return { error: err }
  }
}

export async function getPushPreferences(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('push_preferences')
    .eq('id', userId)
    .single()
  if (error) return { data: null, error }
  return { data: data.push_preferences, error: null }
}

export async function updatePushPreferences(partial) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('not_authenticated') }

  const { data: current } = await getPushPreferences(user.id)
  const next = { ...(current ?? {}), ...partial }

  const { error } = await supabase
    .from('profiles')
    .update({ push_preferences: next })
    .eq('id', user.id)
  return { error }
}
