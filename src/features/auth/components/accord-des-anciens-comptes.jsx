import { useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'
import { useDialogue } from '@shared/hooks/use-dialogue'
import Button from '@shared/ui/button'

// « Confirme ton accord » — décision du 2026-10-07, choix d'Antoine.
// Les comptes créés avant le 4 octobre n'ont aucune date d'accord aux
// conditions (aucun des 8 n'en avait). À leur prochaine connexion, cette
// fenêtre s'ouvre par-dessus l'app (« fenetre ») et le redemande une fois : la
// case cochée, `record_signup_consent` écrit la date côté base — la même
// fonction qu'à l'inscription — et la fenêtre ne revient plus.
//
// Qui refuse peut se déconnecter ou supprimer son compte
// (« deconnexion_ou_suppression ») : le droit d'effacer ne dépend pas de
// l'accord, et la page Compte, comme les pages légales, reste lisible sans
// fenêtre par-dessus. Échap ne ferme rien : il faut choisir.
//
// Montée par `global-overlays` (chargée à la demande : seuls ces comptes en
// ont besoin), une fois les cookies tranchés.

const I18N = {
  fr: {
    titre: 'Confirme ton accord',
    texte: 'Ton compte a été créé avant que Fridge+ enregistre la date des accords aux conditions. Coche la case une fois pour continuer.',
    avant: 'J’ai au moins 16 ans et j’accepte les ',
    conditions: 'Conditions Générales d’Utilisation',
    milieu: ' et la ',
    politique: 'Politique de confidentialité',
    apres: '.',
    continuer: 'Continuer',
    erreurCase: 'Pour continuer, coche la case : âge (16 ans minimum), conditions et politique de confidentialité.',
    erreurEnregistrement: 'Ton accord n’a pas pu être enregistré. Réessaie dans un instant.',
    deconnexion: 'Se déconnecter',
    supprimer: 'Supprimer mon compte',
  },
  en: {
    titre: 'Confirm your agreement',
    texte: 'Your account was created before Fridge+ recorded the date of agreements to its terms. Tick the box once to continue.',
    avant: 'I am at least 16 years old and I accept the ',
    conditions: 'Terms of Service',
    milieu: ' and the ',
    politique: 'Privacy Policy',
    apres: '.',
    continuer: 'Continue',
    erreurCase: 'To continue, tick the box: age (16+), terms and privacy policy.',
    erreurEnregistrement: 'Your agreement could not be saved. Try again in a moment.',
    deconnexion: 'Sign out',
    supprimer: 'Delete my account',
  },
}

// Là où la fenêtre ne s'ouvre pas : de quoi lire ce qu'on accepte, de quoi
// supprimer son compte sans l'accepter, et de quoi signaler un obstacle
// (`/accessibilite` : une fenêtre bloquante ne doit pas se poser sur elle).
const PAGES_LIBRES = ['/legal', '/profile/compte', '/suppression-compte', '/accessibilite']

export default function AccordDesAnciensComptes({ lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr
  const { recordSignupConsent, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const caseId = useId()
  const [coche, setCoche] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const libre = PAGES_LIBRES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const dialogue = useDialogue({ actif: !libre })

  if (libre) return null

  async function continuer() {
    if (!coche) { setErreur(t.erreurCase); return }
    setEnCours(true)
    setErreur(null)
    const { error } = await recordSignupConsent()
    setEnCours(false)
    // Réussi : le profil porte maintenant sa date, et `global-overlays` cesse
    // de monter la fenêtre.
    if (error) setErreur(t.erreurEnregistrement)
  }

  const lien = { color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 fp-modal-backdrop" style={{ background: 'rgba(18,10,4,0.55)' }}>
      <div
        {...dialogue.proprietes}
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: 'var(--dropdown-bg)', color: 'var(--color-charcoal)', boxShadow: '0 18px 44px rgba(0,0,0,0.30)' }}
      >
        <h2 id={dialogue.titreId} className="text-lg font-extrabold m-0">{t.titre}</h2>
        <p className="text-sm m-0" style={{ color: 'var(--color-muted)' }}>{t.texte}</p>
        <div className="flex items-start gap-2 text-sm">
          <input id={caseId} type="checkbox" checked={coche} onChange={(e) => { setCoche(e.target.checked); setErreur(null) }}
            className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: '#B85000' }} />
          <label htmlFor={caseId}>
            {t.avant}
            <Link to="/legal#terms" target="_blank" rel="noopener" style={lien}>{t.conditions}</Link>
            {t.milieu}
            <Link to="/legal#privacy" target="_blank" rel="noopener" style={lien}>{t.politique}</Link>
            {t.apres}
          </label>
        </div>
        {erreur && <p role="alert" className="text-sm font-semibold m-0" style={{ color: 'var(--color-danger-text)' }}>{erreur}</p>}
        <Button onClick={continuer} loading={enCours} className="h-auto w-full rounded-xl bg-[#B85000] px-4 py-3 text-sm font-bold text-white">
          {t.continuer}
        </Button>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          <Button variant="ghost" onClick={() => signOut()} className="h-auto px-1 py-1 underline hover:bg-transparent" style={{ color: 'var(--color-muted)' }}>
            {t.deconnexion}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/profile/compte')} className="h-auto px-1 py-1 underline hover:bg-transparent" style={{ color: 'var(--color-muted)' }}>
            {t.supprimer}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
