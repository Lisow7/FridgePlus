import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'
import { useUI } from '@shared/contexts/ui-provider'
import Button from '@shared/ui/button'
import EcranDuCompte from './ecran-du-compte'
import { couleursDuCompte, dateLongue, ORANGE_LISIBLE } from '../lib/ecrans-du-compte'

// « Compte désactivé » (audit du 2026-10-04, CPT-04 ; maquette validée par
// Antoine le 2026-10-05). Il n'existait AUCUN message de succès : la page se
// vidait et renvoyait à l'accueil, sans un mot sur les 30 jours.

const I18N = {
  fr: {
    titre: 'Compte désactivé',
    avant: 'Tes données seront effacées le ',
    apres: '. Pour annuler, reconnecte-toi avant cette date.',
    email: 'Un e-mail de confirmation, avec un lien d’annulation, vient de partir.',
    accueil: 'Retour à l’accueil',
  },
  en: {
    titre: 'Account deactivated',
    avant: 'Your data will be erased on ',
    apres: '. To cancel, sign back in before that date.',
    email: 'A confirmation email, with a cancellation link, has just been sent.',
    accueil: 'Back to home',
  },
}

export default function CompteDesactive() {
  const { compteDesactive, oublierCompteDesactive } = useAuth()
  const { lang, darkMode } = useUI()
  const t = I18N[lang] ?? I18N.fr
  const c = couleursDuCompte(darkMode)
  const naviguer = useNavigate()

  return (
    <EcranDuCompte icone="✓" titre={t.titre} darkMode={darkMode}>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: c.doux, margin: 0 }}>
        {t.avant}<strong style={{ color: c.texte }}>{dateLongue(compteDesactive.effaceLe, lang)}</strong>{t.apres}
      </p>
      <p style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: c.note, color: c.noteTexte, fontSize: 14, lineHeight: 1.5 }}>{t.email}</p>
      <Button onClick={() => { oublierCompteDesactive(); naviguer('/', { replace: true }) }}
        className="h-auto w-full rounded-xl py-3 text-base font-bold text-white" style={{ background: ORANGE_LISIBLE }}>
        {t.accueil}
      </Button>
    </EcranDuCompte>
  )
}
