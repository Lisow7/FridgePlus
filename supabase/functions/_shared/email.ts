// Expéditeur transactionnel centralisé + wrapper Resend unique.
//
// Pourquoi (2026-07-22, audit backend §2) : la constante `RESEND_FROM` et le
// `fetch` vers l'API Resend étaient dupliqués dans 5 Edge Functions. Deux
// d'entre elles (`delete-account`, `send-profile-change-notification`)
// pointaient encore sur le domaine sandbox `onboarding@resend.dev`, dont les
// emails ne sont délivrables qu'au propriétaire du compte Resend — donc le
// lien de restauration RGPD et les alertes de sécurité ne partaient pas aux
// vrais utilisateurs. On centralise ici sur le domaine `send.fridgeplus.app`
// déjà vérifié dans Resend (DKIM/SPF/DMARC, 2026-06-16) et on unifie le point
// de log des échecs d'envoi.
//
// Le wrapper renvoie un résultat structuré (`ok`/`status`/`id`/`error`) et
// laisse chaque appelant décider de sa réponse (best-effort vs 502, boucle
// d'agrégation, etc.) — aucune sémantique d'erreur existante n'est modifiée.
// `error` contient le corps Resend brut non tronqué ; seul le log serveur est
// tronqué. Ne PAS renvoyer `error` tel quel au client sans le maîtriser
// (fuite d'infos — voir audit backend §4.4, hors périmètre de cette PR).

/** Expéditeur unique de tous les emails transactionnels Fridge+. */
export const RESEND_FROM = 'Fridge+ <noreply@send.fridgeplus.app>'

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  /** Surcharge optionnelle de l'expéditeur (par défaut RESEND_FROM). */
  from?: string
}

export interface SendEmailResult {
  ok: boolean
  status: number
  /** id Resend en cas de succès, sinon null. */
  id: string | null
  /** corps d'erreur Resend brut (non tronqué) en cas d'échec, sinon null. */
  error: string | null
}

/**
 * Envoie un email via l'API Resend et normalise le résultat.
 * `label` sert uniquement à identifier la fonction appelante dans les logs.
 */
export async function sendEmail(
  apiKey: string,
  { to, subject, html, from = RESEND_FROM }: SendEmailParams,
  label = 'email',
): Promise<SendEmailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // Point de log unique des échecs Resend (tronqué pour le log seulement).
    console.warn(`[${label}] Resend ${res.status}: ${text.slice(0, 300)}`)
    return { ok: false, status: res.status, id: null, error: text }
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>))
  return { ok: true, status: res.status, id: (data?.id as string) ?? null, error: null }
}
