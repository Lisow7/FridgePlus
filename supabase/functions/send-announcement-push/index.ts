// supabase/functions/send-announcement-push/index.ts
//
// Edge Function — pousse une notification native pour les broadcasts admin
// (Annonce/Maintenance), en plus du canal in-app existant (RPC
// admin_send_notification). Appelée directement par le panel admin
// (JWT navigateur de l'admin connecté), PAS par un cron — contrairement à
// send-push-notification (secret cron / service_role).
//
// Vérification admin : lookup direct profiles.role (PAS d'appel à la RPC
// SQL is_admin(), qui dépend de auth.uid() — non fiable depuis une
// connexion service_role agissant pour le compte d'un autre utilisateur).
//
// Secrets requis (déjà posés en Phase 1, partagés entre Edge Functions) :
//   • VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import webpush from 'npm:web-push@3.6.7'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

interface Payload {
  type: 'announcement' | 'maintenance'
  title: { fr: string; en: string }
  body: { fr: string; en: string } | null
}

interface Candidate {
  id: string
  language: string | null
}

interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS })
  }

  const rateLimited = applyRateLimit(req, 'send-announcement-push', { max: 3, windowMs: 60_000 }, user.id, CORS)
  if (rateLimited) return rateLimited

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS })
  }

  if (payload.type !== 'announcement' && payload.type !== 'maintenance') {
    return new Response(JSON.stringify({ error: 'invalid_type' }), { status: 400, headers: CORS })
  }
  if (!payload.title?.fr) {
    return new Response(JSON.stringify({ error: 'title_required' }), { status: 400, headers: CORS })
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500, headers: CORS })
  }
  webpush.setVapidDetails('mailto:support@fridgeplus.app', vapidPublicKey, vapidPrivateKey)

  const { data: candidates, error: candidatesErr } = await supabaseAdmin
    .from('profiles')
    .select('id, language')
    .is('deleted_at', null)
    .eq('push_preferences->>announcements', 'true')
  if (candidatesErr) {
    return new Response(JSON.stringify({ error: 'Candidates query failed', detail: candidatesErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ processed: 0, sent: 0, errors: 0, message: 'No subscribed candidates' }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  let sent = 0
  let errors = 0
  const errorDetails: Array<{ id: string; reason: string }> = []

  for (const candidate of candidates as Candidate[]) {
    const lang = (candidate.language === 'en' ? 'en' : 'fr') as 'fr' | 'en'
    const title = payload.title[lang] || payload.title.fr
    const body = payload.body ? (payload.body[lang] || payload.body.fr) : ''

    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', candidate.id)
    if (subsErr || !subs || subs.length === 0) {
      continue
    }

    for (const sub of subs as Subscription[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify({ title, body, data: { url: '/' } }),
        )
        sent++
      } catch (sendErr) {
        const status = (sendErr as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          errors++
          errorDetails.push({ id: sub.id, reason: `${(sendErr as Error).name}: ${(sendErr as Error).message?.slice(0, 200)}` })
        }
      }
    }
  }

  return new Response(JSON.stringify({
    processed: candidates.length,
    sent,
    errors,
    ...(errors > 0 ? { errorDetails } : {}),
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
