import { useState } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import EcranDuCompte from './ecran-du-compte'
import { couleursDuCompte, dateLongue, ORANGE_LISIBLE } from '../lib/ecrans-du-compte'

// L'écran de la personne bannie (audit du 2026-10-04, lot 3c-3b ; maquette
// validée par Antoine le 2026-10-05) : le motif et la date de fin — il ne
// disait que « non-respect de nos conditions » —, et « Se déconnecter », qui
// manquait. Visible tant que la session n'est pas coupée (au plus une heure :
// `admin_bannir` coupe les jetons).
//
// « Contacter le support » ÉCRIT au support par e-mail : la base refuse
// d'ouvrir un ticket à un compte banni (`ouvrir_ticket`, lot 3c-3b-1) — le
// formulaire qu'ouvrait ce bouton menait à un refus.

const SUPPORT = 'support@fridgeplus.app'

const I18N = {
  fr: {
    aDroite: 'Compte',
    titre: 'Compte suspendu',
    titreDate: (date) => `Compte suspendu jusqu’au ${date}`,
    motif: 'Motif',
    texteDate: 'Tu ne peux rien publier ni écrire au support d’ici là.',
    texteSansFin: 'Tu ne peux plus rien publier ni écrire au support.',
    erreur: (adresse) => `Si tu penses que c’est une erreur, écris à ${adresse}.`,
    rgpd: 'Tu gardes le droit de supprimer ton compte et tes données (RGPD, article 17). Seule une empreinte de ton adresse e-mail, qui ne permet pas de la retrouver, est gardée jusqu’à la fin de la suspension (3 ans au plus), pour empêcher une réinscription.',
    supportBtn: 'Contacter le support',
    sujet: 'Mon compte est suspendu',
    deconnecter: 'Se déconnecter',
    deleteBtn: 'Supprimer mon compte',
    confirmTitle: 'Supprimer ton compte ?',
    confirmMsg: 'Ton compte est désactivé tout de suite, puis tes données sont effacées 30 jours plus tard.',
    cancel: 'Annuler',
    confirm: 'Supprimer',
    errorDelete: 'Une erreur est survenue. Réessaie.',
  },
  en: {
    aDroite: 'Account',
    titre: 'Account suspended',
    titreDate: (date) => `Account suspended until ${date}`,
    motif: 'Reason',
    texteDate: 'You cannot post anything or write to support until then.',
    texteSansFin: 'You can no longer post anything or write to support.',
    erreur: (adresse) => `If you think this is a mistake, write to ${adresse}.`,
    rgpd: 'You keep the right to delete your account and your data (GDPR, Article 17). Only a fingerprint of your e-mail address, from which it cannot be recovered, is kept until the suspension ends (3 years at most), to prevent signing up again.',
    supportBtn: 'Contact support',
    sujet: 'My account is suspended',
    deconnecter: 'Sign out',
    deleteBtn: 'Delete my account',
    confirmTitle: 'Delete your account?',
    confirmMsg: 'Your account is deactivated straight away, then your data is erased 30 days later.',
    cancel: 'Cancel',
    confirm: 'Delete',
    errorDelete: 'An error occurred. Please try again.',
  },
}

export default function BannedScreen({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const c = couleursDuCompte(darkMode)
  const { profile, deleteAccount, signOut } = useAuth()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogue = useDialogue({ onClose: () => setShowConfirm(false), actif: showConfirm })
  const fin = profile?.banned_until ?? null
  const motif = profile?.banned_reason ?? null

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error: err } = await deleteAccount(lang)
    if (err) {
      setError(t.errorDelete)
      setDeleting(false)
    }
    // Succès : la session se ferme et « Compte désactivé » prend la place.
  }

  const bouton = 'h-auto w-full rounded-xl py-3 text-base font-bold'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto' }}>
      <EcranDuCompte icone="🚫" titre={fin ? t.titreDate(dateLongue(fin, lang)) : t.titre} aDroite={t.aDroite} darkMode={darkMode}>
        {motif && (
          <div style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, background: c.carte, border: `1px solid ${c.bord}` }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.doux }}>{t.motif}</p>
            <p style={{ margin: '4px 0 0', fontSize: 15, lineHeight: 1.45 }}>{motif}</p>
          </div>
        )}
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: c.doux }}>
          {fin ? t.texteDate : t.texteSansFin} {t.erreur(SUPPORT)}
        </p>
        <p style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: c.note, color: c.noteTexte, fontSize: 14, lineHeight: 1.5 }}>{t.rgpd}</p>
        <a href={`mailto:${SUPPORT}?subject=${encodeURIComponent(t.sujet)}`}
          className="block w-full rounded-xl py-3 text-base font-bold text-white no-underline" style={{ background: ORANGE_LISIBLE }}>
          {t.supportBtn}
        </a>
        <Button variant="secondary" onClick={() => signOut()} className={`${bouton} border`} style={{ background: c.carte, borderColor: c.bord, color: c.texte }}>
          {t.deconnecter}
        </Button>
        <Button variant="secondary" onClick={() => setShowConfirm(true)} className={`${bouton} border`}
          style={{ background: c.carte, borderColor: darkMode ? 'rgba(245,155,155,0.4)' : 'rgba(180,35,24,0.3)', color: c.erreur }}>
          {t.deleteBtn}
        </Button>
      </EcranDuCompte>

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div {...dialogue.proprietes} style={{ background: c.carte, color: c.texte, borderRadius: 16, border: `1.5px solid ${c.bord}`, padding: 24, maxWidth: 340, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.30)' }}>
            <h3 id={dialogue.titreId} style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{t.confirmTitle}</h3>
            <p style={{ fontSize: 14, color: c.doux, margin: '0 0 16px', lineHeight: 1.55 }}>{t.confirmMsg}</p>
            {error && <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: c.erreur, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowConfirm(false)} className="h-auto flex-1 rounded-[10px] border-[1.5px] bg-transparent px-3 py-3 text-sm font-medium" style={{ borderColor: c.bord, color: c.texte }}>
                {t.cancel}
              </Button>
              <Button onClick={handleDelete} loading={deleting} disabled={deleting} className="h-auto flex-1 rounded-[10px] px-3 py-3 text-sm font-bold text-white" style={{ background: '#B42318' }}>
                {t.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
