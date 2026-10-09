import { useState } from 'react'
import { useConsent } from '@shared/hooks/use-consent'
import { useAuth } from '@shared/contexts/auth-provider'
import { revokeCommunityTerms } from '@shared/api/community'
import { I18N } from '../i18n/consent-i18n'
import CookieModal from './cookie-modal'
import Button from '@shared/ui/button'
import { usePushSubscription } from '@features/push-notifications'

// drapeau localStorage UX pour la modale charte communauté
// (cohérent avec CommunityPanel)
const COMMUNITY_TERMS_SEEN_KEY = 'fridge-community-terms-seen'

// Panel intégré dans la modale Profil → onglet « Confidentialité ».
// Affiche les choix actuels + permet de les modifier ou de tout réinitialiser.
//
// Réutilise CookieModal pour l'édition détaillée — un seul endroit où on
// définit l'UI de chaque catégorie.

export default function ConfidentialityPanel({ lang = 'fr', darkMode = false, onShowLegal }) {
  const t = I18N[lang] ?? I18N.fr
  const { consent, hasDecided, reset } = useConsent()
  const { user } = useAuth()
  const [showEdit, setShowEdit] = useState(false)
  const push = usePushSubscription()

  // Le reset complet englobe aussi l'acceptation de la charte
  // communauté (consentement révoqué côté BDD + drapeau localStorage UX
  // effacé pour que la modale réapparaisse au prochain accès).
  const handleResetAll = async () => {
    reset()
    try { localStorage.removeItem(COMMUNITY_TERMS_SEEN_KEY) } catch { /* ignore */ }
    if (user?.id) {
      await revokeCommunityTerms(user.id)
    }
  }

  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const card = darkMode ? '#1A2F48' : '#FAF7F0'

  const lastUpdate = consent.timestamp
    ? new Date(consent.timestamp).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang)
    : '—'

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: muted, margin: 0 }}>
          {t.profileIntro}
        </p>

        {/* Récap des choix actuels */}
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: card, border: `1px solid ${border}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Row label={t.catEssTitle} status={t.statusAlways} fg={fg} muted={muted} statusColor="#5A8A4A" />
          <Row label={t.catFuncTitle} status={consent.functional ? t.statusAccepted : t.statusRefused} fg={fg} muted={muted}
               statusColor={consent.functional ? '#5A8A4A' : '#A05A20'} />
          <Row label={t.catAudTitle} status={consent.audience ? t.statusAccepted : t.statusRefused} fg={fg} muted={muted}
               statusColor={consent.audience ? '#5A8A4A' : '#A05A20'} />
          {push.available && (
            <Row label={t.catPushTitle} status={push.enabled ? t.catPushStatusOn : t.catPushStatusOff} fg={fg} muted={muted}
                 statusColor={push.enabled ? '#5A8A4A' : '#A05A20'} />
          )}
          <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
            {t.profileCurrent} : {hasDecided ? lastUpdate : '—'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            onClick={() => setShowEdit(true)}
            className="h-auto rounded-lg bg-[#E07820] px-4 py-2.5 text-[13px] font-bold text-white">
            {t.btnCustomize}
          </Button>
          {onShowLegal && (
            <Button
              variant="secondary"
              onClick={onShowLegal}
              className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold"
              style={{ borderColor: border, color: fg }}>
              {t.profileSeePolicy}
            </Button>
          )}
        </div>

        {/* Reset */}
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 10,
          background: darkMode ? 'rgba(220,80,40,0.08)' : 'rgba(220,80,40,0.06)',
          border: `1px solid ${darkMode ? 'rgba(220,80,40,0.2)' : 'rgba(220,80,40,0.15)'}`,
        }}>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: muted, margin: '0 0 8px 0' }}>
            {t.profileResetWarn}
          </p>
          <Button
            variant="secondary"
            onClick={handleResetAll}
            className="h-auto rounded-lg border bg-transparent px-3.5 py-2 text-xs font-semibold"
            style={{
              borderColor: darkMode ? '#9C3B1F' : 'var(--color-brand-600)',
              color: darkMode ? 'var(--color-brand-400)' : '#C05A10',
            }}>
            {t.btnReset}
          </Button>
        </div>
      </div>

      {showEdit && (
        <CookieModal
          lang={lang}
          darkMode={darkMode}
          onClose={() => setShowEdit(false)}
          onShowLegal={onShowLegal}
        />
      )}
    </>
  )
}

function Row({ label, status, statusColor, fg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: fg, flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        padding: '2px 8px', borderRadius: 10,
        background: `${statusColor}22`, color: statusColor,
      }}>{status}</span>
    </div>
  )
}
