// Helpers Stripe côté client.
//
// Toutes les interactions avec l'API Stripe passent par des Edge Functions
// Supabase (jamais de clé secrète côté navigateur).
//
// Variables d'environnement requises dans .env.local :
//   VITE_STRIPE_PUBLISHABLE_KEY — pk_test_… ou pk_live_…
//
// Variables requises dans Supabase Dashboard → Settings → Edge Functions :
//   STRIPE_SECRET_KEY           — sk_test_… ou sk_live_…
//   STRIPE_PRICE_MONTHLY        — price_… (mensuel)
//   STRIPE_PRICE_ANNUAL         — price_… (annuel)
//   STRIPE_WEBHOOK_SECRET       — whsec_…

import { PREMIUM_ENABLED } from '@shared/lib/premium-config'

// Les seules adresses suivies (audit du 2026-10-04, SEC-12) : l'adresse rendue
// par nos fonctions edge n'est suivie que si c'est bien Stripe, en https —
// défense en profondeur, une réponse détournée n'envoie personne ailleurs.
const HOTE_PAIEMENT = 'checkout.stripe.com'
const HOTE_PORTAIL = 'billing.stripe.com'

/** L'adresse, si elle est en https sur l'hôte attendu ; sinon null. */
export function adresseStripeSure(url, hote) {
  let u
  try { u = new URL(url) } catch { return null }
  return u.protocol === 'https:' && u.hostname === hote && !u.username && !u.password ? u.href : null
}

/**
 * Crée une session Stripe Checkout et redirige l'utilisateur.
 * @param {'monthly'|'annual'} plan
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function redirectToCheckout(plan, supabase) {
  // Garde defense-in-depth : en mode Launch Free, aucun parcours d'achat ne
  // doit partir vers Stripe, même si une UI oubliait de masquer un bouton.
  if (!PREMIUM_ENABLED) throw new Error('premium_disabled')
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key) throw new Error('VITE_STRIPE_PUBLISHABLE_KEY manquant dans .env.local')

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { plan },
  })
  if (error) throw new Error(error.message ?? 'Erreur lors de la création de la session')
  if (!data?.url) throw new Error('URL de paiement manquante')
  const sure = adresseStripeSure(data.url, HOTE_PAIEMENT)
  if (!sure) throw new Error('redirection_refusee')

  window.location.href = sure
}

/**
 * Crée une session Stripe Customer Portal et redirige l'utilisateur.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function redirectToPortal(supabase) {
  if (!PREMIUM_ENABLED) throw new Error('premium_disabled')
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: {},
  })
  if (error) throw new Error(error.message ?? 'Erreur lors de l\'ouverture du portail')
  if (!data?.url) throw new Error('URL du portail manquante')
  const sure = adresseStripeSure(data.url, HOTE_PORTAIL)
  if (!sure) throw new Error('redirection_refusee')

  window.location.href = sure
}
