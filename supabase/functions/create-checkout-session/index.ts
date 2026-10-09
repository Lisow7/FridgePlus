// Edge Function : create-checkout-session
//
// Crée une session Stripe Checkout pour un abonnement mensuel ou annuel.
// L'utilisateur est identifié via son JWT Supabase.
//
// Variables d'environnement requises (Supabase Dashboard → Settings → Edge Functions) :
//   STRIPE_SECRET_KEY     — sk_test_… ou sk_live_…
//   STRIPE_PRICE_MONTHLY  — price_… (plan mensuel)
//   STRIPE_PRICE_ANNUAL   — price_… (plan annuel)
//   SUPABASE_URL          — injectée automatiquement
//   SUPABASE_SERVICE_ROLE_KEY — injectée automatiquement

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import Stripe from 'https://esm.sh/stripe@14.25.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

serve(async (req) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // ── Kill-switch Launch Free (defense-in-depth serveur) ───────────────────
  // Miroir SERVEUR du flag client VITE_PREMIUM_ENABLED (qui, lui, vit dans
  // Vercel, build-time). Ici c'est un secret Edge Supabase SÉPARÉ :
  // PREMIUM_ENABLED. Fail-closed : absence de la var = refus. En mode Launch
  // Free, aucun parcours d'achat ne doit partir même si un user connecté
  // invoque l'endpoint directement (le garde client ne suffit pas — l'Edge
  // Function est exposée). Placé AVANT l'auth pour être curl-testable (403
  // sans JWT). ⚠️ Relaunch premium = poser PREMIUM_ENABLED='true' ICI **et**
  // VITE_PREMIUM_ENABLED='true' côté Vercel (deux flags distincts).
  if (Deno.env.get('PREMIUM_ENABLED') !== 'true') {
    return new Response(JSON.stringify({ error: 'premium_disabled' }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── Auth : extraire l'utilisateur depuis le JWT ──────────────────────────
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

  // v3.206.0 — Rate limit anti-spam Stripe sessions : 10 req / min / user.
  // Une checkout session crée un objet Stripe (compteur côté Stripe), spam
  // possible sinon. 10/min laisse de la marge pour un user qui hésite mais
  // bloque les bots.
  const rateLimited = applyRateLimit(req, 'create-checkout-session', { max: 10, windowMs: 60_000 }, user.id, CORS)
  if (rateLimited) return rateLimited

  // ── Récupérer le profil (stripe_customer_id + email) ────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', user.id)
    .single()

  // Bloquer si déjà actif (sécurité — ne pas créer une 2ème session)
  if (profile?.subscription_status === 'active') {
    return new Response(JSON.stringify({ error: 'already_subscribed' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── Plan ────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const plan: 'monthly' | 'annual' = body.plan === 'annual' ? 'annual' : 'monthly'

  const priceId = plan === 'annual'
    ? Deno.env.get('STRIPE_PRICE_ANNUAL')
    : Deno.env.get('STRIPE_PRICE_MONTHLY')

  if (!priceId) {
    return new Response('Price ID non configuré', { status: 500, headers: CORS })
  }

  // ── Créer ou récupérer le customer Stripe ───────────────────────────────
  let customerId = profile?.stripe_customer_id ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // ── URL de base de l'app ─────────────────────────────────────────────────
  const origin = req.headers.get('origin') ?? 'https://fridge-plus.com'

  // ── Créer la Checkout Session ────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { supabase_user_id: user.id, plan },
    },
    // Les cases CGV sont affichées dans l'app avant la redirection Stripe.
    // Stripe Checkout affiche en plus les CGV Stripe.
    success_url: `${origin}?subscription=activated`,
    cancel_url:  `${origin}?modal=upgrade`,
    customer_update: { address: 'auto' },
    // Pré-remplir l'email
    customer_email: customerId ? undefined : user.email,
    metadata: { supabase_user_id: user.id, plan },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
