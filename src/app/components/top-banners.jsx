import { Z_INDEX } from '@shared/lib/z-index'

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
  en: (n) => `Premium trial — ${n} day${n > 1 ? 's' : ''} remaining`,
}
const TRIAL_ACTIVATE_I18N = { fr: 'Activer', en: 'Activate' }

const SUB_ACTIVATED_I18N = {
  fr: '🎉 Bienvenue dans Fridge+ Premium !',
  en: '🎉 Welcome to Fridge+ Premium!',
}

const CLOSE_I18N = { fr: 'Fermer', en: 'Close' }

export default function TopBanners({
  restoreBanner,
  onRestoreBannerDismiss,
  subscriptionActivatedToast,
  showTrialBanner,
  trialDaysLeft,
  onTrialActivate,
  onTrialDismiss,
  lang,
}) {
  return (
    <>
      {/* Banner suite à un retour de lien restore-account. Auto-dismiss
          après 8 s ou clic sur la croix. Affichée par-dessus tout. */}
      {restoreBanner && (
        <div style={{
          position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
          zIndex: Z_INDEX.TOAST, maxWidth: '92%',
          padding: '12px 18px', borderRadius: '12px',
          background: restoreBanner.ok ? '#10b981' : '#ef4444',
          color: 'white', fontWeight: 700, fontSize: '14px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          animation: 'menu-slide-down 0.25s ease both',
        }}>
          <span>{restoreBanner.msg}</span>
          <button
            onClick={onRestoreBannerDismiss}
            aria-label={CLOSE_I18N[lang] ?? CLOSE_I18N.fr}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 4px', display: 'flex', opacity: 0.85 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* v3.130.0 — Toast activation abonnement */}
      {subscriptionActivatedToast && (
        <div style={{
          position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
          zIndex: Z_INDEX.TOAST_HIGH, maxWidth: '92%',
          padding: '12px 20px', borderRadius: '12px',
          background: 'var(--gradient-warm)',
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
            style={{ padding: '3px 10px', borderRadius: '20px', border: '1.5px solid rgba(255,255,255,0.7)', background: 'transparent', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {TRIAL_ACTIVATE_I18N[lang] ?? TRIAL_ACTIVATE_I18N.fr}
          </button>
          <button
            onClick={onTrialDismiss}
            aria-label={CLOSE_I18N[lang] ?? CLOSE_I18N.fr}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: '2px', display: 'flex', marginLeft: '2px' }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
