import { forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'

// Coque de menu partagée. Mobile (<640) : bottom sheet thumb-friendly
// (ancré bas, pleine largeur, actions atteignables au pouce). Tablette/desktop
// (≥640) : dropdown carte positionné via dropPos. Le contenu (sections, items,
// LangThemePrefs) est fourni en children. Le focus-trap/Escape/click-outside
// sont gérés par useDropdownMenu côté appelant (menuRef passé en ref) — vérifié
// le 2026-08-28 : les trois consommateurs réels y passent tous.
const MenuShell = forwardRef(function MenuShell(
  { open, onClose, ariaLabel, dropPos = { top: 0, right: 0 }, darkMode = false, role, children },
  ref,
) {
  const isMobile = useWindowWidth() < 640
  // Le geste retour, lui, n'était géré nulle part. Sur mobile cette coque se
  // déclare `aria-modal` (cf. plus bas) : elle doit alors se comporter comme une
  // modale, sinon le retour Android traverse et quitte la page pendant que le
  // menu reste affiché par-dessus la précédente. En dropdown desktop on ne le
  // capture PAS — intercepter le retour navigateur y serait une surprise.
  //
  // Appelé AVANT le retour anticipé : un hook ne se saute pas.
  useCloseOnBackButton(open && isMobile, onClose)
  if (!open) return null

  const dropBg = darkMode ? '#131E2C' : '#FDFAF6'
  const dropBorder = darkMode ? 'var(--color-dark-border)' : 'rgba(212,106,16,0.20)'
  const resolvedRole = role ?? (isMobile ? 'dialog' : 'menu')

  const sheetStyle = {
    position: 'fixed', left: 0, right: 0,
    // Réserve l'espace du bandeau cookies (cf. use-bottom-inset) : sans ça, la
    // feuille passait SOUS lui et ses items (langue, thème) étaient incliquables.
    bottom: 'var(--fp-bottom-inset, 0px)',
    maxHeight: '85dvh', width: '100vw',
    background: dropBg, borderTop: `1.5px solid ${dropBorder}`,
    borderRadius: '18px 18px 0 0',
    boxShadow: '0 -12px 36px rgba(0,0,0,0.28)',
    padding: '8px 12px calc(16px + env(safe-area-inset-bottom))',
    display: 'flex', flexDirection: 'column', gap: '4px',
    zIndex: 1200, overflowY: 'auto',
    animation: 'sheet-up 0.24s cubic-bezier(0.34,1.1,0.64,1) both',
  }
  const dropdownStyle = {
    position: 'fixed', top: dropPos.top, right: dropPos.right,
    width: 'min(300px, calc(100vw - 24px))',
    background: dropBg, border: `1.5px solid ${dropBorder}`, borderRadius: '14px',
    boxShadow: darkMode
      ? '0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(247,168,94,0.08)'
      : '0 12px 32px rgba(212,106,16,0.18), 0 0 0 1px rgba(212,106,16,0.04)',
    display: 'flex', flexDirection: 'column', zIndex: 1200,
    maxHeight: 'calc(100dvh - 90px)', overflowY: 'auto',
  }

  return createPortal(
    <>
      <style>{`@keyframes sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      {/* Backdrop (mobile : couvre l'écran, clic = ferme) */}
      {isMobile && (
        <div aria-hidden="true" onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 1199, background: 'rgba(0,0,0,0.35)' }} />
      )}
      <div ref={ref} role={resolvedRole} aria-modal={isMobile ? 'true' : undefined} aria-label={ariaLabel}
        style={isMobile ? sheetStyle : dropdownStyle}>
        {/* Sur mobile, la feuille est une fenêtre modale : le MENU est dedans.
            Sans lui, chaque entrée `menuitem` n'avait pas de parent `menu`
            (axe, aria-required-parent — audit A11Y-19). */}
        {isMobile && !role
          ? <div role="menu" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{children}</div>
          : children}
      </div>
    </>,
    document.body,
  )
})

export default MenuShell
