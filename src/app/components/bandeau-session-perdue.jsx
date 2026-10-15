import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'
import { useLang } from '@shared/contexts/ui-provider'
import { ALERTE_DU_HAUT, BOUTON_DU_HAUT, CROIX_DU_HAUT } from '@app/components/bandeau-du-haut'

// La session s'est fermée sans geste d'ici — expirée, ou fermée depuis un autre
// appareil (décision du 2026-10-08) : le bandeau du haut le
// dit, jusqu'à ce qu'on le ferme. Une déconnexion voulue n'affiche rien (le
// fournisseur d'auth fait la différence). Monté à côté de <App />, comme
// <AccountSync /> : App.jsx ne grossit plus.
const I18N = {
  fr: { message: 'Ta session a expiré. Reconnecte-toi pour retrouver ton frigo.', reconnecter: 'Me reconnecter', fermer: 'Fermer' },
  en: { message: 'Your session has expired. Sign in again to get your fridge back.', reconnecter: 'Sign in again', fermer: 'Close' },
}

export default function BandeauSessionPerdue() {
  const { user, sessionPerdue, oublierLaSessionPerdue } = useAuth()
  const { lang } = useLang()
  const naviguer = useNavigate()
  const location = useLocation()
  if (!sessionPerdue || user) return null
  const t = I18N[lang] ?? I18N.fr

  return (
    <div role="alert" style={ALERTE_DU_HAUT}>
      <span style={{ lineHeight: 1.45 }}>{t.message}</span>
      {/* La connexion ramènera ici (RedirectIfAuthGuard lit `state.from`). */}
      <button type="button" style={BOUTON_DU_HAUT}
        onClick={() => { oublierLaSessionPerdue(); naviguer('/login', { state: { from: location } }) }}>
        {t.reconnecter}
      </button>
      <button type="button" onClick={oublierLaSessionPerdue} aria-label={t.fermer} style={CROIX_DU_HAUT}>
        ✕
      </button>
    </div>
  )
}
