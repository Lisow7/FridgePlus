// Modale "Suggestions" du panier.
// S'ouvre quand le panier contient des articles : regroupe les idées de
// recettes et les ingrédients fréquents dans deux sections accordéon
// indépendantes, chacune rafraîchissable.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LuX, LuChefHat, LuPackage,
  LuChevronRight, LuCheck, LuPlus,
} from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useIngredients, useBaseRecipes } from '@shared/contexts/data-provider'
import { getFrequentIngredients } from '@features/cart/api/shopping-lists'
import { getPacksForIngredient } from '@features/cart/lib/cart-helpers'
import { buildIngredientIndex, pickDefaultIngredients } from '@features/cart/lib/ingredient-suggestions'
import CartSuggestionsSectionHeader from './cart-suggestions-section-header'

const I18N = {
  fr: {
    title: 'Suggestions',
    recipesLabel: 'Idées de recettes',
    ingredientsLabel: 'Souvent achetés',
    refreshRecipes: 'Nouvelles recettes',
    refreshIngredients: 'Autres suggestions',
    openRecipe: 'Voir la recette',
    addToCart: 'Ajouter',
    added: 'Ajouté',
    browseRecipes: 'Parcourir les recettes',
    close: 'Fermer',
  },
  en: {
    title: 'Suggestions',
    recipesLabel: 'Recipe ideas',
    ingredientsLabel: 'Frequently bought',
    refreshRecipes: 'New recipes',
    refreshIngredients: 'Other suggestions',
    openRecipe: 'View recipe',
    addToCart: 'Add',
    added: 'Added',
    browseRecipes: 'Browse recipes',
    close: 'Close',
  },
}

const DEFAULT_KEYWORD_SETS = [
  ['lait', 'œuf', 'pain', 'farine', 'beurre'],
  ['riz', 'pâtes', 'tomate', 'oignon', 'ail'],
  ['pomme de terre', 'carotte', 'poulet', 'fromage', 'citron'],
]

// `SectionHeader` extrait dans `./cart-suggestions-section-header.jsx`

/**
 * @param {object} props
 * @param {Function} props.onClose
 * @param {string} [props.lang='fr']
 * @param {boolean} [props.darkMode=false]
 * @param {string} [props.userId]
 * @param {Function} [props.onShowRecipes]
 * @param {Function} [props.onManualAdd]
 */
export default function CartSuggestionsModal({ onClose, lang = 'fr', darkMode = false, userId, onShowRecipes, onManualAdd, onAddToCart }) {
  const t = I18N[lang] ?? I18N.fr
  const containerRef = useRef(null)
  useFocusTrap(containerRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  const ingredientsByCat = useIngredients()
  const ingredientIndex = useMemo(() => buildIngredientIndex(ingredientsByCat), [ingredientsByCat])
  const { recipes, recipeNames } = useBaseRecipes()

  const [openSection, setOpenSection] = useState(null) // null | 'recipes' | 'ingredients'
  const [recipeSeed, setRecipeSeed]   = useState(0)
  const [ingPage, setIngPage]         = useState(0)
  const [frequents, setFrequents]     = useState([])
  const [pendingId, setPendingId]     = useState(null)
  const [addedId, setAddedId]         = useState(null)
  const [addedRecipeId, setAddedRecipeId] = useState(null)
  const addedRecipeTimer = useRef(null)
  useEffect(() => () => { if (addedRecipeTimer.current) clearTimeout(addedRecipeTimer.current) }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    getFrequentIngredients(userId, 15).then(freq => {
      if (alive) setFrequents(freq)
    })
    return () => { alive = false }
  }, [userId])

  // Recettes aléatoires
  const suggestedRecipes = useMemo(() => {
    const pool = (recipes ?? []).filter(r => r?.id)
    if (pool.length === 0) return []
    const count = Math.min(3, pool.length)
    const offset = (recipeSeed * 7 + 3) % pool.length
    return Array.from({ length: count }, (_, i) => pool[(offset + i * 11) % pool.length])
  }, [recipes, recipeSeed])

  // Ingrédients fréquents / défauts
  const personalSuggestions = useMemo(() =>
    (frequents ?? []).map(f => ingredientIndex.get(f.ingredient_id)).filter(Boolean),
  [frequents, ingredientIndex])

  // Mélange : jusqu'à 3 personnels + complète jusqu'à 5 avec les ingrédients
  // de base (rotation par set de mots-clés). Pas de doublons.
  const finalSuggestions = useMemo(() => {
    const seen = new Set()
    const result = []
    for (let i = 0; i < personalSuggestions.length && result.length < 3; i++) {
      const ing = personalSuggestions[(ingPage * 3 + i) % personalSuggestions.length]
      if (ing && !seen.has(ing.id)) { result.push(ing); seen.add(ing.id) }
    }
    const keywords = DEFAULT_KEYWORD_SETS[ingPage % DEFAULT_KEYWORD_SETS.length]
    for (const ing of pickDefaultIngredients(ingredientIndex, keywords)) {
      if (result.length >= 5) break
      if (!seen.has(ing.id)) { result.push(ing); seen.add(ing.id) }
    }
    return result
  }, [personalSuggestions, ingredientIndex, ingPage])

  async function handleAddIngredient(ing) {
    if (!onManualAdd || pendingId) return
    setPendingId(ing.id)
    // Filet de sécurité : si onManualAdd hang (Supabase lent, session expirée),
    // on relâche le verrou après 8 s pour éviter que tous les chips restent disabled.
    let timedOut = false
    const safetyTimer = setTimeout(() => {
      timedOut = true
      if (import.meta.env.DEV) console.warn('[suggestions] add timed out after 8s — releasing UI lock')
      setPendingId(null)
    }, 8000)
    try {
      const packs = getPacksForIngredient(ing.id, lang, ing.subcat)
      const pack = packs?.[0] ?? null
      const result = await onManualAdd({
        ingredient_id: ing.id,
        label: ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id,
        amount: pack?.size ?? 1,
        unit:   pack?.unit ?? 'pcs',
        price:  pack?.price ?? null,
      })
      if (timedOut || result?.error) return
      setAddedId(ing.id)
      setTimeout(() => setAddedId(null), 1200)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[suggestions] add failed:', err)
    } finally {
      clearTimeout(safetyTimer)
      if (!timedOut) setPendingId(null)
    }
  }

  // Couleurs
  const bg     = darkMode ? '#131E2C' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? 'rgba(240,232,220,0.65)' : 'rgba(44,26,14,0.60)'
  const border = darkMode ? 'rgba(247,168,94,0.25)' : 'rgba(212,106,16,0.20)'
  const cardBg = darkMode ? 'rgba(247,168,94,0.06)' : 'rgba(212,106,16,0.04)'
  const sectionBg = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(212,106,16,0.03)'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-suggestions-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        ref={containerRef}
        style={{
          background: bg, color: fg,
          border: `1px solid ${border}`, borderRadius: '14px',
          width: '100%', maxWidth: '460px',
          maxHeight: '80dvh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        }}>
          <span aria-hidden="true" style={{ fontSize: '20px', lineHeight: 1 }}>✨</span>
          <h2 id="cart-suggestions-title" style={{ flex: 1, margin: 0, fontSize: '15px', fontWeight: 700 }}>
            {t.title}
          </h2>
          <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
            className="h-[30px] w-[30px] rounded-lg"
            style={{ borderColor: border, color: muted }}
          >
            <LuX size={15} aria-hidden="true" />
          </Button>
        </div>

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* ─── Section Recettes ─── */}
          <div style={{
            border: `1.5px solid ${border}`, borderRadius: '12px',
            background: sectionBg, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px' }}>
              <CartSuggestionsSectionHeader
                id="sugg-recipes-title"
                icon={LuChefHat}
                label={t.recipesLabel}
                open={openSection === 'recipes'}
                onToggle={() => setOpenSection(s => s === 'recipes' ? null : 'recipes')}
                onRefresh={() => setRecipeSeed(s => s + 1)}
                refreshLabel={t.refreshRecipes}
                fg={fg} border={border} darkMode={darkMode}
              />
            </div>
            {openSection === 'recipes' && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suggestedRecipes.map(recipe => {
                  const name = recipeNames?.[recipe.id]?.[lang] ?? recipeNames?.[recipe.id]?.fr ?? recipe.id
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
                          if (addedRecipeTimer.current) clearTimeout(addedRecipeTimer.current)
                          addedRecipeTimer.current = setTimeout(() => {
                            setAddedRecipeId(null)
                          }, 1500)
                        }
                      }}
                      aria-label={`${t.addToCart} : ${name}`}
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
                        e.currentTarget.style.background = darkMode ? 'rgba(247,168,94,0.14)' : 'rgba(212,106,16,0.08)'
                        e.currentTarget.style.transform = 'translateX(2px)'
                      }}
                      onMouseLeave={e => {
                        if (!onAddToCart || isAdded) return
                        e.currentTarget.style.background = cardBg
                        e.currentTarget.style.transform = 'translateX(0)'
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>
                        {isAdded ? '✓' : (recipe.emoji ?? '🍽️')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: isAdded ? '#FFFFFF' : fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isAdded ? t.added : name}
                        </div>
                        {!isAdded && recipe.time && (
                          <div style={{ fontSize: '11px', color: darkMode ? 'var(--color-brand-400)' : '#C05010', marginTop: '2px', fontWeight: 500 }}>
                            ⏱ {recipe.time}
                          </div>
                        )}
                      </div>
                      {!isAdded && <LuChevronRight size={18} aria-hidden="true" style={{ color: darkMode ? 'var(--color-brand-400)' : '#C05010', flexShrink: 0 }} />}
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─── Section Ingrédients ─── */}
          <div style={{
            border: `1.5px solid ${border}`, borderRadius: '12px',
            background: sectionBg, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px' }}>
              <CartSuggestionsSectionHeader
                id="sugg-ingredients-title"
                icon={LuPackage}
                label={t.ingredientsLabel}
                open={openSection === 'ingredients'}
                onToggle={() => setOpenSection(s => s === 'ingredients' ? null : 'ingredients')}
                onRefresh={() => setIngPage(p => p + 1)}
                refreshLabel={t.refreshIngredients}
                fg={fg} border={border} darkMode={darkMode}
              />
            </div>
            {openSection === 'ingredients' && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {finalSuggestions.map(ing => {
                    const label = ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id
                    const isPending = pendingId === ing.id
                    const isAdded   = addedId === ing.id
                    const disabled  = !!pendingId && !isPending
                    return (
                      <Button
                        key={ing.id}
                        variant="ghost"
                        type="button"
                        onClick={() => handleAddIngredient(ing)}
                        disabled={disabled || isPending}
                        aria-label={`${t.addToCart} : ${label}`}
                        className="h-auto rounded-lg border-[1.5px] px-3 py-2 text-[13px] hover:bg-transparent disabled:opacity-45"
                        style={{
                          gap: '7px',
                          background: isAdded
                            ? 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)'
                            : cardBg,
                          borderColor: isAdded ? '#388E3C' : border,
                          color: isAdded ? '#FFFFFF' : fg,
                          fontWeight: isAdded ? 700 : 500,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          if (disabled || isPending || isAdded) return
                          e.currentTarget.style.background = darkMode
                            ? 'linear-gradient(135deg, rgba(247,168,94,0.22) 0%, rgba(212,106,16,0.12) 100%)'
                            : 'linear-gradient(135deg, rgba(247,168,94,0.22) 0%, rgba(212,106,16,0.12) 100%)'
                          e.currentTarget.style.borderColor = darkMode ? 'rgba(247,168,94,0.55)' : 'rgba(212,106,16,0.50)'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={e => {
                          if (disabled || isPending || isAdded) return
                          e.currentTarget.style.background = cardBg
                          e.currentTarget.style.borderColor = border
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>
                          {isAdded ? <LuCheck size={14} strokeWidth={3} /> : (ing.emoji ?? '🥕')}
                        </span>
                        <span>{isAdded ? t.added : label}</span>
                        {!isAdded && !isPending && (
                          <LuPlus size={11} aria-hidden="true" style={{ opacity: 0.5, marginLeft: '2px' }} />
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─── Bouton Parcourir les recettes ─── */}
          {onShowRecipes && (
            <Button
              variant="ghost"
              onClick={() => { onShowRecipes(); onClose() }}
              className="h-auto w-full gap-2 rounded-[12px] border-[1.5px] px-4 py-3 text-sm font-bold hover:-translate-y-px hover:bg-gradient-to-br hover:from-[rgba(247,168,94,0.22)] hover:to-[rgba(212,106,16,0.12)]"
              style={{
                borderColor: border,
                background: darkMode
                  ? 'linear-gradient(135deg, rgba(247,168,94,0.12) 0%, rgba(212,106,16,0.06) 100%)'
                  : 'linear-gradient(135deg, rgba(247,168,94,0.14) 0%, rgba(212,106,16,0.07) 100%)',
                color: darkMode ? 'var(--color-brand-400)' : '#C05010',
              }}
            >
              <LuChefHat size={16} aria-hidden="true" />
              {t.browseRecipes}
              <LuChevronRight size={15} aria-hidden="true" style={{ opacity: 0.7 }} />
            </Button>
          )}

        </div>
      </div>
    </div>
  )
}
