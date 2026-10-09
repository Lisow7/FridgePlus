// Carte KPI pour le header du Dashboard.
//
// Affiche un compteur, son label et une icône. Couleur d'accent variable
// (par défaut orange brand) pour différencier les KPI (users vs recettes
// pending vs tickets ouverts vs signalements).
//
// Optionnel : `onClick` pour drill-down vers la section correspondante.

export default function StatCard({ icon, label, value, accent = 'var(--color-brand-500)', loading = false, darkMode = false, onClick }) {
  const bg     = darkMode ? '#1A2F48' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '14px 16px', borderRadius: 12,
        background: bg, color: fg,
        border: `1px solid ${border}`,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', fontFamily: 'inherit',
        transition: 'transform 0.12s, box-shadow 0.12s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        minWidth: 0,
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.08)' } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && (
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${accent}1A`, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{icon}</span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 700, color: muted,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          lineHeight: 1.3, minWidth: 0, flex: 1,
        }}>{label}</span>
      </div>
      <div style={{
        fontSize: 26, fontWeight: 800, color: fg,
        lineHeight: 1.1, marginTop: 2,
        opacity: loading ? 0.4 : 1,
      }}>
        {loading ? '—' : value}
      </div>
    </Tag>
  )
}
