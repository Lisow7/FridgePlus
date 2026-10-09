import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { LuMenu, LuUser, LuHandHeart } from 'react-icons/lu'
import { useDropdownMenu } from '@shared/hooks/use-dropdown-menu'
import { useAuth } from '@shared/contexts/auth-provider'
import MenuShell from '@shared/ui/menu-shell'
import Tooltip from '@shared/ui/tooltip'
import {
  SIGN_IN_LABEL, COMMUNITY_LABEL,
} from './constants'
import LangThemePrefs from '@shared/ui/lang-theme-prefs'

// GuestMenu — burger mobile/tablette pour les utilisateurs invités.
//
// Sprint 11 — équivalent guest du <UserMenu> (burger loggé) sur les
// breakpoints <1024px. Sur desktop, le layout guest inline reste
// (HelpGuide + Community + Préférences + Se connecter visibles).
//
// Contenu du dropdown :
//   1. Bouton CTA « Se connecter » (action primaire en haut)
//   2. Lien « Communauté » → /community
//   3. Section Langue (radio FR/EN, FR par défaut au lancement)
//   4. Section Thème (toggle dark/light)
//
// Task B5 — MenuShell adoptée (cohérence avec UserMenu) :
//   Mobile (<640) → bottom sheet thumb-friendly (MenuShell)
//   ≥640 → dropdown carte (MenuShell)
//   Communauté convertie en <Link to="/community"> (SEO + a11y + cmd+click)
//
// A11y :
//   - role="menu" + role="menuitem" / role="menuitemradio"
//   - useFocusTrap : Tab piège, Escape ferme + retour focus au trigger
//   - clic outside ferme

const GUEST_MENU_LABEL = {
  fr: 'Menu',
  en: 'Menu',
}

export default function GuestMenu({
  lang = 'fr',
  darkMode = false,
  onLangChange,
  onDarkModeToggle,
  onShowAuth,
}) {
  const { isAdmin } = useAuth()
  const triggerRef = useRef(null)
  const { open, setOpen, menuRef, dropPos } = useDropdownMenu(triggerRef)

  const hoverBg    = darkMode ? '#1A2A3D' : '#F5ECE0'
  const sep        = darkMode ? '#1E2E42' : 'var(--color-border-warm)'
  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = 'var(--color-muted)'

  return (
    <div style={{ position: 'relative' }}>
      <Tooltip text={GUEST_MENU_LABEL[lang] ?? GUEST_MENU_LABEL.fr} darkMode={darkMode} disabled={open}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={GUEST_MENU_LABEL[lang] ?? GUEST_MENU_LABEL.fr}
          aria-expanded={open}
          aria-haspopup="menu"
          style={{
            width: '44px', height: '44px', borderRadius: '11px',
            border: 'none', cursor: 'pointer',
            background: open ? hoverBg : 'transparent',
            color: mutedColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
            padding: 0,
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = hoverBg }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent' }}
        >
          <LuMenu size={22} aria-hidden="true" />
        </button>
      </Tooltip>

      <MenuShell
        ref={menuRef}
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={GUEST_MENU_LABEL[lang] ?? GUEST_MENU_LABEL.fr}
        dropPos={dropPos}
        darkMode={darkMode}
      >
        {/* Padding wrapper — MenuShell dropdown (≥640) has no padding/gap of its own */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>

          {/* ─── 1. CTA Se connecter (action primaire) ──────────────── */}
          <button
            role="menuitem"
            type="button"
            onClick={() => { onShowAuth?.('login'); setOpen(false) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px 14px', borderRadius: '10px',
              border: '1.5px solid rgba(212,106,16,0.45)',
              background: 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.12) 100%)',
              color: 'var(--color-warm-600)',
              cursor: 'pointer',
              fontSize: '14px', fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            <LuUser size={16} aria-hidden="true" />
            {SIGN_IN_LABEL[lang] ?? SIGN_IN_LABEL.fr}
          </button>

          {/* ─── 2. Communauté → /community (SEO + a11y + cmd+click) ─── */}
          <Link
            to="/community"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '10px',
              border: `1.5px solid ${darkMode ? '#1E2E42' : '#E2D8CC'}`,
              background: 'transparent',
              color: textColor,
              cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
              fontFamily: 'inherit',
              textAlign: 'left',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <LuHandHeart size={17} aria-hidden="true" style={{ color: mutedColor }} />
            <span style={{ flex: 1 }}>{COMMUNITY_LABEL[lang] ?? COMMUNITY_LABEL.fr}</span>
          </Link>

          <div role="separator" aria-hidden="true" style={{ height: '1px', background: sep, margin: '4px 0' }} />

          {/* ─── 3 & 4. Langue + Thème (primitive partagée) ──────────── */}
          <LangThemePrefs
            lang={lang}
            onLangChange={onLangChange}
            darkMode={darkMode}
            onDarkModeToggle={() => { onDarkModeToggle?.(); setOpen(false) }}
            isAdmin={isAdmin}
          />
        </div>
      </MenuShell>
    </div>
  )
}
