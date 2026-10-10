import { useEffect, useId, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LuBell } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { usePushSubscription, updatePushPreferences } from '@features/push-notifications'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import Interrupteur from '@shared/ui/interrupteur'
import ProfileSection from '@features/profile/components/profile-section'

// Le bloc « Notifications » de Profil → Préférences (décision du 2026-10-08) :
// l'appareil d'abord (s'abonner, ici), puis les trois envois un par un — ils
// vivaient dans la fenêtre « Cookies et données », allumés d'un seul coup. Le
// serveur les distinguait déjà (`push_preferences` : inactivity_reminder,
// announcements, stock_expiry). « Régler les notifications » (écran vide des
// notifications) mène ici, par l'ancre #notifications. Textes de la maquette.
const ENVOIS = ['inactivity_reminder', 'announcements', 'stock_expiry']

const I18N = {
  fr: {
    titre: 'Notifications sur cet appareil',
    description: 'En dehors de l’app, même fermée.',
    appareil: 'Activer sur cet appareil',
    envois: {
      inactivity_reminder: 'Si tu n’as pas ouvert l’app depuis un moment',
      announcements: 'Annonces de l’équipe',
      stock_expiry: 'Un reste arrive à péremption',
    },
    enregistre: '✓ Enregistré',
    bloque: 'Installe d’abord Fridge+ sur ton écran d’accueil pour activer cette option (contrainte iOS).',
    refuse: 'Ton navigateur bloque les notifications pour fridgeplus.app. Autorise-les dans ses réglages (l’icône à gauche de l’adresse, ou les réglages du téléphone), puis réessaie.',
    lecture: 'L’état des notifications n’a pas pu être lu. Réessaie dans un instant.',
    echec: 'Impossible d’activer les notifications sur ce navigateur. Si tu es dans le navigateur intégré d’une autre app (ex : app Google), essaie d’ouvrir fridgeplus.app directement dans Chrome.',
  },
  en: {
    titre: 'Notifications on this device',
    description: 'Outside the app, even when it’s closed.',
    appareil: 'Enable on this device',
    envois: {
      inactivity_reminder: 'If you haven’t opened the app in a while',
      announcements: 'Team announcements',
      stock_expiry: 'A leftover is about to expire',
    },
    enregistre: '✓ Saved',
    bloque: 'Install Fridge+ to your home screen first to enable this (iOS requirement).',
    refuse: 'Your browser is blocking notifications for fridgeplus.app. Allow them in its settings (the icon left of the address, or the phone’s settings), then try again.',
    lecture: 'The notification status couldn’t be read. Try again in a moment.',
    echec: 'Couldn’t enable notifications in this browser. If you’re in another app’s built-in browser (e.g. the Google app), try opening fridgeplus.app directly in Chrome.',
  },
}

function noteDErreur(push, t) {
  if (push.blocked) return t.bloque
  if (push.error === 'permission_denied') return t.refuse
  if (push.error === 'read_failed') return t.lecture
  return push.error ? t.echec : null
}

function Ligne({ libelle, checked, disabled, onChange }) {
  const id = useId()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <span id={id} style={{ fontSize: '14px', color: 'var(--color-charcoal)' }}>{libelle}</span>
      <Interrupteur checked={checked} disabled={disabled} onChange={onChange} labelledBy={id} />
    </div>
  )
}

export default function NotificationsSection({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const push = usePushSubscription()
  const { profile } = useAuth()
  const signalerEchec = useSaveErrorToast()
  const [choix, setChoix] = useState(null) // ce qui a été basculé ici, en attendant le profil
  const [enregistre, setEnregistre] = useState(false)
  const versIci = useLocation().hash === '#notifications'

  useEffect(() => {
    if (versIci) document.getElementById('notifications')?.scrollIntoView?.({ block: 'start' })
  }, [versIci])

  if (!push.available) return null
  const preferences = { ...(profile?.push_preferences ?? {}), ...(choix ?? {}) }
  const note = noteDErreur(push, t)

  async function basculer(envoi) {
    const valeur = !preferences[envoi]
    setChoix((c) => ({ ...(c ?? {}), [envoi]: valeur }))
    setEnregistre(false)
    const { error } = (await updatePushPreferences({ [envoi]: valeur })) ?? {}
    if (error) {
      setChoix((c) => ({ ...(c ?? {}), [envoi]: !valeur }))
      signalerEchec('setting')
    } else setEnregistre(true)
  }

  return (
    <div id="notifications">
      <ProfileSection Icon={LuBell} title={t.titre} description={t.description} lang={lang} darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Ligne libelle={t.appareil} checked={push.enabled} disabled={push.blocked || push.loading}
            onChange={push.toggle} />
          {note && <p role={push.blocked ? undefined : 'alert'} style={{ fontSize: '13px', margin: 0, color: 'var(--color-danger-text)' }}>{note}</p>}
          {push.enabled && ENVOIS.map((envoi) => (
            <Ligne key={envoi} libelle={t.envois[envoi]} checked={preferences[envoi] === true}
              onChange={() => basculer(envoi)} />
          ))}
          <p role="status" style={{ fontSize: '13px', margin: 0, minHeight: '1em', color: 'var(--color-success-text)' }}>
            {enregistre ? t.enregistre : ''}
          </p>
        </div>
      </ProfileSection>
    </div>
  )
}
