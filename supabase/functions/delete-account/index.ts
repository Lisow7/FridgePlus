// Edge Function — soft-delete d'un compte utilisateur (rétention 30 jours).
//
// Comportement :
//   1. Vérifie le user authentifié via le bearer token
//   2. Marque profiles.deleted_at = now() et génère un restore_token UUID
//   3. Sign out toutes les sessions du user (auth.admin.signOut)
//   4. Envoie un email de confirmation avec :
//      • Le récap des données conservées 30 jours
//      • Un lien de restauration pointant vers /?restore-account=TOKEN
//
// Au-delà de 30 jours, le compte est purgé définitivement par la fonction
// CRON `purge-soft-deleted-accounts`. Avant ce délai, le user peut annuler
// la suppression :
//   • Soit en se reconnectant (l'app détecte deleted_at et restaure auto)
//   • Soit via le lien email
//
// Note : le compte reste dans auth.users pendant les 30 jours. L'email
// associé est donc bloqué pour de nouvelles inscriptions tant que le
// soft-delete n'est pas purgé.
//
// Secrets requis : RESEND_API_KEY (Resend), APP_URL (URL publique de l'app).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { sendEmail } from '../_shared/email.ts'
import { reserverUnEmail } from '../_shared/email-quota.ts'

const RETENTION_DAYS = 30

interface Payload {
  lang?: 'fr' | 'en' | 'es' | 'de' | 'ja'
}

const EMAIL_I18N = {
  fr: {
    subject: 'Suppression de ton compte Fridge+ — confirmation',
    greeting: (name: string) => `Bonjour ${name},`,
    intro: `Tu as demandé la suppression de ton compte Fridge+. Tes données seront conservées encore ${RETENTION_DAYS} jours, puis définitivement effacées.`,
    cancelTitle: 'Tu changes d\'avis ?',
    cancelText: `Tu peux annuler la suppression à tout moment durant ces ${RETENTION_DAYS} jours :`,
    cancelOption1: '• En te reconnectant à Fridge+ avec ton email et ton mot de passe',
    cancelOption2: '• Ou en cliquant sur le bouton ci-dessous :',
    cta: 'Annuler la suppression',
    expiry: (date: string) => `Ce lien est valide jusqu'au ${date}.`,
    footer: 'Tu reçois cet email parce qu\'une demande de suppression a été faite sur ton compte Fridge+.',
  },
  en: {
    subject: 'Fridge+ account deletion — confirmation',
    greeting: (name: string) => `Hi ${name},`,
    intro: `You requested the deletion of your Fridge+ account. Your data will be kept for ${RETENTION_DAYS} more days, then permanently erased.`,
    cancelTitle: 'Changed your mind?',
    cancelText: `You can cancel the deletion any time during these ${RETENTION_DAYS} days:`,
    cancelOption1: '• By signing back in to Fridge+ with your email and password',
    cancelOption2: '• Or by clicking the button below:',
    cta: 'Cancel deletion',
    expiry: (date: string) => `This link is valid until ${date}.`,
    footer: 'You\'re receiving this email because a deletion request was made on your Fridge+ account.',
  },
  es: {
    subject: 'Eliminación de tu cuenta Fridge+ — confirmación',
    greeting: (name: string) => `Hola ${name},`,
    intro: `Has solicitado la eliminación de tu cuenta Fridge+. Tus datos se conservarán ${RETENTION_DAYS} días más y luego se borrarán definitivamente.`,
    cancelTitle: '¿Has cambiado de opinión?',
    cancelText: `Puedes cancelar la eliminación en cualquier momento durante estos ${RETENTION_DAYS} días:`,
    cancelOption1: '• Volviendo a iniciar sesión en Fridge+ con tu correo y contraseña',
    cancelOption2: '• O haciendo clic en el botón de abajo:',
    cta: 'Cancelar la eliminación',
    expiry: (date: string) => `Este enlace es válido hasta el ${date}.`,
    footer: 'Recibes este correo porque se solicitó la eliminación de tu cuenta Fridge+.',
  },
  de: {
    subject: 'Löschung deines Fridge+-Kontos — Bestätigung',
    greeting: (name: string) => `Hallo ${name},`,
    intro: `Du hast die Löschung deines Fridge+-Kontos angefordert. Deine Daten werden noch ${RETENTION_DAYS} Tage aufbewahrt und danach endgültig gelöscht.`,
    cancelTitle: 'Du hast es dir anders überlegt?',
    cancelText: `Du kannst die Löschung während dieser ${RETENTION_DAYS} Tage jederzeit rückgängig machen:`,
    cancelOption1: '• Indem du dich mit deiner E-Mail und Passwort wieder bei Fridge+ anmeldest',
    cancelOption2: '• Oder indem du auf den Button unten klickst:',
    cta: 'Löschung abbrechen',
    expiry: (date: string) => `Dieser Link ist gültig bis zum ${date}.`,
    footer: 'Du erhältst diese E-Mail, weil eine Löschungsanfrage für dein Fridge+-Konto gestellt wurde.',
  },
  ja: {
    subject: 'Fridge+ アカウント削除のご確認',
    greeting: (name: string) => `${name} 様、`,
    intro: `Fridge+ アカウントの削除をリクエストされました。データはあと ${RETENTION_DAYS} 日間保持され、その後完全に削除されます。`,
    cancelTitle: '気が変わった場合は？',
    cancelText: `この ${RETENTION_DAYS} 日間はいつでも削除をキャンセルできます：`,
    cancelOption1: '• Fridge+ にメールアドレスとパスワードで再ログインする',
    cancelOption2: '• または下のボタンをクリックする',
    cta: '削除をキャンセル',
    expiry: (date: string) => `このリンクは ${date} まで有効です。`,
    footer: 'このメールは、Fridge+ アカウントの削除がリクエストされたために送信されています。',
  },
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function formatExpiryDate(d: Date, lang: string): string {
  const day = d.getDate()
  const months: Record<string, string[]> = {
    fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    de: ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sept', 'Okt', 'Nov', 'Dez'],
    ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  }
  const m = (months[lang] ?? months.fr)[d.getMonth()]
  if (lang === 'ja') return `${d.getFullYear()}年${d.getMonth() + 1}月${day}日`
  if (lang === 'en') return `${m} ${day}, ${d.getFullYear()}`
  if (lang === 'de') return `${day}. ${m} ${d.getFullYear()}`
  return `${day} ${m} ${d.getFullYear()}`
}

function buildEmailHTML(opts: {
  username: string
  restoreUrl: string
  expiryDate: string
  lang: keyof typeof EMAIL_I18N
}): string {
  const t = EMAIL_I18N[opts.lang] ?? EMAIL_I18N.fr
  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(t.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FDFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A1A0A;">
  <div style="max-width:560px;margin:24px auto;padding:32px 28px;background:#FFFFFF;border-radius:14px;border:1px solid #EDE4D4;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
    <div style="font-size:22px;font-weight:800;color:#C05010;margin-bottom:18px;">🥬 Fridge+</div>

    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${escapeHtml(t.greeting(opts.username))}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#5A4030;">${escapeHtml(t.intro)}</p>

    <div style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2A1A0A;">${escapeHtml(t.cancelTitle)}</div>
    <p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#5A4030;">${escapeHtml(t.cancelText)}</p>
    <p style="font-size:13px;line-height:1.6;margin:0 0 4px;color:#5A4030;">${escapeHtml(t.cancelOption1)}</p>
    <p style="font-size:13px;line-height:1.6;margin:0 0 18px;color:#5A4030;">${escapeHtml(t.cancelOption2)}</p>

    <div style="text-align:center;margin:0 0 18px;">
      <a href="${opts.restoreUrl}" style="display:inline-block;padding:12px 26px;background-color:#D46A10;background-image:linear-gradient(135deg,#F7A85E 0%,#D46A10 100%);color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${escapeHtml(t.cta)}</a>
    </div>

    <p style="font-size:12px;color:#9A7A60;line-height:1.5;margin:0 0 22px;text-align:center;">${escapeHtml(t.expiry(opts.expiryDate))}</p>

    <hr style="border:none;border-top:1px solid #EDE4D4;margin:18px 0;">
    <p style="font-size:11px;color:#9A7A60;line-height:1.5;margin:0;text-align:center;">${escapeHtml(t.footer)}</p>
  </div>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  const CORS = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS })
  }

  // ── Auth caller ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (userErr || !user || !user.email) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  // v3.206.0 — Rate limit anti-abus : 3 tentatives / min / user.
  // Empêche un user (ou un attaquant ayant volé un token) de spammer
  // l'endpoint, qui envoie un email Resend coûteux à chaque appel.
  const rateLimited = applyRateLimit(req, 'delete-account', { max: 3, windowMs: 60_000 }, user.id, CORS)
  if (rateLimited) return rateLimited

  // ── Parse body ───────────────────────────────────────────────
  let payload: Payload = {}
  try { payload = await req.json() } catch { /* body optionnel */ }
  const safeLang = (['fr', 'en', 'es', 'de', 'ja'].includes(payload.lang ?? '') ? payload.lang! : 'fr') as keyof typeof EMAIL_I18N

  // ── Génère le restore_token et marque le profil ──────────────
  const restoreToken = crypto.randomUUID()
  const deletedAt    = new Date().toISOString()
  const expiry       = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const { error: updErr } = await supabaseAdmin
    .from('profiles')
    .update({
      deleted_at:    deletedAt,
      restore_token: restoreToken,
    })
    .eq('id', user.id)
  if (updErr) {
    return new Response(
      JSON.stringify({ error: 'db_error', detail: updErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  // ── Récupère le pseudo pour l'email ─────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()
  const username = profile?.username ?? user.email.split('@')[0]

  // ── Sign out toutes les sessions existantes ─────────────────
  // Le user devra se reconnecter (ce qui restaurera son compte) ou
  // utiliser le lien restore. Non bloquant : si ça échoue, le soft
  // delete est déjà appliqué.
  await supabaseAdmin.auth.admin.signOut(user.id).catch(() => null)

  // ── Envoi de l'email Resend ─────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const appUrl    = Deno.env.get('APP_URL') ?? ''
  if (resendKey && appUrl) {
    const restoreUrl = `${appUrl}/?restore-account=${encodeURIComponent(restoreToken)}`
    const expiryStr  = formatExpiryDate(expiry, safeLang)
    const t          = EMAIL_I18N[safeLang]

    // Plafond quotidien d'e-mails par compte (BDD-08) : une boucle
    // supprimer / restaurer ne vide plus le quota d'envoi de toute l'app.
    const reservation = await reserverUnEmail(supabaseAdmin, user.id, 'account_deleted')
    if (reservation === 'ok') {
      // Best-effort : sendEmail journalise déjà l'échec côté serveur ; la
      // suppression du compte reste valide même si l'email ne part pas.
      await sendEmail(resendKey, {
        to: user.email,
        subject: t.subject,
        html: buildEmailHTML({ username, restoreUrl, expiryDate: expiryStr, lang: safeLang }),
      }, 'delete-account')
    } else {
      console.warn('delete-account: e-mail non envoyé —', reservation)
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      retentionDays: RETENTION_DAYS,
      expiresAt: expiry.toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json', ...CORS } }
  )
})
