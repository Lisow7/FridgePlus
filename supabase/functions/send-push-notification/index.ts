// Edge Function cron — envoie une notification push de relance aux
// utilisateurs inactifs depuis 7 jours (Phase 1 : un seul cas d'usage).
// Même charpente que notify-inactive : auth par X-Cron-Secret OU
// Authorization: Bearer <service_role>.
//
// Secrets requis (Supabase → Edge Functions → Secrets) :
//   • VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  — paire VAPID (cf. Step 1)
//   • SEND_PUSH_CRON_SECRET                 — secret partagé pour le mode cron
//
// Anti-répétition : pool de 5 variantes de message par langue, sélection
// round-robin via profiles.push_last_variant_index (incrémenté modulo 5
// à chaque candidat traité, indépendamment du succès d'envoi par device).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import webpush from 'npm:web-push@3.6.7'
import { getCorsHeaders } from '../_shared/cors.ts'

const INACTIVITY_THRESHOLD_DAYS = 7

const VARIANTS: Record<'fr' | 'en', string[]> = {
  fr: [
    '🥬 Ton frigo s\'ennuie un peu. Un ingrédient à ajouter ?',
    'On a gardé tes recettes préférées au chaud. Ça te dit d\'y jeter un œil ?',
    'Psst 👋 il te reste peut-être des idées de recettes à découvrir sur Fridge+.',
    'Ton frigo virtuel t\'attend toujours — 2 minutes suffisent pour le remplir.',
    'On ne t\'a pas vu depuis un moment. Une petite recette rapide ce soir ?',
  ],
  en: [
    '🥬 Your fridge is feeling a little empty. Add an ingredient?',
    'We kept your favorite recipes warm for you. Want to take a look?',
    'Psst 👋 you might have some recipe ideas waiting to be discovered on Fridge+.',
    'Your virtual fridge is still waiting — 2 minutes is all it takes to fill it up.',
    'We haven\'t seen you in a while. How about a quick recipe tonight?',
  ],
}

interface Candidate {
  id: string
  language: string | null
  push_last_variant_index: number | null
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

  const { data: candidates, error: candidatesErr } = await supabaseAdmin
    .from('profiles')
    .select('id, language, push_last_variant_index')
    .is('deleted_at', null)
    .lt('last_login_at', new Date(Date.now() - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString())
    .eq('push_preferences->>inactivity_reminder', 'true')
  if (candidatesErr) {
    return new Response(JSON.stringify({ error: 'Candidates query failed', detail: candidatesErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ processed: 0, sent: 0, errors: 0, message: 'No inactive candidates' }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  let sent = 0
  let errors = 0
  const errorDetails: Array<{ id: string; reason: string }> = []

  for (const candidate of candidates as Candidate[]) {
    const lang = (candidate.language === 'en' ? 'en' : 'fr') as 'fr' | 'en'
    const nextIndex = ((candidate.push_last_variant_index ?? -1) + 1) % VARIANTS[lang].length
    const body = VARIANTS[lang][nextIndex]

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
          JSON.stringify({ title: 'Fridge+', body }),
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

    await supabaseAdmin
      .from('profiles')
      .update({ push_last_variant_index: nextIndex })
      .eq('id', candidate.id)
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
