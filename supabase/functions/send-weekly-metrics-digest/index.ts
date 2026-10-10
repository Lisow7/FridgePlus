// Digest métriques hebdomadaire par email — remplace le trigger verbal
// "check beta" manuel. Lit public.get_weekly_metrics_digest() (RPC
// SECURITY DEFINER, service_role uniquement) et envoie un résumé via
// Resend. Cf. spec 2026-07-12-beta-longue-sans-entite-design.md.
//
// Authentification (2 modes acceptés, même pattern que notify-inactive) :
//   1. Header `X-Cron-Secret: <SEND_PUSH_CRON_SECRET>` (cron — réutilise
//      le secret déjà créé pour les crons push, même profil de confiance)
//   2. Header `Authorization: Bearer <service_role JWT>` (déclenchement manuel)
//
// Secrets requis (Supabase → Edge Functions → Secrets) :
//   • RESEND_API_KEY                  — déjà configuré (autres fonctions)
//   • SEND_PUSH_CRON_SECRET           — déjà configuré (crons push)
//   • WEEKLY_DIGEST_RECIPIENT_EMAIL   — NOUVEAU, à créer (adresse de l'éditeur)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { reponseErreur } from '../_shared/reponse-erreur.ts'
import { memeSecret } from '../_shared/secrets.ts'
import { sendEmail } from '../_shared/email.ts'

interface DigestRow {
  signups_last_7d: number
  activated_pct: number
  favorited_pct: number
  cooked_pct: number
  retention_cohort_size: number
  retention_j7_pct: number
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHTML(d: DigestRow, weekOf: string): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#5A4030;border-bottom:1px solid #EDE4D4;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:700;color:#2A1A0A;border-bottom:1px solid #EDE4D4;text-align:right;">${escapeHtml(value)}</td>
    </tr>`
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Digest métriques Fridge+ — ${escapeHtml(weekOf)}</title></head>
<body style="margin:0;padding:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1A0A;">
  <div style="max-width:560px;margin:24px auto;padding:32px 28px;background:#FFFFFF;border-radius:14px;border:1px solid #EDE4D4;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
    <div style="font-size:22px;font-weight:800;color:#C05010;margin-bottom:4px;">🥬 Fridge+ — Digest hebdo</div>
    <p style="font-size:13px;color:#9A7A60;margin:0 0 20px;">Semaine du ${escapeHtml(weekOf)}</p>
    <table style="width:100%;border-collapse:collapse;">
      ${row('Nouvelles inscriptions (7j)', String(d.signups_last_7d))}
      ${row('Activation (a ajouté un ingrédient)', `${d.activated_pct}%`)}
      ${row('Favori ajouté', `${d.favorited_pct}%`)}
      ${row('Recette cuisinée', `${d.cooked_pct}%`)}
      ${row('Cohorte rétention (inscrits 7-14j)', String(d.retention_cohort_size))}
      ${row('Rétention J7', `${d.retention_j7_pct}%`)}
    </table>
    <p style="font-size:11px;color:#9A7A60;line-height:1.5;margin:20px 0 0;">Taux d'erreurs / crash-free : voir Sentry (alertes déjà configurées séparément).</p>
  </div>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })
  }

  // ── Auth : soit X-Cron-Secret (réutilise le secret des crons push), soit Authorization service_role ──
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const cronSecretEnv = Deno.env.get('SEND_PUSH_CRON_SECRET') ?? ''
  const isCronCall = !!cronSecretEnv && memeSecret(cronSecretHeader, cronSecretEnv)

  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isServiceRoleCall = !!serviceRoleKey && memeSecret(authHeader, `Bearer ${serviceRoleKey}`)

  if (!isCronCall && !isServiceRoleCall) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: CORS })
  }
  const recipient = Deno.env.get('WEEKLY_DIGEST_RECIPIENT_EMAIL')
  if (!recipient) {
    return new Response(JSON.stringify({ error: 'WEEKLY_DIGEST_RECIPIENT_EMAIL not configured' }), { status: 500, headers: CORS })
  }

  const { data, error: rpcErr } = await supabaseAdmin.rpc('get_weekly_metrics_digest').single()
  if (rpcErr || !data) {
    return reponseErreur('RPC failed', 500, CORS, rpcErr ?? 'no data', 'send-weekly-metrics-digest')
  }

  const weekOf = new Date().toISOString().slice(0, 10)
  const emailRes = await sendEmail(resendKey, {
    to: recipient,
    subject: `Digest Fridge+ — semaine du ${weekOf}`,
    html: buildEmailHTML(data as DigestRow, weekOf),
  }, 'send-weekly-metrics-digest')

  if (!emailRes.ok) return reponseErreur('Resend failed', 502, CORS, emailRes.error, 'send-weekly-metrics-digest')

  return new Response(JSON.stringify({ sent: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
