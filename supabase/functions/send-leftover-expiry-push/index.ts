// supabase/functions/send-leftover-expiry-push/index.ts
//
// Edge Function cron — envoie un rappel (push natif + notification in-app)
// pour les restes (user_leftovers) qui arrivent à péremption dans les 48h.
// Appelée 1×/jour par pg_cron (voir migration
// 20260708_leftover_expiry_push_cron.sql), jamais depuis le navigateur —
// même double-mode d'auth que send-push-notification (X-Cron-Secret ou
// Authorization: Bearer <service_role>).
//
// Portée strictement limitée aux RESTES. Ne réactive PAS l'ancien mécanisme
// d'alerte ingrédient (notify_stock_expiry_run, désactivé volontairement le
// 2026-07-01 — cf. la conception « remove-ingredient-dlc » du 2026-07-01).
//
// Fenêtre de détection large (48h) plutôt qu'un calcul exact "J-1 minuit
// local" : profiles n'a aucune colonne de fuseau horaire. Cf. spec, section
// Architecture.
//
// Secrets requis (déjà posés en Phase 1, réutilisés tels quels) :
//   • VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
//   • SEND_PUSH_CRON_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import webpush from 'npm:web-push@3.6.7'
import { getCorsHeaders } from '../_shared/cors.ts'

const WINDOW_HOURS = 48

interface Leftover {
  id: string
  user_id: string
  name: string
  expires_at: string
}

interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

function notifTitle() {
  return { fr: '🍲 Un reste à cuisiner bientôt', en: '🍲 A leftover to use soon' }
}

function notifBody(name: string) {
  return {
    fr: `${name} arrive à péremption — pense à le cuisiner bientôt.`,
    en: `${name} is about to expire — think about using it soon.`,
  }
}

function pushText(lang: 'fr' | 'en', name: string) {
  return lang === 'en'
    ? { title: '🍲 A leftover to use soon', body: `${name} is about to expire — think about using it soon.` }
    : { title: '🍲 Un reste à cuisiner bientôt', body: `${name} arrive à péremption — pense à le cuisiner bientôt.` }
}

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
  }

  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const cronSecretEnv = Deno.env.get('SEND_PUSH_CRON_SECRET') ?? ''
  const isCronCall = !!cronSecretEnv && cronSecretHeader === cronSecretEnv

  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isServiceRoleCall = !!serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`

  if (!isCronCall && !isServiceRoleCall) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500, headers: CORS })
  }
  webpush.setVapidDetails('mailto:support@fridgeplus.app', vapidPublicKey, vapidPrivateKey)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const now = new Date()
  const windowEnd = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000)

  const { data: leftovers, error: leftoversErr } = await supabaseAdmin
    .from('user_leftovers')
    .select('id, user_id, name, expires_at')
    .is('deleted_at', null)
    .is('expiry_notified_at', null)
    .gte('expires_at', now.toISOString())
    .lte('expires_at', windowEnd.toISOString())
  if (leftoversErr) {
    return new Response(JSON.stringify({ error: 'Leftovers query failed', detail: leftoversErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
  if (!leftovers || leftovers.length === 0) {
    return new Response(JSON.stringify({ candidates: 0, notified: 0, push_sent: 0, push_errors: 0, message: 'No expiring leftovers' }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const userIds = [...new Set((leftovers as Leftover[]).map((l) => l.user_id))]
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from('profiles')
    .select('id, language')
    .in('id', userIds)
    .is('deleted_at', null)
    .eq('push_preferences->>stock_expiry', 'true')
  if (profilesErr) {
    return new Response(JSON.stringify({ error: 'Profiles query failed', detail: profilesErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const eligibleLanguageByUserId = new Map((profiles ?? []).map((p) => [p.id as string, p.language as string | null]))
  const candidates = (leftovers as Leftover[]).filter((l) => eligibleLanguageByUserId.has(l.user_id))

  if (candidates.length === 0) {
    return new Response(JSON.stringify({ candidates: 0, notified: 0, push_sent: 0, push_errors: 0, message: 'No eligible candidates' }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  let notified = 0
  let pushSent = 0
  let pushErrors = 0

  for (const leftover of candidates) {
    const lang = (eligibleLanguageByUserId.get(leftover.user_id) === 'en' ? 'en' : 'fr') as 'fr' | 'en'

    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
      recipient_id: leftover.user_id,
      recipient_role: 'user',
      type: 'leftover_expiring',
      title: notifTitle(),
      body: notifBody(leftover.name),
      link: '/',
    })
    if (notifErr) {
      // Le in-app a échoué : on NE marque PAS expiry_notified_at, pour
      // retenter au prochain passage du cron plutôt que de perdre le rappel.
      continue
    }
    notified++

    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', leftover.user_id)

    if (subs && subs.length > 0) {
      const { title, body } = pushText(lang, leftover.name)
      for (const sub of subs as Subscription[]) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
            JSON.stringify({ title, body, data: { url: '/' } }),
          )
          pushSent++
        } catch (sendErr) {
          const status = (sendErr as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            pushErrors++
          }
        }
      }
    }

    // Posé même si le push a échoué/aucun abonnement : le in-app est le
    // canal de vérité, cf. Global Constraints.
    await supabaseAdmin
      .from('user_leftovers')
      .update({ expiry_notified_at: new Date().toISOString() })
      .eq('id', leftover.id)
  }

  return new Response(JSON.stringify({
    candidates: candidates.length,
    notified,
    push_sent: pushSent,
    push_errors: pushErrors,
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
