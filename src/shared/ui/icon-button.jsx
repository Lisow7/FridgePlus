import Button from '@shared/ui/button'

// Primitive `IconButton` — Sprint 9 S9.b.2.
//
// Atomic component pour les boutons icon-only avec hover opacity.
// Cas typique : actions edit/delete/copy dans les listes (admin sections,
// modales, etc.).
//
// API :
//   <IconButton color="var(--color-info)" onClick={...} aria-label="Modifier">
//     <LuPencil size={14} />
//   </IconButton>
//
// Props :
//   - color : string — couleur de l'icône (défaut neutre muted)
//   - aria-label : string — label accessibilité OBLIGATOIRE
//   - title : string — tooltip natif optionnel
//   - ...rest : autres props passées au <Button> (onClick, disabled, etc.)

export default function IconButton({
  color,
  className = '',
  style = {},
  children,
  ...rest
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '0.8' }}
      className={`h-auto w-auto rounded-md bg-transparent px-1.5 py-1 opacity-80 transition-opacity hover:bg-transparent ${className}`}
      style={{ color, ...style }}
      {...rest}
    >
      {children}
    </Button>
  )
}
