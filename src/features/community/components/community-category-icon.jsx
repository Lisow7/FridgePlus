import { LuLayoutGrid } from 'react-icons/lu'
import { CATEGORY_ICONS } from './community-theme'

// Icône d'une catégorie de la communauté — extrait de community-page.jsx
// (2026-07-25, audit front §2). Composant seul (fichier séparé du thème pour
// respecter react-refresh).
export function CategoryIcon({ cat, size = 13, style }) {
  const Icon = CATEGORY_ICONS[cat] ?? LuLayoutGrid
  return <Icon size={size} style={style} />
}
