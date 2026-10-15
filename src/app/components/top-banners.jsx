import { Z_INDEX } from '@shared/lib/z-index'
import { CIBLE_MINIMALE } from '@shared/lib/cible-minimale'
import { suffixS } from '@shared/lib/i18n/pluralize'
import { CENTRE_EN_HAUT, ALERTE_DU_HAUT, BOUTON_DU_HAUT, CROIX_DU_HAUT } from '@app/components/bandeau-du-haut'

// Composant orchestrant les 3 bandeaux top-of-app : retour restore-
// account (succès/erreur auto-dismiss 8s), activation abonnement
// Premium (toast court), bandeau essai Premium en cours (sticky avec
// CTAs Activer + Fermer). Sprint 10 S10.a.21 — extrait depuis App.jsx.
//
// Les 3 sont positionnés au top de l'écran. Restore et SubActivated
// sont en `position: fixed` (par-dessus tout, sans pousser le
// contenu), Trial est en `position: sticky` (pousse le contenu pour
// rester visible au scroll).

const TRIAL_BANNER_I18N = {
  fr: (n) => `Essai Premium — ${n} jour${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`,
  en: (n) => `Premium trial — ${n} day${suffixS(n, 'en')} remaining`,
}
const TRIAL_ACTIVATE_I18N = { fr: 'Activer', en: 'Activate' }

const SUB_ACTIVATED_I18N = {
  fr: '🎉 Bienvenue dans Fridge+ Premium !',
  en: '🎉 Welcome to Fridge+ Premium!',
}

const CLOSE_I18N = { fr: 'Fermer', en: 'Close' }

// Le profil n'a pas pu être lu malgré les tentatives (audit du 2026-10-04,
// CPT-12) : jusqu'ici la personne restait « connectée sans profil » sans un mot.
const PROFIL_INDISPONIBLE_I18N = {
  fr: { msg: 'Ton profil n’a pas pu être chargé.', retry: 'Réessayer' },
  en: { msg: 'Your profile couldn’t be loaded.', retry: 'Retry' },
}

function BandeauProfilIndisponible({ lang, onRelancer }) {
  const t = PROFIL_INDISPONIBLE_I18N[lang] ?? PROFIL_INDISPONIBLE_I18N.fr
  return (
    <div role="alert" style={ALERTE_DU_HAUT}>
      <span style={{ lineHeight: 1.45 }}>{t.msg}</span>
      <button
        type="button"
        onClick={onRelancer}
        style={BOUTON_DU_HAUT}
      >
        {t.retry}
      </button>
    </div>
  )
}

export default function TopBanners({
  restoreBanner,
  onRestoreBannerDismiss,
  subscriptionActivatedToast,
  showTrialBanner,
  trialDaysLeft,
  onTrialActivate,
  onTrialDismiss,
  profilIndisponible,
  onRelancerLeProfil,
  lang,
}) {
  return (
    <>
      {/* Bandeau d'un lien reçu par e-mail : restauration de compte (fermé
          seul après 8 s) ou lien de connexion qui n'aboutit pas (reste jusqu'au
          clic sur la croix). Affiché par-dessus tout, et annoncé aux lecteurs
          d'écran : c'est la seule réponse que reçoit la personne. */}
      {restoreBanner && (
        <div role={restoreBanner.ok ? 'status' : 'alert'} style={{
          ...ALERTE_DU_HAUT,
          background: restoreBanner.ok ? '#10b981' : '#ef4444',
        }}>
          <span style={{ lineHeight: 1.45 }}>{restoreBanner.msg}</span>
          <button
            onClick={onRestoreBannerDismiss}
            aria-label={CLOSE_I18N[lang] ?? CLOSE_I18N.fr}
            style={CROIX_DU_HAUT}
          >
            ✕
          </button>
        </div>
      )}

      {/* Profil illisible après les tentatives : une alerte, et « Réessayer »
          relance la lecture (audit du 2026-10-04, CPT-12). */}
      {profilIndisponible && <BandeauProfilIndisponible lang={lang} onRelancer={onRelancerLeProfil} />}

      {/* v3.130.0 — Toast activation abonnement */}
      {subscriptionActivatedToast && (
        <div style={{
          ...CENTRE_EN_HAUT,
          zIndex: Z_INDEX.TOAST_HIGH,
          padding: '12px 20px', borderRadius: '12px',
          background: 'var(--gradient-deep)',
          color: 'white', fontWeight: 700, fontSize: '14px',
          boxShadow: '0 6px 20px rgba(212,106,16,0.45)',
          animation: 'menu-slide-down 0.25s ease both',
          whiteSpace: 'nowrap',
        }}>
          {SUB_ACTIVATED_I18N[lang] ?? SUB_ACTIVATED_I18N.fr}
        </div>
      )}

      {/* v3.130.0 — Bandeau essai Premium (fin de session) */}
      {showTrialBanner && (
        <div style={{
          position: 'sticky', top: 0, zIndex: Z_INDEX.STICKY_HEADER,
          background: '#B85000',
          color: 'white', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          padding: '7px 14px',
          animation: 'menu-slide-down 0.2s ease both',
        }}>
          <span>{(TRIAL_BANNER_I18N[lang] ?? TRIAL_BANNER_I18N.fr)(trialDaysLeft)}</span>
          <button
            onClick={onTrialActivate}
            style={{ ...CIBLE_MINIMALE, padding: '3px 10px', borderRadius: '20px', border: '1.5px solid rgba(255,255,255,0.7)', background: 'transparent', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {TRIAL_ACTIVATE_I18N[lang] ?? TRIAL_ACTIVATE_I18N.fr}
          </button>
          <button
            onClick={onTrialDismiss}
            aria-label={CLOSE_I18N[lang] ?? CLOSE_I18N.fr}
            style={{ ...CIBLE_MINIMALE, background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: '2px', marginLeft: '2px' }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
