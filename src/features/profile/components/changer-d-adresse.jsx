import { useId, useState } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { estUnCompteGoogle } from '@shared/lib/auth/compte-google'
import Button from '@shared/ui/button'

// Changer d'adresse e-mail (décision du 2026-10-08) : dans « Identifiants »,
// sous l'adresse masquée. Un lien part à la nouvelle adresse ; l'actuelle reste
// valable jusqu'au clic. Selon le réglage « Secure email change » du projet,
// un lien part aussi à l'adresse actuelle : le message le dit. Un compte
// Google ne voit pas le parcours — son adresse est celle de Google.
const I18N = {
  fr: {
    libelle: 'Nouvelle adresse e-mail',
    exemple: 'nouvelle.adresse@exemple.fr',
    envoyer: 'Envoyer le lien de confirmation',
    note: 'Ton adresse actuelle reste valable jusqu’à ce que tu cliques sur le lien.',
    envoye: (a) => `✓ Ouvre le lien reçu à ${a} pour confirmer. Si un e-mail arrive aussi à ton adresse actuelle, ouvre-le aussi.`,
    invalide: 'Cette adresse n’a pas l’air valide.',
    meme: 'C’est déjà ton adresse.',
    prise: 'Cette adresse est déjà utilisée par un autre compte.',
    tropVite: 'Trop de demandes d’un coup : réessaie dans quelques minutes.',
    echec: 'Le lien n’a pas pu partir. Réessaie dans un instant.',
    google: 'Ton adresse est celle de ton compte Google : elle se change chez Google.',
  },
  en: {
    libelle: 'New email address',
    exemple: 'new.address@example.com',
    envoyer: 'Send the confirmation link',
    note: 'Your current address stays valid until you click the link.',
    envoye: (a) => `✓ Open the link sent to ${a} to confirm. If an email also reaches your current address, open it too.`,
    invalide: 'This address doesn’t look valid.',
    meme: 'That’s already your address.',
    prise: 'This address is already used by another account.',
    tropVite: 'Too many requests at once: try again in a few minutes.',
    echec: 'The link couldn’t be sent. Try again in a moment.',
    google: 'Your address is your Google account’s: change it at Google.',
  },
}

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function messageDErreur(error, t) {
  if (error?.code === 'email_exists' || error?.status === 422) return t.prise
  if (error?.status === 429 || /rate_limit/.test(error?.code ?? '')) return t.tropVite
  return t.echec
}

export default function ChangerDAdresse({ lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr
  const { user, updateEmail } = useAuth()
  const champId = useId()
  const noteId = useId()
  const [adresse, setAdresse] = useState('')
  const [etat, setEtat] = useState({ envoi: false, erreur: null, envoyeA: null })

  if (estUnCompteGoogle(user)) {
    return <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-muted)' }}>{t.google}</p>
  }

  async function envoyer(e) {
    e.preventDefault()
    const nouvelle = adresse.trim()
    if (!ADRESSE.test(nouvelle)) { setEtat({ envoi: false, erreur: t.invalide, envoyeA: null }); return }
    if (nouvelle.toLowerCase() === (user?.email ?? '').toLowerCase()) { setEtat({ envoi: false, erreur: t.meme, envoyeA: null }); return }
    setEtat({ envoi: true, erreur: null, envoyeA: null })
    const { error } = await updateEmail(nouvelle)
    if (error) setEtat({ envoi: false, erreur: messageDErreur(error, t), envoyeA: null })
    else { setEtat({ envoi: false, erreur: null, envoyeA: nouvelle }); setAdresse('') }
  }

  return (
    <form onSubmit={envoyer} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label htmlFor={champId} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-muted)' }}>{t.libelle}</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input id={champId} type="email" autoComplete="email" value={adresse} placeholder={t.exemple}
          aria-describedby={noteId} aria-invalid={etat.erreur ? true : undefined}
          onChange={(e) => { setAdresse(e.target.value); if (etat.erreur) setEtat((s) => ({ ...s, erreur: null })) }}
          style={{ flex: '1 1 220px', minWidth: 0, padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--color-border-warm)', background: 'transparent', color: 'var(--color-charcoal)', fontSize: '14px', fontFamily: 'inherit' }} />
        <Button type="submit" variant="secondary" loading={etat.envoi} disabled={etat.envoi}
          className="h-auto rounded-lg px-4 py-2.5 text-[13px] font-bold">
          {t.envoyer}
        </Button>
      </div>
      <p id={noteId} style={{ fontSize: '12px', margin: 0, color: 'var(--color-muted)' }}>{t.note}</p>
      {etat.erreur && <p role="alert" style={{ fontSize: '12px', margin: 0, color: 'var(--color-danger-text)' }}>{etat.erreur}</p>}
      <p role="status" style={{ fontSize: '12px', margin: 0, color: 'var(--color-success-text)' }}>{etat.envoyeA ? t.envoye(etat.envoyeA) : ''}</p>
    </form>
  )
}
