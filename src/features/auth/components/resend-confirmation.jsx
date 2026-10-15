import { useEffect, useState } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import Button from '@shared/ui/button'

// « Renvoyer l'e-mail de confirmation » — après l'inscription, et devant
// « E-mail non confirmé » à la connexion.
//
// Avant le 2026-10-04 il n'existait aucun moyen de le redemander : un e-mail
// perdu ou un lien expiré laissait le compte inutilisable (audit CPT-13).
//
// Le service d'authentification refuse plus d'une demande par minute et par
// adresse : le bouton attend donc 60 secondes entre deux envois, et dès le
// départ quand un e-mail vient de partir (`startCoolingDown`).
export const RESEND_COOLDOWN_S = 60

const I18N = {
  fr: {
    action: 'Renvoyer l’e-mail de confirmation',
    wait: (n) => `Renvoi possible dans ${n} s`,
    sent: '✓ E-mail renvoyé. Pense au dossier des indésirables.',
    failed: 'Impossible de renvoyer l’e-mail pour l’instant. Réessaie dans une minute.',
  },
  en: {
    action: 'Resend the confirmation e-mail',
    wait: (n) => `You can resend in ${n} s`,
    sent: '✓ E-mail sent again. Check your spam folder too.',
    failed: 'Could not resend the e-mail right now. Try again in a minute.',
  },
}

export default function ResendConfirmation({ email, lang = 'fr', startCoolingDown = false }) {
  const t = I18N[lang] ?? I18N.fr
  const { resendSignupEmail } = useAuth()
  // Le délai se mesure à l'horloge (une échéance), pas en comptant des tics :
  // un onglet en arrière-plan ralentit ses minuteries, pas l'heure.
  const [deadline, setDeadline] = useState(() => (startCoolingDown ? Date.now() + RESEND_COOLDOWN_S * 1000 : 0))
  const [now, setNow] = useState(() => Date.now())
  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState(null) // 'sent' | 'failed' | null
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))
  const waiting = remaining > 0

  useEffect(() => {
    if (!waiting) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [waiting])

  async function handleResend() {
    if (sending || waiting) return
    setSending(true)
    setOutcome(null)
    const { error } = await resendSignupEmail(email)
    setSending(false)
    setOutcome(error ? 'failed' : 'sent')
    setNow(Date.now())
    setDeadline(Date.now() + RESEND_COOLDOWN_S * 1000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Button
        variant="secondary" className="w-full"
        onClick={handleResend} loading={sending} disabled={sending || waiting}
      >
        {waiting ? t.wait(remaining) : t.action}
      </Button>
      {outcome === 'sent' && (
        <p role="status" aria-live="polite" style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: '#16A34A' }}>
          {t.sent}
        </p>
      )}
      {outcome === 'failed' && (
        <p role="alert" style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: '#DC2626' }}>
          {t.failed}
        </p>
      )}
    </div>
  )
}
