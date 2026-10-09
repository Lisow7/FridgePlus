// Edge Function — prévient par e-mail la personne qu'on vient de bannir
// (audit du 2026-10-04, lot 3c-3b ; choix d'Antoine sur la planche
// d'arbitrages, 2026-10-05 : « un e-mail au moment du bannissement »).
//
// Pourquoi : `admin_bannir` coupe la session et refuse la reconnexion. Une fois
// déconnectée, la personne ne voit plus que « Ce compte est suspendu » à la
// connexion — ni motif, ni date. Cet e-mail les lui donne, avec l'adresse du
// support et son droit à l'effacement.
//
// Appelée par le panneau admin APRÈS un `admin_bannir` réussi (best-effort :
// le bannissement tient même si l'e-mail ne part pas, et le panneau le dit).
//
// Sécurité :
//   • l'appelant doit être connecté ET admin (profiles.role = 'admin') ;
//   • le compte visé doit être banni (sinon : rien n'est envoyé) ;
//   • 10 appels / min / admin, et le plafond quotidien d'e-mails par compte
//     destinataire (`reserverUnEmail`, BDD-08).
//
// Secrets requis : RESEND_API_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { sendEmail } from '../_shared/email.ts'
import { reserverUnEmail } from '../_shared/email-quota.ts'

const SUPPORT = 'support@fridgeplus.app'

const EMAIL_I18N = {
  fr: {
    subject: 'Ton compte Fridge+ est suspendu',
    greeting: (name: string) => `Bonjour ${name},`,
    suspendu: (fin: string | null) => fin
      ? `Ton compte Fridge+ est suspendu jusqu’au ${fin}. D’ici là, tu ne peux plus te connecter.`
      : 'Ton compte Fridge+ est suspendu, sans date de fin. Tu ne peux plus te connecter.',
    motif: 'Motif',
    erreur: `Si tu penses que c’est une erreur, écris à ${SUPPORT}.`,
    rgpd: `Tu gardes le droit de faire supprimer ton compte et tes données (RGPD, article 17) : écris à ${SUPPORT} depuis l’adresse qui reçoit cet e-mail. Seule une empreinte de ton adresse e-mail, qui ne permet pas de la retrouver, serait gardée jusqu’à la fin de la suspension (3 ans au plus), pour empêcher une réinscription.`,
    footer: 'Tu reçois cet e-mail parce que ton compte Fridge+ vient d’être suspendu.',
    locale: 'fr-FR',
  },
  en: {
    subject: 'Your Fridge+ account is suspended',
    greeting: (name: string) => `Hi ${name},`,
    suspendu: (fin: string | null) => fin
      ? `Your Fridge+ account is suspended until ${fin}. Until then, you cannot sign in.`
      : 'Your Fridge+ account is suspended, with no end date. You cannot sign in.',
    motif: 'Reason',
    erreur: `If you think this is a mistake, write to ${SUPPORT}.`,
    rgpd: `You keep the right to have your account and your data deleted (GDPR, Article 17): write to ${SUPPORT} from the address that receives this email. Only a fingerprint of your e-mail address, from which it cannot be recovered, would be kept until the suspension ends (3 years at most), to prevent signing up again.`,
    footer: 'You are receiving this email because your Fridge+ account has just been suspended.',
    locale: 'en-GB',
  },
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildEmailHTML(o: { username: string, fin: string | null, motif: string | null, lang: 'fr' | 'en' }): string {
  const t = EMAIL_I18N[o.lang]
  return `<!DOCTYPE html>
<html lang="${o.lang}">
<head><meta charset="UTF-8"><title>${escapeHtml(t.subject)}</title></head>
<body style="margin:0;padding:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1A0A;">
  <div style="max-width:560px;margin:24px auto;padding:32px 28px;background:#FFFFFF;border-radius:14px;border:1px solid #EDE4D4;">
    <div style="font-size:22px;font-weight:800;color:#B4520E;margin-bottom:18px;">Fridge+</div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${escapeHtml(t.greeting(o.username))}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">${escapeHtml(t.suspendu(o.fin))}</p>
    ${o.motif ? `<div style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#7A5A40;">${escapeHtml(t.motif)}</div>
    <div style="margin:0 0 18px;font-size:15px;padding:10px 14px;background:#FFF8F2;border-left:3px solid #B4520E;border-radius:4px;">${escapeHtml(o.motif)}</div>` : ''}
    <p style="font-size:14px;line-height:1.6;margin:0 0 14px;color:#5A4030;">${escapeHtml(t.erreur)}</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#1D4FA0;padding:12px 14px;background:#EAF2FF;border-radius:10px;">${escapeHtml(t.rgpd)}</p>
    <hr style="border:none;border-top:1px solid #EDE4D4;margin:20px 0;">
    <p style="font-size:11px;color:#7A5A40;line-height:1.5;margin:0;text-align:center;">${escapeHtml(t.footer)}</p>
  </div>
</body>
</html>`
}

const reponse = (corps: unknown, status: number, CORS: Record<string, string>) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reponse({ error: 'method_not_allowed' }, 405, CORS)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return reponse({ error: 'unauthorized' }, 401, CORS)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!caller) return reponse({ error: 'unauthorized' }, 401, CORS)

  const rateLimited = applyRateLimit(req, 'notifier-bannissement', { max: 10, windowMs: 60_000 }, caller.id, CORS)
  if (rateLimited) return rateLimited

  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') return reponse({ error: 'forbidden' }, 403, CORS)

  let userId = ''
  try { userId = String((await req.json())?.userId ?? '') } catch { /* corps illisible */ }
  if (!userId) return reponse({ error: 'missing_user_id' }, 400, CORS)

  const { data: cible } = await supabaseAdmin
    .from('profiles')
    .select('username, banned, banned_reason, banned_until, language')
    .eq('id', userId)
    .maybeSingle()
  if (!cible) return reponse({ error: 'user_not_found' }, 404, CORS)
  // Rien à dire d'un compte qui n'est pas (ou plus) banni.
  if (!cible.banned) return reponse({ error: 'not_banned' }, 409, CORS)

  const { data: { user: destinataire } } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (!destinataire?.email) return reponse({ error: 'no_email' }, 404, CORS)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return reponse({ error: 'email_not_configured' }, 500, CORS)

  const reservation = await reserverUnEmail(supabaseAdmin, userId, 'account_banned')
  if (reservation !== 'ok') return reponse({ error: reservation === 'plafond' ? 'quota' : 'quota_error' }, 429, CORS)

  const lang = cible.language === 'en' ? 'en' : 'fr'
  const t = EMAIL_I18N[lang]
  const fin = cible.banned_until
    ? new Date(cible.banned_until).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
    : null

  const envoi = await sendEmail(resendKey, {
    to: destinataire.email,
    subject: t.subject,
    html: buildEmailHTML({ username: cible.username ?? destinataire.email.split('@')[0], fin, motif: cible.banned_reason ?? null, lang }),
  }, 'notifier-bannissement')
  if (!envoi.ok) return reponse({ error: 'send_failed' }, 502, CORS)

  return reponse({ sent: true }, 200, CORS)
})
