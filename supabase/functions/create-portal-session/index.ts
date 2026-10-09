// Edge Function : create-portal-session
//
// Crée une session Stripe Customer Portal pour gérer l'abonnement
// (annulation, mise à jour CB, téléchargement factures).
//
// Variables d'environnement requises :
//   STRIPE_SECRET_KEY     — sk_test_… ou sk_live_…
//   SUPABASE_URL          — injectée automatiquement
//   SUPABASE_SERVICE_ROLE_KEY — injectée automatiquement

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import Stripe from 'https://esm.sh/stripe@14.25.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

serve(async (req) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // ── Kill-switch Launch Free (defense-in-depth serveur) ───────────────────
  // Miroir SERVEUR du flag client VITE_PREMIUM_ENABLED (Vercel). Secret Edge
  // Supabase SÉPARÉ : PREMIUM_ENABLED. Fail-closed : absence = refus. Placé
  // AVANT l'auth pour être curl-testable (403 sans JWT). ⚠️ Relaunch premium =
  // PREMIUM_ENABLED='true' ICI **et** VITE_PREMIUM_ENABLED='true' (Vercel).
  if (Deno.env.get('PREMIUM_ENABLED') !== 'true') {
    return new Response(JSON.stringify({ error: 'premium_disabled' }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  // S10.d.4 — rate-limit : empêche le spam de créations de sessions Stripe
  // (chaque session coûte un appel API Stripe ; un user malveillant pourrait
  // saturer la quota API en boucle).
  const rateLimited = applyRateLimit(req, 'create-portal-session', { max: 10, windowMs: 60_000 }, user.id, CORS)
  if (rateLimited) return rateLimited

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'no_customer' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const origin = req.headers.get('origin') ?? 'https://fridge-plus.com'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   profile.stripe_customer_id,
    return_url: origin,
  })

  return new Response(JSON.stringify({ url: portalSession.url }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
