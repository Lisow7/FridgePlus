import { createPortal } from 'react-dom'

// Bulle portail (position:fixed) positionnée par `pos` (calculé via le hook
// useAnchoredPopover de @shared/hooks/use-anchored-popover). Ne rend rien si !pos.
// Rendu dans document.body → jamais rognée par un conteneur scrollable.

// `onMouseEnter` / `onMouseLeave` : la bulle se laisse survoler (WCAG 1.4.13 ;
// audit du 2026-10-04, A11Y-22) — l'appelant y annule ou programme sa fermeture.
export function AnchoredBubble({ pos, children, popRef, id, role = 'tooltip', darkMode = false, style, onMouseEnter, onMouseLeave }) {
  if (!pos) return null
  const bg = darkMode ? '#2A2A2A' : '#FFFFFF'
  const border = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const color = darkMode ? '#ECECEC' : '#1A1A1A'
  return createPortal(
    <span
      ref={popRef}
      id={id}
      role={role}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: `${pos.left}px`,
        ...(pos.placement === 'above' ? { bottom: `${pos.bottom}px` } : { top: `${pos.top}px` }),
        zIndex: 2000,
        width: `${pos.width}px`,
        maxHeight: `${Math.max(80, pos.maxH)}px`,
        overflowY: 'auto',
        background: bg, color, border: `1px solid ${border}`,
        borderRadius: '10px', padding: '10px 12px',
        boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.14)',
        fontSize: '13px', lineHeight: 1.5, fontWeight: 400,
        textAlign: 'left', whiteSpace: 'normal', fontStyle: 'normal',
        WebkitOverflowScrolling: 'touch',
        ...style,
      }}
    >
      {children}
    </span>,
    document.body,
  )
}
