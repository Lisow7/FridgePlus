import { LuChefHat } from 'react-icons/lu'
import { track } from '@shared/lib/observability/track'
import Button from '@shared/ui/button'
import { UpgradeGate } from '@shared/ui/upgrade-gate'

// Pied de la fiche recette : « Mode cuisine vocal » + « J'ai cuisiné ».
// Extrait de recipe-detail-body.jsx (en dette de taille) le 2026-10-03 pour
// pouvoir poser « J'ai cuisiné » HORS de la zone qui défile sur mobile : il
// y était à 1 600 px du haut d'un écran de 844, au bout des étapes — et
// l'usage réel montrait 35 visiteurs qui ouvrent une recette pour 3 qui la
// cuisinent. `showModeCuisine` / `showCook` séparent les deux moitiés ; par
// défaut (bureau), le pied est entier, comme avant.
export function RecipeCookFooter({
  recipe, recipeSteps, user, isMobile, hasPremiumAccess, darkMode, lang, t, navigate,
  withdrawFeedback, setWithdrawFeedback, feedbackTimerRef,
  hasStockIngredients, enterWithdraw, logCookedWithoutWithdraw,
  showModeCuisine = true, showCook = true,
}) {
  return (
    <>
      {/* ── Footer sticky : Mode cuisine + J'ai cuisiné ──
          Desktop : les 2 boutons côte à côte quand les DEUX sont des
          boutons (Premium + étapes). Mobile (ou non-premium / sans
          étapes) : empilés. La bannière de feedback reste au-dessus. */}
      {(recipeSteps.length > 0 || user?.id) && (showCook || (showModeCuisine && recipeSteps.length > 0)) && (() => {
        // Desktop : « Mode cuisine vocal » et « J'ai cuisiné » côte à côte
        // (dès qu'il y a des étapes → le mode vocal est présent, bouton
        // Premium OU barre UpgradeGate). Mobile : empilés. flex-start pour
        // qu'un UpgradeGate déplié ne force pas la hauteur du bouton vert.
        const cookButtonsRow = !isMobile && recipeSteps.length > 0
        // Les DEUX slots sont de vrais boutons (Premium) → on égalise leurs
        // hauteurs (stretch + h-full) pour qu'ils soient parfaitement alignés.
        // Non-premium : le slot gauche est un UpgradeGate dépliable → on garde
        // flex-start pour qu'un dépliage n'étire pas le bouton vert.
        const bothCookButtons = cookButtonsRow && hasPremiumAccess
        const itemStyle = cookButtonsRow ? { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' } : undefined
        return (
        <div style={{
          flexShrink: 0,
          padding: '12px 20px',
          borderTop: `1px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}`,
          background: darkMode ? '#131E2C' : '#FDFAF6',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {showCook && withdrawFeedback && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: darkMode ? 'rgba(123,176,120,0.18)' : 'rgba(123,176,120,0.12)', border: `1px solid rgba(123,176,120,0.35)`, fontSize: '13px', fontWeight: 600, color: darkMode ? '#7BB078' : '#3A6A38', textAlign: 'center', animation: 'menu-slide-down 0.2s ease both' }}>
              ✓ {withdrawFeedback}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: cookButtonsRow ? 'row' : 'column', gap: '8px', alignItems: cookButtonsRow ? (bothCookButtons ? 'stretch' : 'flex-start') : 'stretch' }}>
          {showModeCuisine && recipeSteps.length > 0 && (
            <div style={itemStyle}>
            {hasPremiumAccess ? (
            <Button onClick={() => navigate(`/cook/${recipe.id}`)}
              title={t.cookingMode} aria-label={t.cookingMode}
              className={`${bothCookButtons ? 'h-full' : 'h-auto'} w-full rounded-[10px] border-[1.5px] px-4 py-2.5 text-sm font-bold`}
              style={{
                gap: '6px',
                borderColor: darkMode ? 'rgba(224,120,32,0.32)' : 'rgba(224,120,32,0.40)',
                background: darkMode ? 'rgba(224,120,32,0.10)' : 'rgba(224,120,32,0.06)',
                color: 'var(--color-brand-500)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(224,120,32,0.18)' : 'rgba(224,120,32,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(224,120,32,0.10)' : 'rgba(224,120,32,0.06)' }}
            >
              <span>🍳</span>
              <span>{t.cookingMode}</span>
            </Button>
            ) : (
              <UpgradeGate feature="voice-cooking" variant="hard" collapsible lang={lang} darkMode={darkMode} />
            )}
            </div>
          )}
          {showCook && (
          <div style={itemStyle}>
          <Button
            onClick={() => {
              // Mesure : le geste, quel que soit le chemin qui suit ;
              // `cook_completed` reste la confirmation (retrait ou non).
              track('cook_started', { recipeId: recipe.id })
              if (hasStockIngredients) enterWithdraw()
              else if (user?.id) logCookedWithoutWithdraw()
              else {
                // Invité sans ingrédient en stock : cuisiné quand même → funnel (Blocker A).
                track('cook_completed', { recipeId: recipe.id })
                setWithdrawFeedback(t.feedbackDone(0))
                // `feedbackTimerRef` arrive en prop (ref créé dans RecipeModal,
                // partagé avec le reste du flux retrait) : la lecture/écriture
                // se fait dans ce handler de clic, jamais pendant le rendu.
                // eslint-disable-next-line react-hooks/refs
                clearTimeout(feedbackTimerRef.current)
                feedbackTimerRef.current = setTimeout(() => setWithdrawFeedback(null), 3000)
              }
            }}
            className={`soft-blink ${bothCookButtons ? 'h-full' : 'h-auto'} w-full rounded-xl px-4 py-3 text-sm font-bold text-white hover:opacity-100`}
            style={{
              gap: '8px',
              background: darkMode
                ? 'linear-gradient(135deg, #52C97A 0%, #1E8449 100%)'
                : 'linear-gradient(135deg, #48C06A 0%, #1E7A40 100%)',
              boxShadow: darkMode
                ? '0 3px 14px rgba(52,201,122,0.28)'
                : '0 3px 14px rgba(30,122,64,0.28)',
              transition: 'opacity 0.2s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; if (!cookButtonsRow) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
          >
            <LuChefHat size={17} />
            {t.cookRecipe}
          </Button>
          </div>
          )}
          </div>
        </div>
        )
      })()}
    </>
  )
}
