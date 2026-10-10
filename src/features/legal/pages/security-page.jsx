import { LuShieldCheck } from 'react-icons/lu'
import PagePubliqueDeTexte from '@features/legal/components/page-publique-de-texte'
import { PAGE_SECURITE } from '@features/legal/data/page-securite'

// Page publique « Sécurité » — /securite (décision du 2026-10-08), celle que
// désigne `public/.well-known/security.txt`. Sans `Guard` : elle ne lit aucune
// donnée de compte. Le texte et ce qui le garde : `data/page-securite.js`.
export default function SecurityPage({ lang = 'fr' }) {
  return <PagePubliqueDeTexte contenu={PAGE_SECURITE} lang={lang} Icone={LuShieldCheck} />
}
