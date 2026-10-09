import { useId, useRef } from 'react'
import { LuX } from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useLang } from '@shared/contexts/ui-provider'
import Button from '@shared/ui/button'

// Modale unique pour le panel admin : confirmation, raison, édition.
//
// Pattern simple : title + children + footer optionnel d'actions.
// Backdrop opaque (cohérent avec CookieModal du sprint 0).

const I18N = {
  fr: { close: 'Fermer' },
  en: { close: 'Close' },
}

export default function ReusableModal({
  open,
  title,
  children,
  footer,
  onClose,
  size = 'md',     // 'sm' | 'md' | 'lg'
  darkMode = false,
}) {
  // Focus trap a11y. Important d'appeler le hook avant
  // le early return `if (!open)` pour respecter les règles des hooks.
  const dialogRef = useRef(null)
  const titleId = useId()
  const { lang } = useLang()
  const t = I18N[lang] ?? I18N.fr
  useFocusTrap(dialogRef, { active: open, onEscape: onClose })
  useCloseOnBackButton(open, onClose)

  if (!open) return null

  const widths = { sm: 380, md: 520, lg: 720 }
  const bg = darkMode ? '#0F1925' : '#FFFFFF'
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      // a11y : on référence le <h2> du header (aria-labelledby) plutôt que
      // aria-label={title} — title peut être du JSX (icône + texte) qui
      // donnait un nom accessible « [object Object] ».
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : 'Dialog'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
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
          borderRadius: 14,
          maxWidth: widths[size] ?? widths.md, width: '100%',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        {(title || onClose) && (
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <h2 id={titleId} style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{title ?? ''}</h2>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={t.close}
                className="h-auto w-auto bg-transparent p-1 hover:bg-transparent"
                style={{ color: fg }}
              >
                <LuX size={20} />
              </Button>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '14px 20px', borderTop: `1px solid ${border}`,
            display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
