import { useState, useRef, useEffect, useMemo } from 'react'
import { LuChefHat, LuRefreshCw, LuChevronRight } from 'react-icons/lu'
import { useBaseRecipes } from '@shared/contexts/data-provider'
import Button from '@shared/ui/button'

// Section « Idées de recettes » de l'empty state du panier, extraite de
// `empty-basket-state.jsx` le 2026-07-30 (§2 audit front : aucun fichier
// composant > 500 lignes).
//
// Zone autonome : son état (graine de tirage + flash « ajouté ») n'était lu
// nulle part ailleurs dans le parent, il descend donc avec elle. Le parent ne
// passe plus que les tokens de thème et le callback d'ajout — pas de couche de
// transmission de props inventée pour l'occasion.
//
// Présentationnel côté données : le pool de recettes vient du contexte, comme
// dans le parent auparavant.
export default function EmptyBasketRecipeIdeas({
  lang, darkMode, t, onAddToCart,
  fg, border, sectionBg, cardBg,
}) {
  const { recipes, recipeNames } = useBaseRecipes()
  const [recipeSeed, setRecipeSeed] = useState(0)
  const [addedRecipeId, setAddedRecipeId] = useState(null)
  const addedRecipeTimerRef = useRef(null)

  useEffect(() => () => {
    if (addedRecipeTimerRef.current) clearTimeout(addedRecipeTimerRef.current)
  }, [])

  const suggestedRecipes = useMemo(() => {
    const pool = (recipes ?? []).filter(r => r?.id)
    if (pool.length === 0) return []
    const count = Math.min(3, pool.length)
    // Décalage pseudo-aléatoire avec pas premier pour couvrir le pool
    const offset = (recipeSeed * 7 + 3) % pool.length
    return Array.from({ length: count }, (_, i) => pool[(offset + i * 11) % pool.length])
  }, [recipes, recipeSeed])

  if (suggestedRecipes.length === 0) return null

  return (
    <section
      aria-labelledby="recipe-suggestions-title"
      style={{
        display: 'flex', flexDirection: 'column', gap: '8px',
        padding: '14px',
        background: sectionBg,
        border: `1.5px solid ${border}`,
        borderRadius: '14px',
      }}
    >
      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span aria-hidden="true" style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'linear-gradient(135deg, rgba(247,168,94,0.30) 0%, rgba(212,106,16,0.18) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: darkMode ? 'var(--color-brand-400)' : '#C05010',
        }}>
          <LuChefHat size={14} strokeWidth={2} />
        </span>
        <h3
          id="recipe-suggestions-title"
          style={{ flex: 1, margin: 0, fontSize: '13px', fontWeight: 700, color: fg, letterSpacing: '0.01em' }}
        >
          {t.recipeSuggestionsTitle}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRecipeSeed(s => s + 1)}
          title={t.refreshSuggestions}
          aria-label={t.refreshSuggestions}
          className="h-7 w-7 rounded-lg border hover:bg-[var(--color-warm-600)]/10"
          style={{ borderColor: border, color: darkMode ? 'var(--color-brand-400)' : '#C05010' }}
        >
          <LuRefreshCw size={13} aria-hidden="true" />
        </Button>
      </div>

      {/* Cards recettes */}
      {suggestedRecipes.map(recipe => {
        const name = recipeNames?.[recipe.id]?.[lang]
          ?? recipeNames?.[recipe.id]?.fr
          ?? recipe.id
        const isAdded = addedRecipeId === recipe.id
        return (
          <Button
            key={recipe.id}
            variant="ghost"
            type="button"
            onClick={async () => {
              if (!onAddToCart || isAdded) return
              const result = await onAddToCart(recipe, undefined, { ignoreStock: true })
              if (result !== 'duplicate') {
                setAddedRecipeId(recipe.id)
                if (addedRecipeTimerRef.current) clearTimeout(addedRecipeTimerRef.current)
                addedRecipeTimerRef.current = setTimeout(() => setAddedRecipeId(null), 1800)
              }
            }}
            aria-label={`${t.addToCart} : ${name}`}
            disabled={!onAddToCart}
            className="h-auto justify-start rounded-[10px] border-[1.5px] px-3 py-2.5 text-left hover:bg-transparent"
            style={{
              gap: '12px',
              background: isAdded
                ? 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)'
                : cardBg,
              borderColor: isAdded ? '#388E3C' : border,
              color: isAdded ? '#FFFFFF' : fg,
              transition: 'transform 0.15s, background 0.2s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              if (!onAddToCart || isAdded) return
              e.currentTarget.style.background = darkMode
                ? 'rgba(247,168,94,0.14)' : 'rgba(212,106,16,0.08)'
              e.currentTarget.style.borderColor = darkMode
                ? 'rgba(247,168,94,0.50)' : 'rgba(212,106,16,0.40)'
              e.currentTarget.style.transform = 'translateX(2px)'
            }}
            onMouseLeave={e => {
              if (!onAddToCart || isAdded) return
              e.currentTarget.style.background = cardBg
              e.currentTarget.style.borderColor = border
              e.currentTarget.style.transform = 'translateX(0)'
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>
              {isAdded ? '✓' : (recipe.emoji ?? '🍽️')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px', fontWeight: 600, color: isAdded ? '#FFFFFF' : fg,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {isAdded ? t.added : name}
              </div>
              {!isAdded && recipe.time && (
                <div style={{ fontSize: '11px', color: darkMode ? 'var(--color-brand-400)' : '#C05010', marginTop: '2px', fontWeight: 500 }}>
                  ⏱ {recipe.time}
                </div>
              )}
            </div>
            {!isAdded && (
              <span aria-hidden="true" style={{ color: darkMode ? 'var(--color-brand-400)' : '#C05010', flexShrink: 0 }}>
                <LuChevronRight size={18} />
              </span>
            )}
          </Button>
        )
      })}
    </section>
  )
}
