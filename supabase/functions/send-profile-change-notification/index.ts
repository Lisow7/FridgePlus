// Edge Function — envoie un email de notification à l'utilisateur après
// une modification réussie de son profil (pseudo, email, mot de passe).
//
// Appelée depuis :
//   • AuthContext.updateProfile (côté client) après un changement de
//     pseudo réussi
//   • AuthContext.onAuthStateChange (USER_UPDATED) quand l'email change
//   • AuthContext.completePasswordReset après reset du mdp via le flow
//     recovery email
//
// L'email sert de notification de sécurité ; le contenu inclut un message
// type « Si ce n'est pas toi qui as fait ce changement, contacte le
// support immédiatement ».
//
// Sécurité :
//   • Vérifie le user authentifié via le bearer token
//   • Service role uniquement pour récupérer les infos du profil
//   • Envoi non bloquant côté client : si l'email échoue, l'opération
//     d'origine (updateProfile etc.) a déjà réussi
//
// Secrets requis : RESEND_API_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3'
import { getCorsHeaders } from '../_shared/cors.ts'
import { reponseErreur } from '../_shared/reponse-erreur.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { sendEmail } from '../_shared/email.ts'
import { reserverUnEmail } from '../_shared/email-quota.ts'

type ChangeType = 'pseudo' | 'email' | 'password'
type Lang       = 'fr' | 'en' | 'es' | 'de' | 'ja'

interface Payload {
  type: ChangeType
  lang?: Lang
  oldValue?: string  // utile pour pseudo / email
  newValue?: string
}

// ── Templates : 3 types × 5 langues ─────────────────────────────────────
const I18N: Record<ChangeType, Record<Lang, {
  subject: string
  greeting: (name: string) => string
  intro: string
  detailLabel: string
  detail: (oldV?: string, newV?: string) => string
  securityTitle: string
  securityText: string
  footer: string
}>> = {
  pseudo: {
    fr: {
      subject: 'Ton pseudo Fridge+ a été modifié',
      greeting: (name) => `Bonjour ${name},`,
      intro: 'Le pseudo de ton compte Fridge+ vient d\'être modifié.',
      detailLabel: 'Modification',
      detail: (o, n) => o ? `« ${o} » → « ${n} »` : `Nouveau pseudo : « ${n} »`,
      securityTitle: 'Tu n\'es pas à l\'origine de ce changement ?',
      securityText: 'Si tu ne reconnais pas cette modification, ton compte pourrait être compromis. Connecte-toi immédiatement, change ton mot de passe via la voie « Mot de passe oublié », et contacte le support depuis l\'application.',
      footer: 'Tu reçois cet email car ton pseudo Fridge+ a été modifié.',
    },
    en: {
      subject: 'Your Fridge+ username was changed',
      greeting: (name) => `Hi ${name},`,
      intro: 'The username on your Fridge+ account was just changed.',
      detailLabel: 'Change',
      detail: (o, n) => o ? `"${o}" → "${n}"` : `New username: "${n}"`,
      securityTitle: 'Didn\'t make this change?',
      securityText: 'If you don\'t recognize this change, your account might be compromised. Sign in immediately, reset your password via "Forgot password", and contact support from the app.',
      footer: 'You\'re receiving this email because your Fridge+ username was changed.',
    },
    es: {
      subject: 'Tu nombre de usuario Fridge+ ha sido modificado',
      greeting: (name) => `Hola ${name},`,
      intro: 'El nombre de usuario de tu cuenta Fridge+ acaba de cambiar.',
      detailLabel: 'Cambio',
      detail: (o, n) => o ? `«${o}» → «${n}»` : `Nuevo nombre: «${n}»`,
      securityTitle: '¿No has hecho este cambio?',
      securityText: 'Si no reconoces esta modificación, tu cuenta podría estar comprometida. Inicia sesión inmediatamente, restablece tu contraseña con «Contraseña olvidada» y contacta con soporte desde la aplicación.',
      footer: 'Recibes este correo porque tu nombre de usuario Fridge+ ha cambiado.',
    },
    de: {
      subject: 'Dein Fridge+-Benutzername wurde geändert',
      greeting: (name) => `Hallo ${name},`,
      intro: 'Der Benutzername deines Fridge+-Kontos wurde gerade geändert.',
      detailLabel: 'Änderung',
      detail: (o, n) => o ? `„${o}" → „${n}"` : `Neuer Benutzername: „${n}"`,
      securityTitle: 'Du hast diese Änderung nicht vorgenommen?',
      securityText: 'Wenn du diese Änderung nicht erkennst, könnte dein Konto kompromittiert sein. Melde dich sofort an, setze dein Passwort über „Passwort vergessen" zurück und kontaktiere den Support aus der App.',
      footer: 'Du erhältst diese E-Mail, weil dein Fridge+-Benutzername geändert wurde.',
    },
    ja: {
      subject: 'Fridge+ のユーザー名が変更されました',
      greeting: (name) => `${name} 様、`,
      intro: 'Fridge+ アカウントのユーザー名が変更されました。',
      detailLabel: '変更内容',
      detail: (o, n) => o ? `「${o}」→「${n}」` : `新しいユーザー名：「${n}」`,
      securityTitle: '心当たりがない場合',
      securityText: 'この変更に心当たりがない場合、アカウントが乗っ取られている可能性があります。すぐにログインし、「パスワードをお忘れですか」からパスワードをリセットして、アプリ内のサポートにご連絡ください。',
      footer: 'このメールは、Fridge+ のユーザー名が変更されたために送信されています。',
    },
  },

  email: {
    fr: {
      subject: 'Ton adresse email Fridge+ a été modifiée',
      greeting: (name) => `Bonjour ${name},`,
      intro: 'L\'adresse email de ton compte Fridge+ vient d\'être modifiée avec succès.',
      detailLabel: 'Nouvelle adresse',
      detail: (_o, n) => n ?? '',
      securityTitle: 'Tu n\'es pas à l\'origine de ce changement ?',
      securityText: 'Si tu n\'as pas demandé ce changement, contacte le support immédiatement. Note : le changement nécessite une vérification par clic sur un lien envoyé à la nouvelle adresse — il ne peut donc être effectué que par quelqu\'un ayant accès à cette boîte mail.',
      footer: 'Tu reçois cet email à ta nouvelle adresse car ton email Fridge+ a été mis à jour.',
    },
    en: {
      subject: 'Your Fridge+ email address was changed',
      greeting: (name) => `Hi ${name},`,
      intro: 'The email address on your Fridge+ account was just successfully changed.',
      detailLabel: 'New address',
      detail: (_o, n) => n ?? '',
      securityTitle: 'Didn\'t request this change?',
      securityText: 'If you didn\'t request this change, contact support immediately. Note: the change requires verification via a link sent to the new address — so it can only be performed by someone with access to that inbox.',
      footer: 'You\'re receiving this email at your new address because your Fridge+ email was updated.',
    },
    es: {
      subject: 'Tu correo electrónico Fridge+ ha sido modificado',
      greeting: (name) => `Hola ${name},`,
      intro: 'La dirección de correo de tu cuenta Fridge+ ha sido actualizada con éxito.',
      detailLabel: 'Nueva dirección',
      detail: (_o, n) => n ?? '',
      securityTitle: '¿No has pedido este cambio?',
      securityText: 'Si no has solicitado este cambio, contacta con soporte inmediatamente. Nota: el cambio requiere verificación mediante un enlace enviado a la nueva dirección — solo puede hacerlo alguien con acceso a ese buzón.',
      footer: 'Recibes este correo en tu nueva dirección porque tu email Fridge+ fue actualizado.',
    },
    de: {
      subject: 'Deine Fridge+-E-Mail-Adresse wurde geändert',
      greeting: (name) => `Hallo ${name},`,
      intro: 'Die E-Mail-Adresse deines Fridge+-Kontos wurde soeben erfolgreich geändert.',
      detailLabel: 'Neue Adresse',
      detail: (_o, n) => n ?? '',
      securityTitle: 'Du hast diese Änderung nicht angefordert?',
      securityText: 'Wenn du diese Änderung nicht angefordert hast, kontaktiere sofort den Support. Hinweis: Die Änderung erfordert eine Bestätigung über einen Link an die neue Adresse — sie kann nur von jemandem durchgeführt werden, der Zugriff auf dieses Postfach hat.',
      footer: 'Du erhältst diese E-Mail an deiner neuen Adresse, weil deine Fridge+-E-Mail aktualisiert wurde.',
    },
    ja: {
      subject: 'Fridge+ のメールアドレスが変更されました',
      greeting: (name) => `${name} 様、`,
      intro: 'Fridge+ アカウントのメールアドレスが正常に変更されました。',
      detailLabel: '新しいアドレス',
      detail: (_o, n) => n ?? '',
      securityTitle: '心当たりがない場合',
      securityText: 'この変更にお心当たりがない場合は、すぐにサポートまでご連絡ください。なお、変更には新しいアドレスに送信されるリンクのクリックによる確認が必要なため、このアドレスにアクセスできる方のみが実行できます。',
      footer: 'このメールは、Fridge+ のメールアドレスが更新されたため、新しいアドレスに送信されています。',
    },
  },

  password: {
    fr: {
      subject: 'Ton mot de passe Fridge+ a été modifié',
      greeting: (name) => `Bonjour ${name},`,
      intro: 'Le mot de passe de ton compte Fridge+ vient d\'être réinitialisé avec succès.',
      detailLabel: 'Date',
      detail: () => new Date().toLocaleString('fr-FR'),
      securityTitle: 'Tu n\'es pas à l\'origine de ce changement ?',
      securityText: 'Si tu n\'as pas réinitialisé ton mot de passe, ton compte est probablement compromis. Demande immédiatement un nouveau lien de réinitialisation depuis l\'écran de connexion, change ton mot de passe, puis contacte le support.',
      footer: 'Tu reçois cet email car le mot de passe de ton compte Fridge+ a été réinitialisé.',
    },
    en: {
      subject: 'Your Fridge+ password was changed',
      greeting: (name) => `Hi ${name},`,
      intro: 'The password on your Fridge+ account was just successfully reset.',
      detailLabel: 'When',
      detail: () => new Date().toLocaleString('en-US'),
      securityTitle: 'Didn\'t make this change?',
      securityText: 'If you didn\'t reset your password, your account is likely compromised. Immediately request a new reset link from the sign-in screen, change your password, and contact support.',
      footer: 'You\'re receiving this email because your Fridge+ account password was reset.',
    },
    es: {
      subject: 'Tu contraseña Fridge+ ha sido modificada',
      greeting: (name) => `Hola ${name},`,
      intro: 'La contraseña de tu cuenta Fridge+ acaba de restablecerse con éxito.',
      detailLabel: 'Fecha',
      detail: () => new Date().toLocaleString('es-ES'),
      securityTitle: '¿No has hecho este cambio?',
      securityText: 'Si no has restablecido tu contraseña, tu cuenta probablemente está comprometida. Solicita inmediatamente un nuevo enlace de restablecimiento desde la pantalla de inicio de sesión, cambia tu contraseña y contacta con soporte.',
      footer: 'Recibes este correo porque la contraseña de tu cuenta Fridge+ ha sido restablecida.',
    },
    de: {
      subject: 'Dein Fridge+-Passwort wurde geändert',
      greeting: (name) => `Hallo ${name},`,
      intro: 'Das Passwort deines Fridge+-Kontos wurde soeben erfolgreich zurückgesetzt.',
      detailLabel: 'Wann',
      detail: () => new Date().toLocaleString('de-DE'),
      securityTitle: 'Du hast diese Änderung nicht vorgenommen?',
      securityText: 'Wenn du dein Passwort nicht zurückgesetzt hast, ist dein Konto wahrscheinlich kompromittiert. Fordere sofort einen neuen Reset-Link über den Anmeldebildschirm an, ändere dein Passwort und kontaktiere den Support.',
      footer: 'Du erhältst diese E-Mail, weil das Passwort deines Fridge+-Kontos zurückgesetzt wurde.',
    },
    ja: {
      subject: 'Fridge+ のパスワードが変更されました',
      greeting: (name) => `${name} 様、`,
      intro: 'Fridge+ アカウントのパスワードが正常にリセットされました。',
      detailLabel: '日時',
      detail: () => new Date().toLocaleString('ja-JP'),
      securityTitle: '心当たりがない場合',
      securityText: 'パスワードをご自身でリセットされていない場合、アカウントが乗っ取られている可能性があります。すぐにログイン画面から新しいリセットリンクをリクエストし、パスワードを変更して、サポートまでご連絡ください。',
      footer: 'このメールは、Fridge+ アカウントのパスワードがリセットされたために送信されています。',
    },
  },
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildEmailHTML(opts: {
  type: ChangeType
  lang: Lang
  username: string
  oldValue?: string
  newValue?: string
}): string {
  const t = I18N[opts.type][opts.lang] ?? I18N[opts.type].fr
  const detailStr = t.detail(opts.oldValue, opts.newValue)
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

    <div style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9A7A60;">${escapeHtml(t.detailLabel)}</div>
    <div style="margin:0 0 22px;font-size:15px;font-weight:700;color:#2A1A0A;padding:10px 14px;background:#FFF8F2;border-left:3px solid #E07820;border-radius:4px;word-break:break-all;">${escapeHtml(detailStr)}</div>

    <div style="margin:0 0 6px;font-size:13px;font-weight:700;color:#2A1A0A;">${escapeHtml(t.securityTitle)}</div>
    <p style="font-size:13px;line-height:1.6;margin:0 0 22px;color:#5A4030;">${escapeHtml(t.securityText)}</p>

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

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user || !user.email) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  // S10.d.4 — rate-limit : un user légitime ne change pas son profil
  // 5 fois en 60 secondes ; au-delà = spam ou compte compromis.
  const rateLimited = applyRateLimit(req, 'send-profile-change-notification', { max: 5, windowMs: 60_000 }, user.id, CORS)
  if (rateLimited) return rateLimited

  // ── Parse body ───────────────────────────────────────────────
  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS })
  }
  const { type, lang } = payload
  // Recopiées dans l'e-mail (échappées) : bornées à la longueur d'une adresse
  // e-mail (254), au-delà de tout pseudo ou adresse légitime (BDD-08).
  const borner = (v: unknown) => (typeof v === 'string' ? v.slice(0, 254) : undefined)
  const oldValue = borner(payload.oldValue)
  const newValue = borner(payload.newValue)
  if (!type || !['pseudo', 'email', 'password'].includes(type)) {
    return new Response(JSON.stringify({ error: 'invalid_type' }), { status: 400, headers: CORS })
  }
  const safeLang = (['fr', 'en', 'es', 'de', 'ja'].includes(lang ?? '') ? lang! : 'fr') as Lang

  // ── Récupère le pseudo + détermine l'adresse cible ──────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()
  const username = profile?.username ?? user.email.split('@')[0]

  // Pour 'email' on envoie à la NOUVELLE adresse (= user.email actuelle après changement).
  // Pour 'pseudo' et 'password', on envoie à l'email du compte (user.email).
  const targetEmail = user.email

  // ── Envoi via Resend ────────────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: 'resend_not_configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  // ── Plafond quotidien d'e-mails par compte (BDD-08) ─────────
  // Réservé en base avant l'envoi : le limiteur en mémoire ne survit pas à un
  // démarrage à froid et ne voit pas les autres instances.
  const reservation = await reserverUnEmail(supabaseAdmin, user.id, 'profile_change')
  if (reservation === 'erreur') {
    return new Response(
      JSON.stringify({ error: 'email_quota_check_failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
  if (reservation === 'plafond') {
    return new Response(
      JSON.stringify({ error: 'email_quota_exceeded' }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }

  const t = I18N[type][safeLang]

  const emailRes = await sendEmail(resendKey, {
    to: targetEmail,
    subject: t.subject,
    html: buildEmailHTML({ type, lang: safeLang, username, oldValue, newValue }),
  }, 'send-profile-change-notification')

  if (!emailRes.ok) return reponseErreur('email_send_failed', 502, CORS, emailRes.error, 'send-profile-change-notification')

  return new Response(
    JSON.stringify({ success: true, emailId: emailRes.id }),
    { headers: { 'Content-Type': 'application/json', ...CORS } }
  )
})
