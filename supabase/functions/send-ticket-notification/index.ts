// Edge Function — envoie un email de notification au user quand l'admin
// répond à un de ses tickets de support.
//
// Appelée depuis adminReplyTicket (côté client) après l'INSERT du message
// admin et la mise à jour du ticket. Non bloquant : si l'envoi échoue,
// l'app continue de fonctionner (notif in-app reste affichée).
//
// Sécurité :
//   • Vérifie que l'appelant est connecté ET admin (profiles.role = 'admin')
//   • Service role utilisé pour récupérer l'email du user destinataire
//
// Secrets requis (à définir dans Supabase → Edge Functions → Secrets) :
//   • RESEND_API_KEY  — clé d'API Resend (obligatoire)
//   • APP_URL         — URL publique de l'app, pour le lien dans l'email
//                       (optionnel ; fallback : '#' = pas de lien cliquable)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { sendEmail } from '../_shared/email.ts'

interface Payload {
  ticketId: string
  messageContent: string
  lang?: 'fr' | 'en' | 'es' | 'de' | 'ja'
}

// Templates d'email localisés. Le contenu du message est inséré tel quel
// (échappé HTML) dans le bloc principal.
const EMAIL_I18N = {
  fr: {
    subject: (title: string) => `Réponse à ton ticket : ${title}`,
    greeting: (name: string) => `Bonjour ${name},`,
    intro: 'Tu as reçu une nouvelle réponse de l\'équipe Fridge+ sur ton ticket de support.',
    ticketLabel: 'Ticket',
    msgLabel: 'Message de l\'équipe',
    cta: 'Voir le ticket dans Fridge+',
    footer: 'Tu reçois cet email car tu as ouvert un ticket de support sur Fridge+.',
  },
  en: {
    subject: (title: string) => `Reply to your ticket: ${title}`,
    greeting: (name: string) => `Hi ${name},`,
    intro: 'You\'ve got a new reply from the Fridge+ team on your support ticket.',
    ticketLabel: 'Ticket',
    msgLabel: 'Team message',
    cta: 'Open ticket in Fridge+',
    footer: 'You\'re receiving this email because you opened a support ticket on Fridge+.',
  },
  es: {
    subject: (title: string) => `Respuesta a tu ticket: ${title}`,
    greeting: (name: string) => `Hola ${name},`,
    intro: 'Has recibido una nueva respuesta del equipo de Fridge+ sobre tu ticket de soporte.',
    ticketLabel: 'Ticket',
    msgLabel: 'Mensaje del equipo',
    cta: 'Ver ticket en Fridge+',
    footer: 'Recibes este correo porque abriste un ticket de soporte en Fridge+.',
  },
  de: {
    subject: (title: string) => `Antwort auf dein Ticket: ${title}`,
    greeting: (name: string) => `Hallo ${name},`,
    intro: 'Du hast eine neue Antwort vom Fridge+-Team auf dein Support-Ticket erhalten.',
    ticketLabel: 'Ticket',
    msgLabel: 'Nachricht vom Team',
    cta: 'Ticket in Fridge+ öffnen',
    footer: 'Du erhältst diese E-Mail, weil du ein Support-Ticket bei Fridge+ erstellt hast.',
  },
  ja: {
    subject: (title: string) => `チケットへの返信: ${title}`,
    greeting: (name: string) => `${name} 様、`,
    intro: 'Fridge+ サポートチームから、あなたのサポートチケットに新しい返信が届きました。',
    ticketLabel: 'チケット',
    msgLabel: 'チームからのメッセージ',
    cta: 'Fridge+ でチケットを開く',
    footer: 'このメールは、Fridge+ でサポートチケットを開いたために送信されています。',
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

function buildEmailHTML(opts: {
  username: string
  ticketTitle: string
  ticketId: string
  messageContent: string
  appUrl: string
  lang: keyof typeof EMAIL_I18N
}): string {
  const t = EMAIL_I18N[opts.lang] ?? EMAIL_I18N.fr
  const link = opts.appUrl !== '#' ? `${opts.appUrl}/?support=1&ticket=${encodeURIComponent(opts.ticketId)}` : '#'
  const safeMessage = escapeHtml(opts.messageContent).replace(/\n/g, '<br/>')
  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(t.subject(opts.ticketTitle))}</title>
</head>
<body style="margin:0;padding:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1A0A;">
  <div style="max-width:560px;margin:24px auto;padding:32px 28px;background:#FFFFFF;border-radius:14px;border:1px solid #EDE4D4;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
    <div style="font-size:22px;font-weight:800;color:#C05010;margin-bottom:18px;">🥬 Fridge+</div>

    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${escapeHtml(t.greeting(opts.username))}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#5A4030;">${escapeHtml(t.intro)}</p>

    <div style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9A7A60;">${escapeHtml(t.ticketLabel)}</div>
    <div style="margin:0 0 22px;font-size:16px;font-weight:700;color:#2A1A0A;padding:10px 14px;background:#FFF8F2;border-left:3px solid #E07820;border-radius:4px;">${escapeHtml(opts.ticketTitle)}</div>

    <div style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9A7A60;">${escapeHtml(t.msgLabel)}</div>
    <div style="margin:0 0 26px;font-size:14px;line-height:1.6;color:#2A1A0A;padding:14px 16px;background:#F5EDE0;border-radius:10px;white-space:pre-wrap;">${safeMessage}</div>

    <div style="text-align:center;margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;padding:12px 26px;background-color:#D46A10;background-image:linear-gradient(135deg,#F7A85E 0%,#D46A10 100%);color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${escapeHtml(t.cta)}</a>
    </div>

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

  // ── Auth caller : doit être un admin connecté ────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })
  }

  // v3.206.0 — Rate limit anti-spam Resend : 10 emails / min / admin.
  // Resend facture par email, et un admin compromis pourrait spammer
  // les utilisateurs. 10/min couvre le cas légitime (admin traite une
  // dizaine de tickets) mais bloque les bots.
  const rateLimited = applyRateLimit(req, 'send-ticket-notification', { max: 10, windowMs: 60_000 }, caller.id, CORS)
  if (rateLimited) return rateLimited

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), { status: 403, headers: CORS })
  }

  // ── Parse body ───────────────────────────────────────────────────────
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS })
  }
  const { ticketId, messageContent, lang } = payload
  if (!ticketId || !messageContent) {
    return new Response(JSON.stringify({ error: 'Missing ticketId or messageContent' }), { status: 400, headers: CORS })
  }

  // ── Récupère le ticket (titre + user_id du destinataire) ─────────────
  const { data: ticket, error: ticketErr } = await supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, title')
    .eq('id', ticketId)
    .single()
  if (ticketErr || !ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404, headers: CORS })
  }

  // ── Récupère l'email + username du user destinataire ─────────────────
  const { data: { user: recipientUser }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(ticket.user_id)
  if (userErr || !recipientUser?.email) {
    return new Response(JSON.stringify({ error: 'Recipient email not found' }), { status: 404, headers: CORS })
  }
  const { data: recipientProfile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', ticket.user_id)
    .single()
  const username = recipientProfile?.username ?? recipientUser.email.split('@')[0]

  // ── Envoi via Resend ────────────────────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: CORS })
  }

  const appUrl = Deno.env.get('APP_URL') ?? '#'
  const safeLang = (['fr', 'en', 'es', 'de', 'ja'].includes(lang ?? '') ? lang! : 'fr') as keyof typeof EMAIL_I18N
  const t = EMAIL_I18N[safeLang]

  const emailRes = await sendEmail(resendKey, {
    to: recipientUser.email,
    subject: t.subject(ticket.title),
    html: buildEmailHTML({
      username,
      ticketTitle: ticket.title,
      ticketId: ticket.id,
      messageContent,
      appUrl,
      lang: safeLang,
    }),
  }, 'send-ticket-notification')

  if (!emailRes.ok) {
    return new Response(JSON.stringify({ error: 'Resend API error', detail: emailRes.error }), {
      status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  return new Response(JSON.stringify({ success: true, emailId: emailRes.id }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
})
