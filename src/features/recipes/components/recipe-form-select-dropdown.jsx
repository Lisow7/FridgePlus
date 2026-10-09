import { useState, useEffect, useRef } from 'react'
import { LuChevronDown } from 'react-icons/lu'
import Emoji from '@shared/ui/emoji'
import Button from '@shared/ui/button'

// Phase 8 launch (refonte Modales) PR 8.8.a. Extraction de
// RecipeFormModal : dropdown select stylé pour les champs catégoriels
// (pays, type, difficulté, régime). Supporte options avec emoji (drapeau)
// + colorMap pour les options coloriées (ex: badges difficulté).

export default function RecipeFormSelectDropdown({
  options, value, onChange,
  darkMode, hasError,
  placeholder = '–', compact = false,
  style = {}, colorMap = {},
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const dm = darkMode

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => String(o.value) === String(value))
  const selectedColor = selected && selected.value !== '' ? colorMap[selected.value] : null
  const fs = compact ? '13px' : '15px'
  const pad = compact ? '8px 10px' : '10px 12px'

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <Button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-auto w-full justify-start rounded-lg border-[1.5px] font-normal hover:opacity-100"
        style={{
          padding: pad,
          borderColor: hasError ? '#D07070' : (dm ? 'var(--color-dark-surface)' : '#E8E0D4'),
          background: dm ? '#0F1923' : '#FFF',
          color: selected && selected.value !== '' ? (selectedColor ? selectedColor.text : 'var(--color-charcoal)') : 'var(--color-muted)',
          fontSize: fs, textAlign: 'left',
          gap: '6px', overflow: 'hidden',
        }}
      >
        {selected && selected.value !== '' ? (
          <>
            {selected.flag && <Emoji char={selected.flag} size={16} style={{ flexShrink: 0 }} />}
            {selectedColor && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedColor.text, flexShrink: 0 }} />}
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.label}
            </span>
          </>
        ) : (
          <span style={{ flex: 1 }}>{placeholder}</span>
        )}
        <LuChevronDown size={13} style={{ flexShrink: 0, opacity: 0.45, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </Button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: dm ? '#131E2C' : '#FDFAF6',
          border: dm ? '1.5px solid #1A2A3D' : '1.5px solid #EDE4D4',
          borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {options.map(opt => {
              const isSelected = String(opt.value) === String(value) && opt.value !== ''
              const optColor = colorMap[opt.value]
              return (
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className="h-auto w-full justify-start rounded-none px-3 py-2 text-[15px] hover:bg-transparent"
                  style={{
                    background: isSelected ? (optColor ? optColor.bg : (dm ? '#1A3A2A' : '#E8F5E9')) : 'transparent',
                    color: optColor ? optColor.text : 'var(--color-charcoal)',
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: 'left', gap: '8px',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = optColor ? optColor.bg + '80' : (dm ? '#1A2535' : '#F5EFE6') }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {opt.flag && <Emoji char={opt.flag} size={16} style={{ flexShrink: 0 }} />}
                  {optColor && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: optColor.text, flexShrink: 0 }} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {isSelected && !optColor && (
                    <span style={{ flexShrink: 0, color: '#22c55e', fontSize: '12px' }}>✓</span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
