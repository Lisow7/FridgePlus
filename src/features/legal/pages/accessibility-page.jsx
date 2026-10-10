import { LuAccessibility } from 'react-icons/lu'
import PagePubliqueDeTexte from '@features/legal/components/page-publique-de-texte'
import { PAGE_ACCESSIBILITE } from '@features/legal/data/page-accessibilite'

// Page publique « Accessibilité » — /accessibilite (décision du 2026-10-08).
// Sans `Guard`, comme `/faq` ou `/suppression-compte` : elle ne lit aucune
// donnée de compte. Le texte et ce qui le garde : `data/page-accessibilite.js`.
export default function AccessibilityPage({ lang = 'fr' }) {
  return <PagePubliqueDeTexte contenu={PAGE_ACCESSIBILITE} lang={lang} Icone={LuAccessibility} />
}
