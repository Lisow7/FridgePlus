import { useRef } from 'react'
import { LuSettings } from 'react-icons/lu'
import { useDropdownMenu } from '@shared/hooks/use-dropdown-menu'
import { useAuth } from '@shared/contexts/auth-provider'
import LangThemePrefs from '@shared/ui/lang-theme-prefs'
import Tooltip from '@shared/ui/tooltip'

// Menu Préférences regroupant Langue + Thème.
//
// Pourquoi un menu plutôt que deux boutons en ligne : l'utilisateur a
// rarement besoin de les changer (settings persistés), donc les sortir
// du visuel principal allège le header. Ils restent à 1 clic, comme
// avant, mais ne polluent plus l'espace de tête.
//
// A11y :
// - aria-expanded/haspopup sur le trigger
// - role="menu" + role="menuitemradio" pour la sélection langue
// (groupe radio sémantiquement)
// - useFocusTrap : Tab piège, Escape ferme + retour focus au trigger
// - clic outside ferme

const PREFS_LABEL = {
 fr: 'Préférences', en: 'Preferences'
}

export default function PreferencesMenu({
 lang = 'fr',
 onLangChange,
 darkMode = false,
 onDarkModeToggle,
}) {
 const { isAdmin } = useAuth()
 const triggerRef = useRef(null)
 const { open, setOpen, menuRef } = useDropdownMenu(triggerRef)

 const hoverBg = darkMode ? 'var(--color-dark-surface)' : '#F5ECE0'
 const dropBg = darkMode ? '#131E2C' : '#FDFAF6'
 const dropBorder = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'

 return (
 <div style={{ position: 'relative' }}>
 <Tooltip text={PREFS_LABEL[lang] ?? PREFS_LABEL.fr} darkMode={darkMode} disabled={open}>
 <button
 ref={triggerRef}
 onClick={() => setOpen(v => !v)}
 aria-label={PREFS_LABEL[lang] ?? PREFS_LABEL.fr}
 aria-expanded={open}
 aria-haspopup="menu"
 style={{
 width: '44px', height: '44px', borderRadius: '11px',
 border: 'none', cursor: 'pointer',
 background: open ? hoverBg : 'transparent',
 color: 'var(--color-muted)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 transition: 'background 0.15s',
 }}
 onMouseEnter={e => { if (!open) e.currentTarget.style.background = hoverBg }}
 onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
 >
 <LuSettings size={20} aria-hidden="true" />
 </button>
 </Tooltip>

 {open && (
 <div
 ref={menuRef}
 role="menu"
 aria-label={PREFS_LABEL[lang] ?? PREFS_LABEL.fr}
 style={{
 position: 'absolute', top: 'calc(100% + 8px)', right: 0,
 minWidth: '240px',
 background: dropBg,
 border: `1.5px solid ${dropBorder}`,
 borderRadius: '12px',
 boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
 padding: '10px',
 display: 'flex', flexDirection: 'column', gap: '4px',
 zIndex: 200,
 }}
 >
 <LangThemePrefs
 lang={lang}
 onLangChange={onLangChange}
 darkMode={darkMode}
 onDarkModeToggle={() => { onDarkModeToggle?.(); setOpen(false) }}
 isAdmin={isAdmin}
 />
 </div>
 )}
 </div>
 )
}
