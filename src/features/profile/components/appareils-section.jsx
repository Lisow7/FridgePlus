import { useState } from 'react'
import { LuSmartphone, LuLogOut } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import Button from '@shared/ui/button'
import ProfileSection from '@features/profile/components/profile-section'

// « Déconnecter tous mes appareils » (décision du 2026-10-08) :
// « Se déconnecter » ne ferme plus que cet appareil ; ici, toutes les sessions du
// compte, celle-ci comprise, et les notifications de tous ses appareils. Textes
// de la maquette validée.
const I18N = {
  fr: {
    titre: 'Appareils',
    texte: 'Un téléphone perdu, une session restée ouverte chez quelqu’un ? Ferme ta session partout, ici compris.',
    bouton: 'Déconnecter tous mes appareils',
    erreur: 'La déconnexion de tes appareils n’a pas abouti. Réessaie.',
  },
  en: {
    titre: 'Devices',
    texte: 'Lost a phone, or left a session open somewhere? Sign out everywhere, including here.',
    bouton: 'Sign out of all my devices',
    erreur: 'Signing out of your devices didn’t go through. Try again.',
  },
}

export default function AppareilsSection({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const { deconnecterTousLesAppareils } = useAuth()
  const [enCours, setEnCours] = useState(false)
  const [echec, setEchec] = useState(false)

  async function toutDeconnecter() {
    setEnCours(true)
    setEchec(false)
    const { error } = await deconnecterTousLesAppareils()
    // Réussie, la session se ferme : la page réservée rend la main à l'accueil.
    if (error) { setEchec(true); setEnCours(false) }
  }

  return (
    <ProfileSection Icon={LuSmartphone} title={t.titre} description={t.texte} lang={lang} darkMode={darkMode}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Button variant="secondary" onClick={toutDeconnecter} loading={enCours} disabled={enCours}
          className="h-auto self-start rounded-lg px-4 py-2.5 text-[13px] font-bold" style={{ gap: 6 }}>
          {!enCours && <LuLogOut size={14} />}
          {t.bouton}
        </Button>
        {echec && <p role="alert" style={{ fontSize: '12px', color: 'var(--color-danger)', margin: 0 }}>{t.erreur}</p>}
      </div>
    </ProfileSection>
  )
}
