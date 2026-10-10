/**
 * Vercel Cron — relance comptes inactifs (Sprint 10 S10.c.11).
 *
 * Architecture : Vercel cron quotidien → cette route → Edge Function
 * Supabase `notify-inactive` → emails Resend.
 *
 * Flow RGPD (Art. 5.1.e) :
 *   3 ans sans login → email relance + `inactive_warned_at = now()`
 *   30 jours après warn → soft-delete (cron Supabase `soft_delete_inactive_warned`)
 *   30 jours après soft-delete → anonymisation (cron Supabase `anonymize_soft_deleted_profiles`)
 *
 * Sécurité (defense in depth) :
 *   - Auth 1 : Vercel cron injecte `Authorization: Bearer ${CRON_SECRET}` côté Vercel
 *   - Auth 2 : cette route ajoute `X-Cron-Secret: ${NOTIFY_INACTIVE_CRON_SECRET}` côté Supabase
 *
 * Ce qui sort de la route (audit du 2026-10-04, SEC-05 (3)) : des COMPTES et des
 * motifs agrégés (`raisons: { resend_429: 2 }`), jamais le détail par compte
 * ni le corps brut de la fonction edge — elle journalise déjà ces détails côté
 * Supabase. Avant, les identifiants des comptes en échec partaient dans la
 * réponse et dans les journaux Vercel.
 *
 * Config : vercel.json → crons → schedule = "0 7 * * *" (08:00 Paris hiver, 09:00 été)
 *
 * Pourquoi 07:00 UTC et pas 06:00 (comme quality-check) ? On dé-corrèle pour
 * éviter les pics de QPS sur Supabase. Et 07:00 UTC tombe en heures
 * raisonnables pour la réception des emails par les destinataires européens.
 */

import { secretAccepte } from '../_lib/secret-de-cron.js'

export default async function handler(req, res) {
  // ─── Auth 1 : Vercel cron secret (exigé, temps constant) ─────────────
  if (!secretAccepte(req.headers['authorization'], process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ─── Vérifie les env vars nécessaires ────────────────────────────────
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const cronSecret  = process.env.NOTIFY_INACTIVE_CRON_SECRET
  if (!supabaseUrl) {
    console.error('[notify-inactive cron] VITE_SUPABASE_URL not configured')
    return res.status(500).json({ error: 'config_missing' })
  }
  if (!cronSecret) {
    console.error('[notify-inactive cron] NOTIFY_INACTIVE_CRON_SECRET not configured')
    return res.status(500).json({ error: 'config_missing' })
  }

  // ─── Appel batch à l'Edge Function (jusqu'à hasMore=false) ───────────
  // L'Edge Function traite max 50 candidats par appel. Si plus de rows,
  // elle renvoie `hasMore=true` et on re-tire. Limite défensive 10 itérations
  // (= 500 emails/run max) pour éviter une boucle infinie en cas de bug.
  const fnUrl = `${supabaseUrl}/functions/v1/notify-inactive`
  const aggregate = { processed: 0, warned: 0, errors: 0, iterations: 0, raisons: {} }

  for (let i = 0; i < 10; i++) {
    aggregate.iterations++
    let result
    try {
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': cronSecret,
        },
        body: '{}',
      })
      result = await fnRes.json().catch(() => ({}))
      if (!fnRes.ok) {
        console.error('[notify-inactive cron] Edge Function returned', fnRes.status)
        return res.status(502).json({ error: 'edge_function_failed', status: fnRes.status })
      }
    } catch (e) {
      console.error('[notify-inactive cron] fetch threw:', e.message)
      return res.status(502).json({ error: 'fetch_failed' })
    }

    aggregate.processed += result.processed ?? 0
    aggregate.warned    += result.warned ?? 0
    aggregate.errors    += result.errors ?? 0
    // Le motif de chaque échec est compté ; l'identifiant du compte reste
    // dans les journaux de la fonction edge.
    for (const detail of Array.isArray(result.errorDetails) ? result.errorDetails : []) {
      const raison = String(detail?.reason ?? 'inconnue').slice(0, 40)
      aggregate.raisons[raison] = (aggregate.raisons[raison] ?? 0) + 1
    }
    if (!result.hasMore) break
  }

  // Log final pour suivi via Vercel logs
  if (aggregate.warned > 0) {
    console.log('[notify-inactive cron] ✅', JSON.stringify(aggregate))
  } else if (aggregate.errors > 0) {
    console.warn('[notify-inactive cron] ⚠️  errors detected', JSON.stringify(aggregate))
  } else {
    console.log('[notify-inactive cron] no candidates today')
  }

  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...aggregate,
  })
}
