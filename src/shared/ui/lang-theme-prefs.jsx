import { LuGlobe, LuPalette, LuSun, LuMoon } from 'react-icons/lu'

// Bloc Préférences partagé : sélecteur de langue (FR/EN) + bascule thème.
// Source UNIQUE — remplace les 3 copies (PreferencesMenu / UserMenu / GuestMenu).
// FR accessible à tous ; les autres langues sont réservées aux admins (gating
// isAdmin) tant que le launch est FR-only.

export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
]

export const FLAGS = {
  fr: (
    <svg width="22" height="16" viewBox="0 0 22 16" style={{ borderRadius: '3px', display: 'block', flexShrink: 0 }}>
      <rect width="7.34" height="16" fill="#002395" />
      <rect x="7.34" width="7.32" height="16" fill="#EDEDED" />
      <rect x="14.66" width="7.34" height="16" fill="#ED2939" />
    </svg>
  ),
  en: (
    <svg width="22" height="16" viewBox="0 0 22 16" style={{ borderRadius: '3px', display: 'block', flexShrink: 0 }}>
      <rect width="22" height="16" fill="#012169" />
      <path d="M0,0 L22,16 M22,0 L0,16" stroke="white" strokeWidth="3.2" />
      <path d="M0,0 L22,16 M22,0 L0,16" stroke="#C8102E" strokeWidth="1.8" />
      <rect x="9.5" width="3" height="16" fill="white" />
      <rect y="6.5" width="22" height="3" fill="white" />
      <rect x="10" width="2" height="16" fill="#C8102E" />
      <rect y="7" width="22" height="2" fill="#C8102E" />
    </svg>
  ),
}

const I18N = {
  fr: { lang: 'Langues', theme: 'Thème', dark: 'Mode sombre', light: 'Mode clair', soon: 'Bientôt disponible' },
  en: { lang: 'Languages', theme: 'Theme', dark: 'Dark mode', light: 'Light mode', soon: 'Coming soon' },
}

export default function LangThemePrefs({
  lang = 'fr',
  onLangChange,
  darkMode = false,
  onDarkModeToggle,
}) {
  const t = I18N[lang] ?? I18N.fr
  const muted = 'var(--color-muted)'
  const hoverBg = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(212,106,16,0.07)'
  const borderIdle = darkMode ? 'var(--color-dark-border)' : '#E2D8CC'

  return (
    <div>
      {/* Langue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px 8px', fontSize: '13px', fontWeight: 600, color: muted }}>
        <LuGlobe size={15} aria-hidden="true" />
        <span>{t.lang}</span>
      </div>
      {/* `group` et non `radiogroup` : des `menuitemradio` n'admettent que
          menu, menubar ou group pour parent (axe, aria-required-parent — A11Y-19). */}
      <div role="group" aria-label={t.lang} style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {LANGUAGES.map(({ code, label }) => {
          const isActive = lang === code
          // Launch bilingue FR+EN : EN accessible à tous (2026-06-16).
          const accessible = true
          return (
            <button
              key={code}
              role="menuitemradio"
              aria-checked={isActive}
              onClick={accessible ? () => onLangChange?.(code) : undefined}
              disabled={!accessible}
              title={accessible ? label : t.soon}
              aria-label={accessible ? label : `${label} — ${t.soon}`}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                padding: '10px 4px 8px', borderRadius: '8px',
                border: isActive
                  ? '1.5px solid var(--color-warm-400)'
                  : accessible ? `1.5px solid ${borderIdle}` : `1.5px dashed ${darkMode ? '#2E4055' : '#C8BFB4'}`,
                cursor: accessible ? 'pointer' : 'not-allowed',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.10) 100%)'
                  : 'transparent',
                opacity: accessible ? 1 : 0.6, position: 'relative', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (accessible && !isActive) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { if (accessible && !isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {FLAGS[code]}
              <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: isActive ? 'var(--color-warm-600)' : muted }}>
                {code}
              </span>
              {!accessible && (
                <span aria-hidden="true" style={{ fontSize: '9px', lineHeight: 1, color: darkMode ? 'rgba(180,160,140,0.70)' : 'rgba(120,90,60,0.55)' }}>🔒</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Thème */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px 8px', fontSize: '13px', fontWeight: 600, color: muted }}>
        <LuPalette size={15} aria-hidden="true" />
        <span>{t.theme}</span>
      </div>
      <button
        role="menuitem"
        onClick={() => onDarkModeToggle?.()}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '11px',
          padding: '11px 14px', borderRadius: '8px', border: `1.5px solid ${borderIdle}`,
          cursor: 'pointer', background: 'transparent', color: darkMode ? 'var(--color-bg-warm)' : 'var(--color-charcoal)',
          fontSize: '13px', fontWeight: 600, transition: 'background 0.15s', fontFamily: 'inherit',
        }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {darkMode
          ? <LuSun size={16} aria-hidden="true" style={{ color: '#C8A850', flexShrink: 0 }} />
          : <LuMoon size={16} aria-hidden="true" style={{ color: muted, flexShrink: 0 }} />}
        <span>{darkMode ? t.light : t.dark}</span>
      </button>
    </div>
  )
}
