import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CommunityPage from '@features/community/components/community-page'
import { useSmartBack } from '@shared/hooks/use-smart-back'
import { useDarkMode } from '@shared/contexts/ui-provider'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { titreDeRoute } from '@routes/route-title'

// CommunityPageRoute — Sprint 11 S11.d.
//
// Wrapper minimal pour rendre <CommunityPage> en mode page routée
// (`/community`) au lieu de la modale via `modals.community.open()`.
//
// Architecture :
//   - <CommunityPage> reste 100 % inchangée (1756 lignes intactes,
//     reste utilisable en mode modal-portal pour les call-sites futurs
//     qui en auraient besoin).
//   - Ce wrapper injecte les dépendances qui venaient des props
//     depuis App.jsx/AppModalsRoot : `onClose` (smart-back navigation),
//     `darkMode` + `onToggleDarkMode` (via UIProvider context),
//     `onShowRecipe` (navigate vers /recipe/:id avec state.background
//     pour le pattern modal-on-page).
//
// Pas d'AuthGuard : la Communauté est accessible aux invités (lecture
// du feed). Les actions qui requièrent un compte (poster, liker, etc.)
// sont gated à l'intérieur du composant via `user?.id` checks et RLS
// Supabase côté serveur.

export default function CommunityPageRoute({ lang = 'fr' }) {
  const navigate = useNavigate()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const onClose = useSmartBack('/')
  useDocumentTitle(titreDeRoute('/community', lang))

  const onShowRecipe = useCallback((recipeOrId) => {
    const id = typeof recipeOrId === 'string' ? recipeOrId : recipeOrId?.id
    if (!id) return
    navigate(`/recipe/${id}`)
  }, [navigate])

  return (
    <CommunityPage
      onClose={onClose}
      lang={lang}
      darkMode={darkMode}
      onToggleDarkMode={toggleDarkMode}
      onShowRecipe={onShowRecipe}
    />
  )
}
