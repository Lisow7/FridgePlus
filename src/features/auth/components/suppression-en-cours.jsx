import { useState } from 'react'
import { useAuth } from '@shared/contexts/auth-provider'
import { useUI } from '@shared/contexts/ui-provider'
import { DELAI_EFFACEMENT_JOURS } from '@shared/lib/compte/delai-d-effacement'
import Button from '@shared/ui/button'
import EcranDuCompte from './ecran-du-compte'
import { couleursDuCompte, dateLongue, ORANGE_LISIBLE } from '../lib/ecrans-du-compte'

// « Ton compte est en cours de suppression » (audit du 2026-10-04, BDD-04 ;
// maquette validée par Antoine le 2026-10-05). À la reconnexion pendant les
// 30 jours : le choix est EXPLICITE. Avant, n'importe quel événement
// d'authentification annulait la suppression sans rien dire.

const I18N = {
  fr: {
    titre: 'Ton compte est en cours de suppression',
    aDroite: 'Compte',
    avant: 'Il sera effacé le ',
    apres: ', avec tes recettes, ton frigo et tes listes.',
    annuler: 'Annuler la suppression',
    annulation: 'Annulation…',
    refus: 'La suppression n’a pas pu être annulée. Vérifie ta connexion, puis réessaie.',
    deconnecter: 'Me déconnecter',
  },
  en: {
    titre: 'Your account is being deleted',
    aDroite: 'Account',
    avant: 'It will be erased on ',
    apres: ', with your recipes, your fridge and your lists.',
    annuler: 'Cancel the deletion',
    annulation: 'Cancelling…',
    refus: 'The deletion could not be cancelled. Check your connection, then try again.',
    deconnecter: 'Sign out',
  },
}

export default function SuppressionEnCours() {
  const { profile, annulerLaSuppression, signOut } = useAuth()
  const { lang, darkMode } = useUI()
  const t = I18N[lang] ?? I18N.fr
  const c = couleursDuCompte(darkMode)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const effaceLe = new Date(new Date(profile.deleted_at).getTime() + DELAI_EFFACEMENT_JOURS * 864e5).toISOString()

  async function annuler() {
    setEnvoi(true)
    setErreur(null)
    const { error } = await annulerLaSuppression()
    if (error) { setErreur(t.refus); setEnvoi(false) }
  }

  return (
    <EcranDuCompte icone="⏳" titre={t.titre} aDroite={t.aDroite} darkMode={darkMode}>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: c.doux, margin: 0 }}>
        {t.avant}<strong style={{ color: c.texte }}>{dateLongue(effaceLe, lang)}</strong>{t.apres}
      </p>
      {erreur && <p role="alert" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: c.erreur }}>{erreur}</p>}
      <Button onClick={annuler} loading={envoi} className="h-auto w-full rounded-xl py-3 text-base font-bold text-white" style={{ background: ORANGE_LISIBLE }}>
        {envoi ? t.annulation : t.annuler}
      </Button>
      <Button variant="secondary" onClick={() => signOut()} disabled={envoi}
        className="h-auto w-full rounded-xl border py-3 text-base font-bold" style={{ background: c.carte, borderColor: c.bord, color: c.texte }}>
        {t.deconnecter}
      </Button>
    </EcranDuCompte>
  )
}
