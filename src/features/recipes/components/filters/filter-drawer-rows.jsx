import Button from '@shared/ui/button'

/**
 * Lignes réutilisables du tiroir de filtres : interrupteur simple et curseur
 * de plage. Extraits tels quels — ils ne dépendent d'aucune constante du
 * module et reçoivent déjà tout par props.
 */
export function ToggleRow({ label, description, icon, color, checked, onChange, darkMode, border, textColor, sectionBg, count }) {
  return (
    <Button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="h-auto w-full justify-start rounded-[10px] px-3.5 py-3 text-left transition-all duration-150"
      style={{
        gap: '12px',
        alignItems: 'center',
        border: checked ? `1.5px solid ${color}` : `1px solid ${border}`,
        background: checked
          ? (darkMode ? `${color}1A` : `${color}14`)
          : sectionBg,
      }}
    >
      <span style={{ color: checked ? color : 'var(--color-muted)', display: 'flex', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{
          fontSize: '14px',
          fontWeight: checked ? 700 : 500,
          color: checked ? color : textColor,
          lineHeight: 1.2,
        }}>
          {label}
        </span>
        {description && (
          <span style={{
            fontSize: '11.5px', fontWeight: 400,
            color: 'var(--color-muted)',
            opacity: 0.85,
            lineHeight: 1.3,
          }}>
            {description}
          </span>
        )}
      </span>
      {count !== undefined && (
        <span style={{
          fontSize: '11px', fontWeight: 600,
          color: checked ? color : 'var(--color-muted)',
          opacity: 0.75,
          flexShrink: 0,
        }}>
          ({count})
        </span>
      )}
      <span style={{
        width: '20px', height: '20px', borderRadius: '6px',
        border: `1.5px solid ${checked ? color : 'var(--color-muted)'}`,
        background: checked ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: '#FFFFFF', fontSize: '13px', fontWeight: 800,
      }}>
        {checked && '✓'}
      </span>
    </Button>
  )
}

// Phase 10b.3 — slider de filtre numérique (protéines / calories / budget).
// value=null signifie pas de filtre actif. onChange(null) efface le filtre.
export function RangeFilterRow({ label, description, icon, color, value, onChange, min, max, step, unit, darkMode, border, textColor, sectionBg, clearLabel }) {
  const active = value != null
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      border: active ? `1.5px solid ${color}` : `1px solid ${border}`,
      background: active ? (darkMode ? `${color}1A` : `${color}14`) : sectionBg,
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: active ? color : 'var(--color-muted)', display: 'flex', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span style={{ fontSize: '14px', fontWeight: active ? 700 : 500, color: active ? color : textColor }}>
            {label}
          </span>
          {description && (
            <span style={{ fontSize: '11.5px', color: 'var(--color-muted)', opacity: 0.85 }}>{description}</span>
          )}
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={clearLabel}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: color, fontSize: '11px', fontWeight: 700, padding: '2px 6px',
            }}
          >
            {clearLabel}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value ?? min}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: color }}
          aria-label={label}
        />
        <span style={{
          minWidth: '70px', textAlign: 'right',
          fontSize: '13px', fontWeight: 700,
          color: active ? color : 'var(--color-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value != null ? `${value} ${unit}` : '—'}
        </span>
      </div>
    </div>
  )
}
