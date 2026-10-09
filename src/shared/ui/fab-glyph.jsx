import { LuGrid2X2 } from 'react-icons/lu'

// Le glyphe du bouton orange, tel qu'il apparaît dans l'en-tête (fridge-fab.jsx :
// carré arrondi, `--gradient-warm`, LuGrid2X2 blanc). Il sert à l'aide (guide,
// FAQ, modale « Aide & infos », état vide du frigo) pour que « le bouton
// orange » soit RECONNU, pas seulement nommé — jusqu'au 2026-09-11 aucune page
// d'aide ne le montrait.
//
// Décoratif par construction (`aria-hidden`) : le texte voisin écrit toujours
// « bouton orange ». Un glyphe qui porterait un nom ferait doublon avec lui.
export default function FabGlyph({ size = 16, className = '', style }) {
  return (
    <span
      aria-hidden="true"
      data-fab-glyph
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.27)}px`,
        background: 'var(--gradient-warm)', color: '#fff', verticalAlign: '-0.15em',
        flexShrink: 0,
        ...style,
      }}
    >
      <LuGrid2X2 size={Math.round(size * 0.68)} />
    </span>
  )
}
