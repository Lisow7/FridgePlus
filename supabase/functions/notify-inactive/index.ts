// Edge Function — envoie l'email de relance « compte inactif » aux
// utilisateurs sans login depuis > 3 ans, et met à jour
// `profiles.inactive_warned_at` après envoi.
//
// Sprint 10 S10.c.10 — complète l'infrastructure RGPD Art. 5.1.e
// posée en S10.c.8 (migration `20260515_inactive_accounts_purge_v3_370_0.sql`).
// Flow : cette fonction → email Resend → `inactive_warned_at = now()`
// → 30 jours plus tard, cron `soft_delete_inactive_warned` soft-delete
// → 30 jours plus tard, cron `anonymize_soft_deleted_profiles` anonymise.
//
// Authentification (2 modes acceptés) :
//   1. Header `X-Cron-Secret: <NOTIFY_INACTIVE_CRON_SECRET>` (cron jobs,
//      partage un secret entre l'appelant et l'Edge Function)
//   2. Header `Authorization: Bearer <service_role JWT>` (déclenchement
//      manuel depuis Supabase Dashboard ou un script admin)
//
// Secrets requis (Supabase → Edge Functions → Secrets) :
//   • RESEND_API_KEY                  — clé d'API Resend
//   • NOTIFY_INACTIVE_CRON_SECRET     — secret partagé pour le mode cron
//   • APP_URL (optionnel)             — URL publique pour les liens
//
// Batch : max 50 emails par invocation pour éviter timeouts + rate limits
// Resend (10 req/s, 100 emails/min). Si la vue contient plus de rows,
// re-invoquer ; les rows déjà warned sont automatiquement filtrées par la
// vue (`WHERE inactive_warned_at IS NULL`).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { reponseErreur } from '../_shared/reponse-erreur.ts'
import { memeSecret } from '../_shared/secrets.ts'
import { sendEmail } from '../_shared/email.ts'

const BATCH_SIZE = 50

interface CandidateRow {
  id: string
  username: string | null
  language: string | null
  last_login_at: string
  email: string
}

const EMAIL_I18N = {
  fr: {
    subject: (username: string) => `${username}, tu nous manques sur Fridge+ 🥬`,
    greeting: (name: string) => `Bonjour ${name},`,
    intro: 'Cela fait plus de 3 ans que tu n\'as pas ouvert Fridge+. Conformément au RGPD (Article 5.1.e), nous ne conservons pas les données des comptes inactifs au-delà de cette durée.',
    actionTitle: 'Que va-t-il se passer ?',
    actionBody: 'Si tu ne te reconnectes pas dans les <strong>30 prochains jours</strong>, ton compte sera supprimé et tes données anonymisées 30 jours plus tard. Cette action est irréversible.',
    cta: 'Me reconnecter à Fridge+',
    keepIntro: 'Tu veux garder ton compte ?',
    keepBody: 'Il te suffit de te connecter une fois en cliquant sur le bouton ci-dessus. Le compteur d\'inactivité repart à zéro automatiquement.',
    eraseIntro: 'Tu veux supprimer ton compte maintenant ?',
    eraseBody: 'Connecte-toi puis va dans Profil → Sécurité & confidentialité → Zone de danger. Tu peux aussi nous écrire si tu préfères qu\'on s\'en charge.',
    footer: 'Tu reçois cet email parce que tu as créé un compte Fridge+ et que tu ne t\'es pas connecté(e) depuis plus de 3 ans. Si tu n\'as plus besoin de Fridge+, tu peux ignorer ce message — ton compte sera supprimé automatiquement.',
  },
  en: {
    subject: (username: string) => `${username}, we miss you on Fridge+ 🥬`,
    greeting: (name: string) => `Hi ${name},`,
    intro: 'It\'s been over 3 years since you opened Fridge+. Per GDPR (Article 5.1.e), we don\'t keep inactive account data past that period.',
    actionTitle: 'What\'s about to happen?',
    actionBody: 'If you don\'t log back in within the <strong>next 30 days</strong>, your account will be deleted and your data anonymized 30 days later. This action is irreversible.',
    cta: 'Log back into Fridge+',
    keepIntro: 'Want to keep your account?',
    keepBody: 'Just sign in once using the button above. The inactivity counter resets to zero automatically.',
    eraseIntro: 'Want to delete your account now?',
    eraseBody: 'Sign in, then go to Profile → Security & privacy → Danger zone. Or just reply to this email — we\'ll handle it for you.',
    footer: 'You\'re receiving this email because you created a Fridge+ account and haven\'t signed in for over 3 years. If you no longer need Fridge+, you can ignore this message — your account will be deleted automatically.',
  },
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHTML(opts: { username: string; appUrl: string; lang: keyof typeof EMAIL_I18N }): string {
  const t = EMAIL_I18N[opts.lang] ?? EMAIL_I18N.fr
  const link = opts.appUrl !== '#' ? opts.appUrl : '#'
  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head><meta charset="UTF-8"><title>${escapeHtml(t.subject(opts.username))}</title></head>
<body style="margin:0;padding:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1A0A;">
  <div style="max-width:560px;margin:24px auto;padding:32px 28px;background:#FFFFFF;border-radius:14px;border:1px solid #EDE4D4;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
    <div style="font-size:22px;font-weight:800;color:#C05010;margin-bottom:18px;">🥬 Fridge+</div>

    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${escapeHtml(t.greeting(opts.username))}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#5A4030;">${escapeHtml(t.intro)}</p>

    <div style="margin:0 0 10px;font-size:15px;font-weight:700;color:#2A1A0A;">${escapeHtml(t.actionTitle)}</div>
    <div style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#2A1A0A;padding:14px 16px;background:#FFF8F2;border-left:3px solid #E07820;border-radius:4px;">${t.actionBody}</div>

    <div style="text-align:center;margin:0 0 26px;">
      <a href="${link}" style="display:inline-block;padding:14px 28px;background-color:#D46A10;background-image:linear-gradient(135deg,#F7A85E 0%,#D46A10 100%);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">${escapeHtml(t.cta)}</a>
    </div>

    <div style="margin:0 0 10px;font-size:14px;font-weight:700;color:#2A1A0A;">${escapeHtml(t.keepIntro)}</div>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#5A4030;">${escapeHtml(t.keepBody)}</p>

    <div style="margin:0 0 10px;font-size:14px;font-weight:700;color:#2A1A0A;">${escapeHtml(t.eraseIntro)}</div>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#5A4030;">${escapeHtml(t.eraseBody)}</p>

    <hr style="border:none;border-top:1px solid #EDE4D4;margin:24px 0;">
    <p style="font-size:11px;color:#9A7A60;line-height:1.5;margin:0;text-align:center;">${escapeHtml(t.footer)}</p>
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

  // ── Auth : soit X-Cron-Secret, soit Authorization service_role ──────
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const cronSecretEnv = Deno.env.get('NOTIFY_INACTIVE_CRON_SECRET') ?? ''
  const isCronCall = !!cronSecretEnv && memeSecret(cronSecretHeader, cronSecretEnv)

  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isServiceRoleCall = !!serviceRoleKey && memeSecret(authHeader, `Bearer ${serviceRoleKey}`)

  if (!isCronCall && !isServiceRoleCall) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  // ── Setup Supabase admin client ──────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // ── Resend API key required ──────────────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: CORS })
  }

  // ── Fetch candidates from view ───────────────────────────────────────
  // La vue vit dans le schéma `private` (déplacée le 2026-05-17 pour ne
  // plus l'exposer via PostgREST — cf. migration
  // 20260517_db_refonte_s1_security_fix.sql) : PostgREST ne voit que le
  // schéma `public`, donc `.from('inactive_accounts_to_warn')` échouait
  // en 500 ("relation does not exist") depuis ce jour-là. On passe par
  // le wrapper RPC `get_inactive_accounts_to_warn()` (SECURITY DEFINER,
  // réservé à service_role — cf. migration
  // 20260712_fix_notify_inactive_view_access.sql).
  const { data: candidates, error: viewErr } = await supabaseAdmin
    .rpc('get_inactive_accounts_to_warn')
    .limit(BATCH_SIZE)
  if (viewErr) {
    return reponseErreur('View read failed', 500, CORS, viewErr, 'notify-inactive')
  }
  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ processed: 0, warned: 0, errors: 0, message: 'No inactive accounts to warn' }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // ── Send emails + update flag ────────────────────────────────────────
  const appUrl = Deno.env.get('APP_URL') ?? '#'
  let warned = 0
  let errors = 0
  const errorDetails: Array<{ id: string; reason: string }> = []

  for (const row of candidates as CandidateRow[]) {
    const username = row.username || row.email.split('@')[0]
    const lang = (['fr', 'en'].includes(row.language ?? '') ? row.language! : 'fr') as keyof typeof EMAIL_I18N
    const t = EMAIL_I18N[lang]

    try {
      const emailRes = await sendEmail(resendKey, {
        to: row.email,
        subject: t.subject(username),
        html: buildEmailHTML({ username, appUrl, lang }),
      }, 'notify-inactive')

      if (!emailRes.ok) {
        errors++
        console.error(`[notify-inactive] ${row.id}: Resend ${emailRes.status}: ${(emailRes.error ?? '').slice(0, 200)}`)
        errorDetails.push({ id: row.id, reason: `resend_${emailRes.status}` })
        continue
      }

      // Marque comme warned uniquement après succès de l'envoi
      const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update({ inactive_warned_at: new Date().toISOString() })
        .eq('id', row.id)
      if (updErr) {
        errors++
        console.error(`[notify-inactive] ${row.id}: update failed: ${updErr.message}`)
        errorDetails.push({ id: row.id, reason: 'update_failed' })
        continue
      }
      warned++
    } catch (e) {
      errors++
      console.error(`[notify-inactive] ${row.id}: exception: ${(e as Error).message}`)
      errorDetails.push({ id: row.id, reason: 'exception' })
    }
  }

  return new Response(JSON.stringify({
    processed: candidates.length,
    warned,
    errors,
    ...(errors > 0 ? { errorDetails } : {}),
    hasMore: candidates.length === BATCH_SIZE,
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
