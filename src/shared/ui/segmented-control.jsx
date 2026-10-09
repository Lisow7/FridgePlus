import Button from '@shared/ui/button'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

// Primitive `SegmentedControl` — Sprint 9 S9.b.5.
//
// Atomic component pour les "select one from N" en boutons côte-à-côte
// (difficulté recette, type, options exclusives…). Pattern différent de
// FilterPill : segments d'égale largeur en row, role="radiogroup".
//
// API :
//   <SegmentedControl
//     options={[
//       { value: 'easy', label: 'Facile' },
//       { value: 'medium', label: 'Moyen' },
//       { value: 'hard', label: 'Difficile' },
//     ]}
//     value={difficulty}
//     onChange={setDifficulty}
//   />
//
// Props :
//   - options : Array<{ value, label, color? }>
//   - value : any — valeur sélectionnée
//   - onChange : (value) => void
//   - accent : couleur d'accent par défaut (#E07820)
//   - aria-label : label du groupe (recommandé)

const NEUTRAL_BORDER = 'var(--color-border-soft, #D9CCBA)'
const NEUTRAL_MUTED  = 'var(--color-muted, #5C4033)'

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  accent = 'var(--color-brand-500)',
  border = NEUTRAL_BORDER,
  muted = NEUTRAL_MUTED,
  className = '',
  'aria-label': ariaLabel,
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={className}
      style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}
    >
      {options.map(opt => {
        const isActive = value === opt.value
        const color = opt.color ?? accent
        return (
          <Button
            key={opt.value}
            variant="ghost"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className="h-auto flex-1 rounded-lg border px-1 py-2 text-xs hover:bg-transparent"
            style={{
              borderColor: isActive ? color : border,
              // Même correctif que FilterPill : `${color}26` était invalide avec une
              // variable CSS, et l'accent pur illisible comme texte (A11Y-03).
              background: isActive ? fondTeinte(color, 15) : 'transparent',
              color: isActive ? texteLisible(color) : muted,
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </Button>
        )
      })}
    </div>
  )
}
