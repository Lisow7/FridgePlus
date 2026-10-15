import { useId, useRef, useState } from 'react'
import { LuX, LuChevronDown } from 'react-icons/lu'
import { useConsent } from '@shared/hooks/use-consent'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { I18N } from '../i18n/consent-i18n'
import { CATEGORIES } from '../i18n/consent-categories-i18n'
import Button from '@shared/ui/button'
import Interrupteur from '@shared/ui/interrupteur'

// Modale détaillée pour le consentement granulaire.
// Ouverte depuis le bouton « Personnaliser » du bandeau ou depuis le panel
// Profil → Confidentialité.
//
// Essentiels (toujours actifs), puis deux cases séparées (consentement v2,
// décision du 2026-10-06) : Rapports d'erreurs (Sentry) et Statistiques
// d'usage. Puis les accords d'usage (micro, photo). Chaque section : titre + badge, description,
// avantages/inconvénients, durée de conservation, vendeurs (si pertinent).
// Les notifications n'y sont plus (décision du 2026-10-08) : un interrupteur
// qui agissait tout de suite, au milieu de choix qui attendent « Enregistrer
// mes choix ». Elles se règlent dans Profil → Préférences.

// Texte des badges de catégorie : la teinte pleine plafonnait sous 4,5:1 sur
// son propre fond teinté (3,3 à 4,3 en clair, 2,2 à 2,9 en sombre) — décision
// du 2026-10-06, « couleurs = profond ». [clair, sombre].
const TEXTE_BADGE = {
  '#5A8A4A': ['#49703C', '#8AAC7E'],
  '#5A7AAA': ['#4C668F', '#8FA5C5'],
  '#7A5AAA': ['#7456A2', '#AB97C9'],
  '#C05A10': ['#A14C0D', '#D48F5C'],
}

export default function CookieModal({ lang = 'fr', darkMode = false, onClose, onShowLegal }) {
  const t = { ...(I18N[lang] ?? I18N.fr), ...(CATEGORIES[lang] ?? CATEGORIES.fr) }
  const { consent, save } = useConsent()
  const receiptScanEnabled = useFeatureFlag('receipt_scan', false)
  const [draft, setDraft] = useState({
    errors:      consent.errors,
    usage:       consent.usage,
    voice:       consent.voice,
    receiptScan: consent.receiptScan,
  })
  // Focus trap a11y
  const dialogRef = useRef(null)
  // La fenêtre se nomme par son titre visible (« 🍪 Cookies et données ») ;
  // elle s'annonçait « Cookies », un repli sur une clé qui n'existait pas.
  const titreId = useId()
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
      aria-labelledby={titreId}
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
          maxHeight: '90dvh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 id={titreId} style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t.bannerTitle}</h2>
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

            badgeText={TEXTE_BADGE['#5A8A4A']?.[darkMode ? 1 : 0]}
            description={t.catEssDesc}
            retention={t.catEssRetention}
            checked={true}
            disabled
            card={card} fg={fg} muted={muted} border={border}
          />
          <Category
            title={t.catErrTitle}
            badge={t.catErrBadge}
            badgeColor="#5A7AAA"

            badgeText={TEXTE_BADGE['#5A7AAA']?.[darkMode ? 1 : 0]}
            description={t.catErrDesc}
            benefit={t.catErrBenefit}
            drawback={t.catErrDrawback}
            retention={t.catErrRetention}
            vendors={t.catErrVendors}
            checked={draft.errors}
            onToggle={() => toggle('errors')}
            card={card} fg={fg} muted={muted} border={border}
          />
          <Category
            title={t.catUsageTitle}
            badge={t.catUsageBadge}
            badgeColor="#7A5AAA"

            badgeText={TEXTE_BADGE['#7A5AAA']?.[darkMode ? 1 : 0]}
            description={t.catUsageDesc}
            benefit={t.catUsageBenefit}
            drawback={t.catUsageDrawback}
            retention={t.catUsageRetention}
            vendors={t.catUsageVendors}
            checked={draft.usage}
            onToggle={() => toggle('usage')}
            card={card} fg={fg} muted={muted} border={border}
          />
          <Category
            title={t.catVoiceTitle}
            badge={t.catVoiceBadge}
            badgeColor="#C05A10"

            badgeText={TEXTE_BADGE['#C05A10']?.[darkMode ? 1 : 0]}
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

              badgeText={TEXTE_BADGE['#C05A10']?.[darkMode ? 1 : 0]}
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

          {onShowLegal && (
            <Button
              variant="ghost"
              onClick={() => { onShowLegal(); onClose?.() }}
              className="mt-1 h-auto self-start rounded-none bg-transparent p-0 text-[13px] font-semibold underline hover:bg-transparent"
              style={{ color: darkMode ? 'var(--color-brand-400)' : '#B85000' }}
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
            className="h-auto rounded-lg bg-[#B85000] px-4 py-2.5 text-[13px] font-bold text-white"
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
// Le refus du navigateur (« Bloquer ») est un réglage à changer, pas une panne ; une
// lecture de l'état qui échoue n'accuse pas le navigateur (CPT-15 (4)).
function Category({ title, badge, badgeColor, badgeText, description, benefit, drawback, retention, vendors, blockedNote, forceExpanded, checked, disabled, onToggle, card, fg, muted, border }) {
  const [expandedState, setExpanded] = useState(false)
  // Une erreur d'activation (ex: push) doit être visible sans action de
  // l'utilisateur — sinon le message reste caché dans l'accordéon replié,
  // aussi silencieux que l'absence de message.
  const expanded = expandedState || Boolean(forceExpanded)
  const idTitre = useId()

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: card, border: `1px solid ${border}`,
    }}>
      {/* Un vrai bouton (dans le titre) déplie la catégorie, et l'interrupteur
          est son voisin, plus son enfant : l'en-tête entier était un
          `role="button"` qui avalait Espace et Entrée — sur l'interrupteur, ils
          repliaient l'accordéon au lieu de changer le consentement. Et
          l'interrupteur porte le nom de la catégorie (audit du 2026-10-04,
          A11Y-04 et A11Y-05). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, flex: 1, color: fg }}>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'none', border: 0, padding: 0, margin: 0,
              cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit',
            }}
          >
            <LuChevronDown
              size={16}
              aria-hidden="true"
              style={{ color: muted, flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none' }}
            />
            <span id={idTitre}>{title}</span>
          </button>
        </h3>
        <span style={{
          fontSize: 11, fontWeight: 700,
          padding: '2px 8px', borderRadius: 12,
          background: `${badgeColor}22`, color: badgeText ?? badgeColor,
        }}>{badge}</span>
        <Interrupteur checked={checked} disabled={disabled} onChange={onToggle} labelledBy={idTitre} />
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

