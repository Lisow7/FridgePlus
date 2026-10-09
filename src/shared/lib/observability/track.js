// Events produit (funnel d'activation). Jumeau du pattern sentry.js : gaté
// consentement « audience » (RGPD), no-op silencieux sinon, fire-and-forget
// (ne bloque jamais l'appelant, ne throw jamais). Écrit dans Supabase
// `product_events` (RLS insert-only). Lecture analytique en SQL/admin.
import { supabase } from '@shared/lib/supabase/client'
import { hasConsentedSync } from '@shared/hooks/use-consent'
import { getAnonId } from './anon-id'

export function track(event, props = {}) {
  if (!hasConsentedSync('audience')) return
  void emit(event, props)
}

// Comme track, mais une seule fois par session (impressions : ex. l'Aha qui
// se re-déclenche au render). Dédup via un flag sessionStorage.
export function trackOnce(sessionKey, event, props = {}) {
  if (!hasConsentedSync('audience')) return
  try {
    if (sessionStorage.getItem(sessionKey) === '1') return
    sessionStorage.setItem(sessionKey, '1')
  } catch { /* sessionStorage indispo → on émet quand même (au pire, non dédupliqué) */ }
  void emit(event, props)
}

async function emit(event, props) {
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data?.session?.user?.id ?? null
    const anonId = userId ? null : getAnonId()
    await supabase.from('product_events').insert({ event, props, user_id: userId, anon_id: anonId })
  } catch (e) {
    if (import.meta.env.DEV) console.error('[track]', event, e)
  }
}
