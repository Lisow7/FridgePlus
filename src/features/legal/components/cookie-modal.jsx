import { useRef, useState } from 'react'
import { LuX, LuChevronDown } from 'react-icons/lu'
import { useConsent } from '@shared/hooks/use-consent'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { usePushSubscription } from '@features/push-notifications'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { I18N } from '../i18n/consent-i18n'
import Button from '@shared/ui/button'

// Modale détaillée pour le consentement granulaire (3 catégories).
// Ouverte depuis le bouton « Personnaliser » du bandeau ou depuis le panel
// Profil → Confidentialité.
//
// 3 catégories : Essentiels (toggle désactivé, toujours ON), Fonctionnels,
// Mesure d'audience. Chaque section affiche : titre + badge, description,
// avantages/inconvénients, durée de conservation, vendeurs (si pertinent).

export default function CookieModal({ lang = 'fr', darkMode = false, onClose, onShowLegal }) {
  const t = I18N[lang] ?? I18N.fr
  const { consent, save } = useConsent()
  const push = usePushSubscription()
  const receiptScanEnabled = useFeatureFlag('receipt_scan', false)
  const [draft, setDraft] = useState({
    functional:  consent.functional,
    audience:    consent.audience,
    voice:       consent.voice,
    receiptScan: consent.receiptScan,
  })
  // Focus trap a11y
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  function toggle(key) {
    setDraft(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    save(draft)
    onClose?.()
  }

  const bg = darkMode ? '#0F1925' : '#FFFFFF'
  const card = darkMode ? '#1A2F48' : '#FAF7F0'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.modalTitle ?? 'Cookies'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        // Backdrop plus opaque + blur plus fort pour bien masquer ce qu'il
        // y a derrière (notamment ProfileModal quand on ouvre la modale
        // cookies depuis le panel Confidentialité).
        background: 'rgba(15,8,2,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg, color: fg,
          borderRadius: 16, maxWidth: 560, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t.bannerTitle}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.btnClose}
            className="h-auto w-auto p-1 hover:bg-transparent"
            style={{ color: fg }}
          >
            <LuX size={20} />
          </Button>
        </div>

        {/* Catégories */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Category
            title={t.catEssTitle}
            badge={t.catEssBadge}
            badgeColor="#5A8A4A"
            description={t.catEssDesc}
            retention={t.catEssRetention}
            checked={true}
            disabled
            card={card} fg={fg} muted={muted} border={border}
          />
          <Category
            title={t.catFuncTitle}
            badge={t.catFuncBadge}
            badgeColor="#C05A10"
            description={t.catFuncDesc}
            benefit={t.catFuncBenefit}
            drawback={t.catFuncDrawback}
            retention={t.catFuncRetention}
            checked={draft.functional}
            onToggle={() => toggle('functional')}
            card={card} fg={fg} muted={muted} border={border}
          />
          <Category
            title={t.catAudTitle}
            badge={t.catAudBadge}
            badgeColor="#5A7AAA"
            description={t.catAudDesc}
            benefit={t.catAudBenefit}
            drawback={t.catAudDrawback}
            retention={t.catAudRetention}
            vendors={t.catAudVendors}
            checked={draft.audience}
            onToggle={() => toggle('audience')}
            card={card} fg={fg} muted={muted} border={border}
          />
          <Category
            title={t.catVoiceTitle}
            badge={t.catVoiceBadge}
            badgeColor="#C05A10"
            description={t.catVoiceDesc}
            benefit={t.catVoiceBenefit}
            drawback={t.catVoiceDrawback}
            retention={t.catVoiceRetention}
            vendors={t.catVoiceVendors}
            checked={draft.voice}
            onToggle={() => toggle('voice')}
            card={card} fg={fg} muted={muted} border={border}
          />
          {receiptScanEnabled && (
            <Category
              title={t.catReceiptTitle}
              badge={t.catReceiptBadge}
              badgeColor="#C05A10"
              description={t.catReceiptDesc}
              benefit={t.catReceiptBenefit}
              drawback={t.catReceiptDrawback}
              retention={t.catReceiptRetention}
              vendors={t.catReceiptVendors}
              checked={draft.receiptScan}
              onToggle={() => toggle('receiptScan')}
              card={card} fg={fg} muted={muted} border={border}
            />
          )}
          {push.available && (
            <Category
              title={t.catPushTitle}
              badge={t.catPushBadge}
              badgeColor="#C05A10"
              description={t.catPushDesc}
              benefit={!push.blocked ? t.catPushBenefit : undefined}
              drawback={!push.blocked ? t.catPushDrawback : undefined}
              retention={t.catPushRetention}
              vendors={t.catPushVendors}
              blockedNote={push.blocked ? t.catPushBlocked : (push.error ? t.catPushError : undefined)}
              forceExpanded={push.error}
              checked={push.enabled}
              disabled={push.blocked || push.loading}
              onToggle={push.toggle}
              card={card} fg={fg} muted={muted} border={border}
            />
          )}

          {onShowLegal && (
            <Button
              variant="ghost"
              onClick={() => { onShowLegal(); onClose?.() }}
              className="mt-1 h-auto self-start rounded-none bg-transparent p-0 text-[13px] font-semibold underline hover:bg-transparent"
              style={{ color: darkMode ? 'var(--color-brand-400)' : '#C05A10' }}
            >
              {t.bannerSeeMore} →
            </Button>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '14px 22px', borderTop: `1px solid ${border}`,
          display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap',
        }}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {t.btnClose}
          </Button>
          <Button
            onClick={handleSave}
            className="h-auto rounded-lg bg-[#E07820] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            {t.btnSave}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Accordéon : le header (titre + badge + toggle) est toujours visible et
// cliquable pour déplier ; le détail (description/avantages/durée) est
// masqué par défaut — épure la liste, l'info reste à un clic pour qui veut.
function Category({ title, badge, badgeColor, description, benefit, drawback, retention, vendors, blockedNote, forceExpanded, checked, disabled, onToggle, card, fg, muted, border }) {
  const [expandedState, setExpanded] = useState(false)
  // Une erreur d'activation (ex: push) doit être visible sans action de
  // l'utilisateur — sinon le message reste caché dans l'accordéon replié,
  // aussi silencieux que l'absence de message.
  const expanded = expandedState || Boolean(forceExpanded)

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: card, border: `1px solid ${border}`,
    }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v) } }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <LuChevronDown
          size={16}
          style={{ color: muted, flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none' }}
        />
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, flex: 1, color: fg }}>{title}</h3>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: '2px 8px', borderRadius: 12,
          background: `${badgeColor}22`, color: badgeColor,
        }}>{badge}</span>
        <div onClick={(e) => e.stopPropagation()}>
          <ToggleSwitch checked={checked} disabled={disabled} onChange={onToggle} />
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: muted, margin: 0 }}>
            {description}
          </p>
          {blockedNote && (
            <div style={{ fontSize: 12, fontStyle: 'italic', color: muted, marginTop: 8 }}>{blockedNote}</div>
          )}
          {benefit && (
            <div style={{ fontSize: 12, color: '#5A8A4A', marginTop: 8 }}>{benefit}</div>
          )}
          {drawback && (
            <div style={{ fontSize: 12, color: '#A05A20', marginTop: 2 }}>{drawback}</div>
          )}
          {retention && (
            <div style={{ fontSize: 11, color: muted, marginTop: 8, fontStyle: 'italic' }}>
              ⏱ {retention}
            </div>
          )}
          {vendors && (
            <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{vendors}</div>
          )}
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, disabled, onChange }) {
  return (
    <Button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="relative h-6 w-11 shrink-0 rounded-xl p-0 disabled:opacity-60"
      style={{
        background: checked ? 'var(--color-brand-500)' : '#888',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%',
        background: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </Button>
  )
}
