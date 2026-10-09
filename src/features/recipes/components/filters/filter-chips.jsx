import Button from '@shared/ui/button'

export default function FilterChips({ label, values, onToggle, options, getColor, darkMode, counts }) {
  return (
    <div className="flex flex-col gap-2.5">

      {/* Header section */}
      <div className="flex items-center gap-2">
        <div
          className="w-0.5 h-4 rounded-full shrink-0"
          style={{ background: 'rgba(224,120,32,0.55)' }}
        />
        <span
          className="text-xs font-extrabold uppercase tracking-[0.10em]"
          style={{ color: 'rgba(224,120,32,0.75)' }}
        >
          {label}
        </span>
        {values.size > 0 && (
          <span
            className="text-xs font-extrabold px-2 py-0.5 rounded-md"
            style={{
              background: 'rgba(224,120,32,0.15)',
              color: 'var(--color-brand-500)',
              border: '1px solid rgba(224,120,32,0.30)',
            }}
          >
            {values.size}
          </span>
        )}
      </div>

      {/* Chips */}
      <div className="flex gap-1.5 flex-wrap">
        {options.map(opt => {
          const sel    = values.has(opt.value)
          const colors = getColor?.(opt.value)
          const count  = counts?.get(opt.value) ?? 0
          // Show (N) when selected (even if 0 — informs user selection yields nothing)
          // or when count > 0 and chip is not selected (useful non-zero hint)
          const showCount = sel || count > 0
          return (
            <Button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              aria-pressed={sel}
              className="h-auto rounded-lg border-[1.5px] px-3 py-1.5 text-sm font-semibold transition-all duration-150"
              style={{
                borderColor: sel
                  ? (colors?.border ?? 'var(--color-brand-500)')
                  : (darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'),
                background: sel
                  ? (colors?.bg ?? (darkMode ? 'rgba(224,120,32,0.15)' : 'rgba(224,120,32,0.10)'))
                  : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                color: sel
                  ? (colors?.text ?? 'var(--color-brand-500)')
                  : 'var(--color-muted)',
                boxShadow: sel
                  ? `0 0 0 3px ${(colors?.border ?? 'var(--color-brand-500)')}18`
                  : 'none',
                gap: '6px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                if (sel) {
                  e.currentTarget.style.filter = 'brightness(1.15)'
                } else {
                  e.currentTarget.style.background  = colors?.bg    ?? (darkMode ? 'rgba(224,120,32,0.12)' : 'rgba(224,120,32,0.08)')
                  e.currentTarget.style.borderColor = colors?.border ?? 'var(--color-brand-500)'
                  e.currentTarget.style.color       = colors?.text   ?? 'var(--color-brand-500)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.filter    = ''
                if (!sel) {
                  e.currentTarget.style.background  = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                  e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
                  e.currentTarget.style.color       = 'var(--color-muted)'
                }
              }}
            >
              {sel && (
                <span style={{ fontSize: '10px', lineHeight: 1, opacity: 0.9 }}>✓</span>
              )}
              {opt.label}
              {counts !== undefined && showCount && (
                <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.7, lineHeight: 1 }}>
                  ({count})
                </span>
              )}
            </Button>
          )
        })}
      </div>

    </div>
  )
}
