// Edge Function : stripe-webhook
//
// Reçoit les events Stripe, vérifie la signature, met à jour profiles
// et insère dans subscription_events (audit trail RGPD).
//
// Variables d'environnement requises (Supabase Dashboard → Settings → Edge Functions) :
//   STRIPE_SECRET_KEY      — clé secrète Stripe (sk_live_… ou sk_test_…)
//   STRIPE_WEBHOOK_SECRET  — secret du webhook endpoint Stripe (whsec_…)
//   SUPABASE_URL           — injectée automatiquement par Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injectée automatiquement par Supabase
//
// Sécurité :
//   - Signature Stripe vérifiée avant tout traitement (rejet 400 si invalide)
//   - Service role key utilisée côté BDD → jamais exposée au client
//   - Idempotence via stripe_event_id UNIQUE dans subscription_events

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

// Mapping statuts Stripe → statuts internes
function mapStripeStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active:             'active',
    trialing:           'trialing',
    past_due:           'past_due',
    canceled:           'canceled',
    paused:             'paused',
    incomplete:         'past_due',
    incomplete_expired: 'canceled',
    unpaid:             'past_due',
  }
  return map[stripeStatus] ?? 'free'
}

serve(async (req) => {
  const signature    = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Missing Stripe-Signature header or webhook secret', { status: 400 })
  }

  const body = await req.text()

  // ── Vérification de signature (anti-replay, anti-forgery) ────────────────
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid Stripe signature', { status: 400 })
  }

  // ── Idempotence : ignorer les events déjà traités ────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existing) {
    return new Response(JSON.stringify({ received: true, idempotent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Traitement des events d'abonnement ───────────────────────────────────
  const HANDLED_EVENTS = new Set([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.trial_will_end',
  ])

  if (!HANDLED_EVENTS.has(event.type)) {
    // Event non géré → acknowledger sans erreur
    return new Response(JSON.stringify({ received: true, handled: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // v3.203.0 — Fix critique : `event.data.object` n'est PAS toujours une
  // Subscription. Pour les events `invoice.paid` / `invoice.payment_failed`,
  // c'est une Invoice (https://stripe.com/docs/api/invoices/object). Le cast
  // direct `as Stripe.Subscription` produisait silencieusement :
  //   - subscription_ends_at = null  (current_period_end absent sur Invoice)
  //   - trial_ends_at = null         (trial_end absent)
  //   - subscription_plan = 'monthly' (items.data[0].price.recurring.interval absent)
  // → écrasait `subscription_plan='annual'` à chaque paiement annuel renouvelé.
  //
  // Fix : si l'event est invoice.*, on récupère la vraie Subscription via
  // l'API Stripe avant d'extraire les champs subscription.*.
  let subscription: Stripe.Subscription
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id
    if (!subscriptionId) {
      // Invoice non liée à une subscription (paiement one-shot inattendu)
      // → ack sans mettre à jour le profil
      return new Response(JSON.stringify({ received: true, warning: 'invoice_without_subscription' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
  } else {
    subscription = event.data.object as Stripe.Subscription
  }

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  // Trouver l'utilisateur via stripe_customer_id
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (profileError || !profile) {
    console.error('No profile found for Stripe customer:', customerId)
    // Renvoyer 200 pour éviter que Stripe ne réessaie indéfiniment
    return new Response(JSON.stringify({ received: true, warning: 'profile_not_found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const previousStatus = profile.subscription_status
  let newStatus = previousStatus

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      newStatus = mapStripeStatus(subscription.status)
      break
    case 'customer.subscription.deleted':
      newStatus = 'canceled'
      break
    case 'invoice.paid':
      newStatus = 'active'
      break
    case 'invoice.payment_failed':
      newStatus = 'past_due'
      break
    // trial_will_end = informatif uniquement, pas de changement de statut
  }

  const subscriptionEndsAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval
  const plan = interval === 'year' ? 'annual' : 'monthly'

  // Mise à jour atomique du profil
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status:  newStatus,
      subscription_ends_at: subscriptionEndsAt,
      trial_ends_at:        trialEndsAt,
      subscription_plan:    plan,
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error('Failed to update profile subscription status:', updateError)
    return new Response('Database update failed', { status: 500 })
  }

  // Auto-révoquer le rôle spécial si l'user en avait un (il devient client payant)
  if (newStatus === 'active' || newStatus === 'trialing') {
    const { data: activeRole } = await supabaseAdmin
      .from('special_access')
      .select('id')
      .eq('user_id', profile.id)
      .is('revoked_at', null)
      .maybeSingle()

    if (activeRole) {
      await supabaseAdmin
        .from('special_access')
        .update({ revoked_at: new Date().toISOString(), revoked_by: null })
        .eq('user_id', profile.id)
        .is('revoked_at', null)

      await supabaseAdmin
        .from('profiles')
        .update({ special_role: null })
        .eq('id', profile.id)

      await supabaseAdmin
        .from('subscription_events')
        .insert({
          user_id:         profile.id,
          event_type:      'special_access_stripe_auto_revoked',
          previous_status: 'comped',
          new_status:      newStatus,
          granted_by:      null,
          raw_payload:     { source: 'stripe_webhook', timestamp: new Date().toISOString() },
        })
    }
  }

  // Audit trail (service role bypass RLS → INSERT toujours autorisé)
  await supabaseAdmin.from('subscription_events').insert({
    user_id:         profile.id,
    stripe_event_id: event.id,
    event_type:      event.type,
    previous_status: previousStatus,
    new_status:      newStatus,
    raw_payload:     event.data.object,
  })

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
