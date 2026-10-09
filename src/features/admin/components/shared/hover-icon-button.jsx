import { useState } from 'react'
import Button from '@shared/ui/button'

export default function HoverIconButton({ onClick, icon, label, bg, color }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="h-auto flex-shrink-0 rounded-lg px-2 py-[7px] font-bold"
      style={{
        gap: 4,
        background: bg,
        color,
        opacity: hovered ? 1 : 0.82,
        transition: 'opacity 0.15s',
      }}
    >
      {icon}
      {label && (
        <span style={{
          maxWidth: hovered ? '100px' : '0',
          overflow: 'hidden', opacity: hovered ? 1 : 0,
          transition: 'max-width 0.22s ease, opacity 0.18s ease',
          whiteSpace: 'nowrap', fontSize: 13,
        }}>
          {label}
        </span>
      )}
    </Button>
  )
}
