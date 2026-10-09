import { LuChevronUp, LuChevronDown, LuRefreshCw } from 'react-icons/lu'
import Button from '@shared/ui/button'

// Phase 8 launch (refonte Modales) PR 8.8.c. Extraction depuis
// CartSuggestionsModal : header d'une section collapsible (ex « Souvent
// achetés », « Saisonniers », etc.) avec icône + label + chevron + bouton
// refresh visible quand la section est ouverte. Pure presentational.

export default function CartSuggestionsSectionHeader({
  id,
  icon,                    // Composant icône Lucide (LuStar, LuLeaf, etc.)
  label,
  open,
  onToggle,
  onRefresh,
  refreshLabel,
  fg,                      // Couleur principale (texte)
  border,
  darkMode,
}) {
  const IconEl = icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span aria-hidden="true" style={{
        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(247,168,94,0.30) 0%, rgba(212,106,16,0.18) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: darkMode ? 'var(--color-brand-400)' : '#C05010',
      }}>
        <IconEl size={14} strokeWidth={2} />
      </span>
      <Button
        variant="ghost"
        id={id}
        onClick={onToggle}
        className="h-auto flex-1 justify-between gap-0 p-0 text-sm font-bold hover:bg-transparent"
        style={{ color: fg }}
      >
        {label}
        {open
          ? <LuChevronUp size={16} aria-hidden="true" />
          : <LuChevronDown size={16} aria-hidden="true" />
        }
      </Button>
      {open && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          title={refreshLabel}
          aria-label={refreshLabel}
          className="h-7 w-7 flex-shrink-0 rounded-lg border hover:bg-[var(--color-warm-600)]/10"
          style={{ borderColor: border, color: darkMode ? 'var(--color-brand-400)' : '#C05010' }}
        >
          <LuRefreshCw size={13} aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
