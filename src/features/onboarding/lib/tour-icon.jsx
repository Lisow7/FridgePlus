import FabGlyph from '@shared/ui/fab-glyph'
import { TOUR_ICONS } from './tour-icons'

// Séparé du registre : la règle react-refresh veut qu'un module qui exporte un
// composant n'exporte que des composants.
export function TourIcon({ id, size = 18 }) {
  if (id === 'fab') return <FabGlyph size={size} />
  const Icon = TOUR_ICONS[id]
  if (!Icon) return null
  return <Icon size={size} aria-hidden="true" />
}
