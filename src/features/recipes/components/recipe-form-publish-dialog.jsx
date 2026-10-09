import { createPortal } from 'react-dom'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'

// Phase 8 launch (refonte Modales) PR 8.8.a. Extraction de
// RecipeFormModal : dialog de confirmation à la publication d'une recette
// dans la communauté. Affiche les 5 critères, demande une checkbox
// d'acquittement avant d'activer le bouton « Publier ».
//
// Pattern createPortal (cf. cancel-dialog) pour échapper au containing
// block CSS du backdrop parent.
//
// R-01 (v0.29) — encart « ce que tu gagnes en publiant » rendu en tête
// du dialog si `t.publishBenefits` est fourni. cf. spec
// la conception « recipe-publish-benefits » du 2026-06-10.

export default function RecipeFormPublishDialog({
  isOpen,
  onCancel,           // ferme le dialog (reset checkbox côté parent)
  onConfirm,          // déclenche la publication (handleConfirmPublish parent)
  acknowledged,       // checkbox acquittement des critères cochée
  onToggleAcknowledged, // (event) => void
  consent,            // R-03 — checkbox consentement explicite à publier cochée
  onToggleConsent,    // (event) => void
  submitting,
  darkMode,
  t,                  // i18n (publishTitle, publishCriteria[], publishNote, publishAck, publishAckHint, publishConsent, publishConsentHint, publishModerationNotice, cancel, publishConfirm, publishBenefitsTitle?, publishBenefits?[])
}) {
  // R-03 — la publication exige les DEUX cases : acquittement + consentement.
  const canPublish = acknowledged && consent
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogue = useDialogue({ onClose: onCancel, actif: isOpen })
  if (!isOpen) return null
  const dm = darkMode
  const benefits = t.publishBenefits ?? []
  return createPortal(
    <div className="fixed inset-0 z-[70]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,10,4,0.50)', backdropFilter: 'blur(4px)' }}>
      <div {...dialogue.proprietes} style={{
        background: dm ? '#131E2C' : '#FDFAF6',
        borderRadius: '16px', padding: '28px 32px',
        maxWidth: '460px', width: '90%',
        maxHeight: '90dvh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
      }}>
        {benefits.length > 0 && (
          <aside
            aria-label={t.publishBenefitsTitle}
            style={{
              background: dm ? '#0F1A28' : '#FFF6E8',
              borderLeft: '3px solid var(--color-brand-500)',
              borderRadius: '8px', padding: '14px',
              margin: '0 0 18px 0',
            }}
          >
            <p style={{
              fontSize: '13px', fontWeight: 800, color: 'var(--color-charcoal)',
              margin: '0 0 8px 0', letterSpacing: '0.02em',
            }}>
              {t.publishBenefitsTitle}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {benefits.map((b, i) => (
                <li key={i} style={{ fontSize: '13px', color: 'var(--color-charcoal)', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: '1.45' }}>
                  <span aria-hidden="true" style={{ flexShrink: 0, fontSize: '15px', lineHeight: 1 }}>{b.emoji}</span>
                  <span><strong style={{ fontWeight: 700 }}>{b.label}</strong> — <span style={{ color: 'var(--color-muted)' }}>{b.detail}</span></span>
                </li>
              ))}
            </ul>
          </aside>
        )}
        <p id={dialogue.titreId} style={{
          fontSize: '17px', fontWeight: 800, color: 'var(--color-charcoal)',
          margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {t.publishTitle}
        </p>
        <ul style={{ margin: '0 0 16px 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {t.publishCriteria.map((c, i) => (
            <li key={i} style={{ fontSize: '15px', color: 'var(--color-charcoal)', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: '1.5' }}>
              <span style={{ color: 'var(--color-brand-500)', fontWeight: 800, flexShrink: 0, marginTop: '1px' }}>·</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <p style={{
          fontSize: '14px', color: 'var(--color-muted)', fontStyle: 'italic',
          margin: '0 0 20px 0', paddingTop: '8px',
          borderTop: dm ? '1px solid #1A2A3D' : '1px solid #EDE4D4',
        }}>
          {t.publishNote}
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={onToggleAcknowledged}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-brand-500)', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}
          />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-charcoal)', lineHeight: '1.4' }}>
            {t.publishAck}
          </span>
        </label>
        {/* v3.20.7 — Hint affiché tant que la case n'est pas cochée :
            rend explicite la raison pour laquelle le bouton est grisé,
            la simple opacity ne suffisant pas en dark mode. */}
        {!acknowledged && (
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', fontStyle: 'italic', margin: '0 0 12px 28px' }}>
            {t.publishAckHint}
          </p>
        )}
        {/* R-03 — consentement explicite à la publication communautaire (CNIL). */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={onToggleConsent}
            style={{ width: '18px', height: '18px', accentColor: 'var(--color-brand-500)', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}
          />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-charcoal)', lineHeight: '1.4' }}>
            {t.publishConsent}
          </span>
        </label>
        {!consent && (
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', fontStyle: 'italic', margin: '0 0 12px 28px' }}>
            {t.publishConsentHint}
          </p>
        )}
        {/* R-03 / F5 — information modération in-flow (sous-traitant OpenAI). */}
        <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 16px 0', lineHeight: '1.45' }}>
          {t.publishModerationNotice}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: canPublish ? '24px' : '8px' }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="h-auto rounded-[10px] border-[1.5px] px-6 py-[11px] text-[15px] font-semibold"
            style={{
              borderColor: dm ? 'var(--color-dark-surface)' : '#E8E0D4',
              color: 'var(--color-charcoal)',
            }}
          >
            {t.cancel}
          </Button>
          <Button
            onClick={onConfirm}
            loading={submitting}
            disabled={!canPublish || submitting}
            className={`h-auto rounded-[10px] px-[30px] py-[11px] text-[15px] font-bold ${canPublish && !submitting ? 'bg-none bg-[#B85000] text-white shadow-[0_4px_16px_rgba(184,80,0,0.30)]' : 'opacity-55'}`}
            style={canPublish && !submitting ? undefined : { background: dm ? 'var(--color-dark-surface)' : '#E8D5B8', color: 'var(--color-muted)' }}
          >
            {t.publishConfirm}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
