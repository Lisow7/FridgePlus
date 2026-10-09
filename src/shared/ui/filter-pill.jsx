import Button from '@shared/ui/button'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

// Primitive `FilterPill` — Sprint 9 S9.b.1.
//
// Atomic component pour les filtres en pill (panel admin, sections de
// modération, sélecteurs de catégorie). Remplace ~8 helpers `pillStyle`
// dupliqués dans les sections admin.
//
// API :
//   <FilterPill active={isActive} onClick={...} color="var(--color-info)" count={42}>
//     Modération
//   </FilterPill>
//
// Props :
//   - active : boolean — état sélectionné (couleur de fond/bordure pleine)
//   - color  : string  — couleur d'accent hex (défaut warm-500 #E07820)
//   - count  : number  — badge compteur optionnel à droite du label
//   - border : string  — couleur de bordure quand inactive (défaut neutre)
//   - muted  : string  — couleur du texte quand inactive (défaut neutre)
//   - ...rest : autres props passées au <Button> (onClick, disabled, etc.)

const NEUTRAL_BORDER = 'var(--color-border-soft, #D9CCBA)'
const NEUTRAL_MUTED  = 'var(--color-muted, #5C4033)'

export default function FilterPill({
  active = false,
  color = 'var(--color-brand-500)',
  count = null,
  border = NEUTRAL_BORDER,
  muted = NEUTRAL_MUTED,
  className = '',
  style = {},
  children,
  ...rest
}) {
  return (
    <Button
      variant="ghost"
      aria-pressed={active}
      className={`h-auto min-h-6 rounded-md border px-2.5 py-1 text-xs hover:bg-transparent ${className}`}
      style={{
        fontWeight: active ? 700 : 500,
        borderColor: active ? color : border,
        // Le texte actif : l'accent mêlé au charbon du thème, lisible des deux
        // côtés (l'orange pur était à 2,9:1). Le fond : `${color}18` donnait
        // `var(--…)18` avec la couleur par défaut, une valeur invalide — il
        // n'apparaissait pas (audit A11Y-03, palette de l'admin, 2026-10-08).
        background: active ? fondTeinte(color, 10) : 'transparent',
        color: active ? texteLisible(color) : muted,
        transition: 'all 0.12s',
        ...style,
      }}
      {...rest}
    >
      {children}
      {count != null && count > 0 && (
        <span style={{
          marginLeft: 5, padding: '1px 6px', borderRadius: 8,
          background: active ? fondTeinte(color, 16) : 'rgba(0,0,0,0.08)',
          fontSize: 11,
        }}>
          {count}
        </span>
      )}
    </Button>
  )
}
