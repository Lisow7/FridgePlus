import { useState } from 'react'
import { LuChevronDown } from 'react-icons/lu'
import ProfileSectionBadge from './profile-section-badge'

// ProfileSection — wrapper visuel d'une section dans une sous-page Profile.
// Sprint 11 — pattern UI commun de la refonte UX (cf. spec §3.2).
//
// Variantes :
//   - Par défaut : section toujours visible (header + children).
//   - `collapsible={true}` : section pliable (header cliquable + chevron).
//     `defaultOpen={false}` par défaut (replié à l'arrivée). Réduit la
//     densité visuelle des pages chargées (cf. Compte & sécurité).
//
// Structure :
//   ┌──────────────────────────────────────┐
//   │ [Icon] Titre [Badge]    [▾ si collap]│
//   │        Description sur 1-2 lignes.    │
//   │ ──────────────────────────────       │
//   │ {children} (caché si collapsed)       │
//   └──────────────────────────────────────┘

export default function ProfileSection({
  Icon,
  title,
  description,
  badge,
  tone = 'normal',     // 'normal' | 'danger'
  lang = 'fr',
  darkMode = false,
  collapsible = false,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'
  const border     = tone === 'danger'
    ? 'rgba(220,38,38,0.35)'
    : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
  const bg = tone === 'danger'
    ? (darkMode ? 'rgba(220,38,38,0.04)' : 'rgba(220,38,38,0.03)')
    : (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)')

  // Dépliable : le titre porte un VRAI bouton (`<h2><button aria-expanded>`),
  // et non un `<header role="button">` qui contenait le titre — rôle interdit
  // sur `header`, et un bouton aplatit le titre qu'il contient (audit A11Y-19).
  // Le clic n'importe où sur l'en-tête déplie aussi (souris) : le bouton
  // arrête la propagation pour ne pas déplier deux fois.
  const titre = collapsible
    ? (
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        style={{ background: 'none', border: 0, padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}
      >
        {title}
      </button>
    )
    : title

  const headerInner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {Icon && (
          <span style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: tone === 'danger'
              ? 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)'
              : 'var(--gradient-deep)',
            color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={15} />
          </span>
        )}
        <h2 style={{
          margin: 0,
          fontSize: '15px',
          fontWeight: 800,
          color: tone === 'danger' ? '#DC2626' : textColor,
          flex: 1,
        }}>
          {titre}
        </h2>
        {badge && <ProfileSectionBadge variant={badge} lang={lang} />}
        {collapsible && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              transition: 'transform 0.18s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: mutedColor,
              marginLeft: '4px',
            }}
          >
            <LuChevronDown size={18} />
          </span>
        )}
      </div>
      {description && (
        <p style={{
          margin: '0 0 0 42px',
          fontSize: '12px',
          color: mutedColor,
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}
    </>
  )

  const containerStyle = {
    padding: '16px',
    borderRadius: '12px',
    border: `1px solid ${border}`,
    background: bg,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }

  // ── Variante collapsible : header cliquable, contenu pliable ────────
  if (collapsible) {
    return (
      <section style={containerStyle}>
        <header
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', flexDirection: 'column', gap: '6px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {headerInner}
        </header>
        {open && children && (
          <div style={{
            paddingTop: '4px',
            borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            {children}
          </div>
        )}
      </section>
    )
  }

  // ── Variante normale : toujours visible ─────────────────────────────
  return (
    <section style={containerStyle}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {headerInner}
      </header>
      {children && (
        <div style={{
          paddingTop: '4px',
          borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          {children}
        </div>
      )}
    </section>
  )
}
