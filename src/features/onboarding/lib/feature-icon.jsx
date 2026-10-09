import { LuSparkles } from 'react-icons/lu'
import { FEATURE_ICONS } from './feature-icons'

// Rend l'icône d'une fonctionnalité de l'aide (carte dans feature-icons.js).
// Fichier séparé de la carte : la règle react-refresh veut qu'un module qui
// exporte un composant n'exporte que des composants.
export function FeatureIcon({ id, size = 19 }) {
  const Icon = FEATURE_ICONS[id] ?? LuSparkles
  return <Icon size={size} aria-hidden="true" />
}
