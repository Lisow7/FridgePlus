import { LuImageOff } from 'react-icons/lu'

const I18N = {
  fr: { count: (n) => `${n} sans image`, toggle: 'Sans image uniquement', badge: 'Sans image' },
  en: { count: (n) => `${n} without image`, toggle: 'Without image only', badge: 'No image' },
}

// Compteur + bascule de filtre « recettes sans image », réutilisé par les
// sections admin base & communauté. Sobre, tokens de marque.
export function MissingImageControls({ count = 0, active = false, onToggle, lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr
  if (!count) return null
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--color-warm-600)' }}>
        <LuImageOff size={14} aria-hidden="true" />
        {t.count(count)}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        style={{
          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
          border: `1.5px solid ${active ? 'var(--color-warm-600)' : 'var(--color-border-warm)'}`,
          background: active ? 'rgba(212,106,16,0.12)' : 'transparent',
          color: active ? 'var(--color-warm-600)' : 'var(--color-muted)',
          fontFamily: 'inherit',
        }}
      >
        {t.toggle}
      </button>
    </div>
  )
}

export function MissingImageBadge({ lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      padding: '2px 6px', borderRadius: 5,
      background: 'rgba(212,106,16,0.12)', color: 'var(--color-warm-600)', whiteSpace: 'nowrap',
    }}>
      <LuImageOff size={11} aria-hidden="true" />
      {t.badge}
    </span>
  )
}
