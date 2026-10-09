import { useEffect, useRef, useState } from 'react'
import { LuChevronDown } from 'react-icons/lu'
import Emoji from '@shared/ui/emoji'
import Button from '@shared/ui/button'

export default function FilterDropdown({ values, onToggle, onClear, options, darkMode, label, shortLabel, counts }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isActive = values.size > 0
  const selectedFlags = isActive
    ? options.filter(o => values.has(o.value) && o.flag).map(o => o.flag)
    : []

  const triggerLabel = !isActive
    ? (shortLabel ?? label)
    : values.size === 1
      ? (options.find(o => o.value === [...values][0])?.label ?? `${values.size}`)
      : `${shortLabel ?? label} (${values.size})`

  const borderColor = isActive ? 'var(--color-brand-500)' : (darkMode ? 'rgba(224,120,32,0.22)' : 'rgba(224,120,32,0.28)')
  const bgColor     = isActive ? (darkMode ? '#1A2535' : '#FFF8F2') : 'transparent'
  const textColor   = isActive ? 'var(--color-brand-500)' : (darkMode ? '#C07830' : '#B06828')

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <Button
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => e.key === 'Escape' && setOpen(false)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-auto w-full gap-1.5 rounded-xl border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-all duration-150"
        style={{ borderColor, background: bgColor, color: textColor }}
      >
        {selectedFlags.length === 1 && <Emoji char={selectedFlags[0]} size={14} style={{ flexShrink: 0 }} />}
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">{triggerLabel}</span>
        <LuChevronDown
          size={11}
          style={{ flexShrink: 0, opacity: 0.55, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </Button>

      {open && (
        <div
          className="absolute left-0 right-0 rounded-xl overflow-hidden z-[100]"
          style={{
            top: 'calc(100% + 4px)',
            background: 'var(--dropdown-bg)',
            border: '1.5px solid var(--dropdown-border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          }}
        >
          {isActive && (
            <Button
              variant="ghost"
              onClick={() => { onClear(); setOpen(false) }}
              className="h-auto w-full justify-start rounded-none bg-transparent px-3 py-2 text-xs font-semibold hover:bg-transparent"
              style={{
                borderBottom: '1px solid var(--dropdown-border)',
                color: darkMode ? '#C07830' : '#B06828',
              }}
            >
              ✕ {shortLabel ?? label}
            </Button>
          )}
          <div className="max-h-72 overflow-y-auto">
            {options.filter(o => o.value !== 'all').map(o => {
              const sel = values.has(o.value)
              return (
                <Button
                  key={o.value}
                  variant="ghost"
                  role="option"
                  aria-selected={sel}
                  onClick={() => onToggle(o.value)}
                  className="h-auto w-full justify-start gap-2 rounded-none px-3 py-2 text-[13px] hover:bg-transparent"
                  style={{
                    background: sel ? (darkMode ? 'rgba(224,120,32,0.15)' : 'rgba(224,120,32,0.08)') : 'transparent',
                    fontWeight: sel ? 700 : 500,
                    color: sel ? 'var(--color-brand-500)' : 'var(--color-charcoal)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = sel
                      ? (darkMode ? 'rgba(224,120,32,0.22)' : 'rgba(224,120,32,0.14)')
                      : (darkMode ? 'rgba(224,120,32,0.10)' : 'rgba(224,120,32,0.07)')
                    e.currentTarget.style.color = 'var(--color-brand-500)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = sel ? (darkMode ? 'rgba(224,120,32,0.15)' : 'rgba(224,120,32,0.08)') : 'transparent'
                    e.currentTarget.style.color = sel ? 'var(--color-brand-500)' : 'var(--color-charcoal)'
                  }}
                >
                  {o.flag
                    ? <Emoji char={o.flag} size={15} style={{ flexShrink: 0 }} />
                    : <span className="w-4 shrink-0" />
                  }
                  <span className="flex-1">{o.label}</span>
                  {counts !== undefined && (
                    <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.55, flexShrink: 0, color: 'var(--color-charcoal)' }}>
                      {counts.get(o.value) ?? 0}
                    </span>
                  )}
                  <span style={{ color: 'var(--color-brand-500)', fontSize: '12px', flexShrink: 0, opacity: sel ? 1 : 0.2 }}>
                    {sel ? '☑' : '☐'}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
