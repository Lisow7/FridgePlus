import { LuUtensils, LuChevronRight } from 'react-icons/lu'

// Carte recette miniature attachée à un post — extraite de community-page.jsx
// (2026-07-25, audit front §2). Feuille présentationnelle. (Le `const C` mort
// de l'original n'est pas repris.)
export function RecipePreviewCard({ recipeId, recipeNames, lang, darkMode, onShowRecipe }) {
  // Sprint 11 hotfix — recipeNames[id] peut être :
  //   - Objet multi-langue {fr, en, es, de, ja} pour les base recipes
  //     (chargées via useBaseRecipes → recipeNames de DataProvider)
  //   - String simple "Mon plat" pour les custom recipes (data.name est
  //     stocké tel quel dans Supabase par RecipeFormModal, non i18n).
  // On gère les 2 cas pour ne pas masquer la card preview.
  const raw = recipeNames?.[recipeId]
  const resolved = typeof raw === 'string' ? raw : (raw?.[lang] ?? raw?.fr)
  // v3.408 hotfix — si le name n'est pas (encore) résolu (race fetch
  // customRecipeNames, recipe supprimée, etc.) on rend quand même la
  // card avec un label fallback. Le clic mène vers /recipe/:id qui a
  // son propre résolveur (useRecipeById) et affichera le vrai nom OU
  // un état Not Found cohérent. Avant : 'return null' masquait silen-
  // cieusement la card et l'user n'avait aucune indication qu'une
  // recette était attachée.
  const t = { fr: 'Voir la recette', en: 'View recipe' }
  const name = resolved ?? (t[lang] ?? t.fr)
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onShowRecipe?.(recipeId) }}
      // Accès clavier (audit 2026-08-25) : cette carte était le SEUL chemin
      // vers la recette attachée au post, et un `div onClick` nu est invisible
      // pour Tab. Rôle et tabIndex conditionnels : sans `onShowRecipe`, la
      // carte est purement décorative.
      role={onShowRecipe ? 'button' : undefined}
      tabIndex={onShowRecipe ? 0 : undefined}
      onKeyDown={(e) => { if (onShowRecipe && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); onShowRecipe(recipeId) } }}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '10px',
        border: `1.5px solid ${darkMode ? 'rgba(255,107,26,0.30)' : 'rgba(200,64,0,0.22)'}`,
        background: darkMode ? 'rgba(255,107,26,0.07)' : 'rgba(200,64,0,0.05)',
        cursor: onShowRecipe ? 'pointer' : 'default',
        transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={e => { if (onShowRecipe) e.currentTarget.style.background = darkMode ? 'rgba(255,107,26,0.14)' : 'rgba(200,64,0,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,107,26,0.07)' : 'rgba(200,64,0,0.05)' }}
      role={onShowRecipe ? 'button' : undefined}
      tabIndex={onShowRecipe ? 0 : undefined}
      onKeyDown={onShowRecipe ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onShowRecipe(recipeId) } } : undefined}
    >
      <LuUtensils size={14} color={darkMode ? '#FF6B1A' : '#C84000'} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: darkMode ? '#FF6B1A' : '#C84000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      {onShowRecipe && <LuChevronRight size={14} color={darkMode ? '#FF6B1A' : '#C84000'} style={{ flexShrink: 0 }} />}
    </div>
  )
}
