// Phase L.5 : empty state du panier avec suggestions.
//
// Refonte UX 2026-05-04 selon 7 axes :
//   1. HIÉRARCHIE   — Listes au-dessus (action de relance principale),
//                     ingrédients en-dessous (démarrage from scratch).
//   2. DENSITÉ      — Sections en cards avec backgrounds subtils. Padding
//                     intérieur 14-16px pour respirer sans éparpiller.
//   3. CARDS LISTES — Pastille colorée (orange brand) + nom + meta + icône
//                     "Charger" à droite. Hover plus marqué (translateX).
//   4. CHIPS        — Chips arrondis 999px, emoji 16px, hover gradient
//                     orange Fridge+. Grille auto-fit (responsive).
//   5. ILLUSTRATION — Pastille circulaire 80px avec icône panier 36px,
//                     gradient orange subtil. Texte d'accroche plus chaud.
//   6. CTA          — Bouton "Voir toutes mes listes" en outlined orange
//                     avec hover filled. Bouton "Sauvegarder" supprimé
//                     (panier vide → rien à sauver, n'a pas de sens UX).
//   7. CONTRASTE    — Variables CSS --color-warm-* et bordures 1.5px sur
//                     les cards pour mieux délimiter les sections.
//
// Logique progressive « ingrédients fréquents » (inchangée v3.55) :
//   - 0-2 listes sauvegardées → 5 défauts (lait, œufs, pain, farine, beurre)
//   - 3+ listes → top-5 personnels via getFrequentIngredients
//
// A11y :
//   - Sections en `<section aria-labelledby>` avec `<h3 id>` correspondant
//   - Boutons cards listes : `aria-label` complet ("Charger {nom} — N items")
//   - Chips ingrédients : `aria-label` "Ajouter {nom} au panier"
//   - Disabled states avec `aria-disabled` propre
//
// RGPD : aucune nouvelle donnée perso. Le calcul des fréquents agrège
// uniquement les `shopping_lists.items[].ingredient_id` du user (déjà
// persisté Phase L). Pas de localStorage / sessionStorage / tracking.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LuShoppingCart, LuPackage, LuArrowRight,
  LuCheck, LuRefreshCw,
} from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useIngredients } from '@shared/contexts/data-provider'
import { loadShoppingLists, getFrequentIngredients } from '@features/cart/api/shopping-lists'
import { getPacksForIngredient } from '@features/cart/lib/cart-helpers'
import { buildIngredientIndex, pickDefaultIngredients } from '@features/cart/lib/ingredient-suggestions'
import EmptyBasketRecipeIdeas from './empty-basket-recipe-ideas'
import EmptyBasketSavedLists from './empty-basket-saved-lists'

const I18N = {
  fr: {
    empty: 'Ton panier est vide',
    emptyHint: 'Reprends une liste, crée-en une nouvelle ou ajoute des ingrédients pour commencer.',
    activeListTitle: 'Suggestions pour ta liste',
    activeListHint: 'Recharge une liste existante, parcours des recettes ou ajoute des ingrédients via la barre de recherche.',
    myListsTitle: 'Mes listes récentes',
    myListsTitleActive: 'Reprendre depuis une liste',
    seeAllLists: 'Voir toutes mes listes',
    noListsYet: 'Aucune liste sauvegardée pour l\'instant. Quand tu auras un panier, tu pourras le sauvegarder ici.',
    suggestionsTitle: 'Souvent achetés',
    suggestionsHintDefault: 'Sélection de démarrage. Tes propositions s\'adapteront à mesure que tu sauvegardes des listes.',
    suggestionsHintPersonal: 'Selon tes listes sauvegardées.',
    addToCart: 'Ajouter au panier',
    listeEchec: 'La liste n’a pas pu être chargée. Réessaie.',
    ajoutEchec: 'L’ingrédient n’a pas pu être ajouté. Réessaie.',
    added: 'Ajouté',
    ctaCreateList: 'Créer une liste',
    ctaSeeMyLists: 'Voir mes listes',
    browseRecipes: 'Explorer des recettes',
    recipeSuggestionsTitle: 'Idées de recettes',
    refreshSuggestions: 'Nouvelles suggestions',
    openRecipe: 'Voir la recette',
    items: '{{n}} élément',
    items_plural: '{{n}} éléments',
    load: 'Charger',
    loadAria: 'Charger {{name}} — {{count}} dans le panier',
  },
  en: {
    empty: 'Your cart is empty',
    emptyHint: 'Reload a saved list, create a new one, or add ingredients to get started.',
    activeListTitle: 'Suggestions for your list',
    activeListHint: 'Load a previous list, browse recipes or add ingredients via the search bar above.',
    myListsTitle: 'My recent lists',
    myListsTitleActive: 'Copy from a previous list',
    seeAllLists: 'See all my lists',
    noListsYet: 'No saved lists yet. When you have a cart, you\'ll be able to save it here.',
    suggestionsTitle: 'Frequently bought',
    suggestionsHintDefault: 'Starter selection. Suggestions will adapt as you save lists.',
    suggestionsHintPersonal: 'Based on your saved lists.',
    addToCart: 'Add to cart',
    listeEchec: 'The list could not be loaded. Try again.',
    ajoutEchec: 'The ingredient could not be added. Try again.',
    added: 'Added',
    ctaCreateList: 'Create a list',
    ctaSeeMyLists: 'See my lists',
    browseRecipes: 'Browse recipes',
    recipeSuggestionsTitle: 'Recipe ideas',
    refreshSuggestions: 'New suggestions',
    openRecipe: 'View recipe',
    items: '{{n}} item',
    items_plural: '{{n}} items',
    load: 'Load',
    loadAria: 'Load {{name}} — {{count}} into the cart',
  },
}

// 3 sets de mots-clés par défaut pour les ingrédients — rotatifs au refresh.
const DEFAULT_KEYWORD_SETS = [
  ['lait', 'œuf', 'pain', 'farine', 'beurre'],
  ['riz', 'pâtes', 'tomate', 'oignon', 'ail'],
  ['pomme de terre', 'carotte', 'poulet', 'fromage', 'citron'],
]

/**
 * @param {object} props
 * @param {string} props.userId
 * @param {string} [props.lang='fr']
 * @param {boolean} [props.darkMode=false]
 * @param {Function} props.onManualAdd      — (item) => Promise
 * @param {Function} [props.onOpenLists]    — () => void
 * @param {Function} [props.onLoadList]     — async (items) => { error: object|null }
 * @param {number} [props.refreshKey=0]
 */
export default function EmptyBasketState({
  userId, lang = 'fr', darkMode = false,
  onManualAdd, onOpenLists, onLoadList, refreshKey = 0,
  isActiveListMode = false,
  onShowRecipes,
  onAddToCart,
}) {
  const t = I18N[lang] ?? I18N.fr
  const ingredientsByCat = useIngredients()
  const ingredientIndex = buildIngredientIndex(ingredientsByCat)

  const [recentLists, setRecentLists] = useState([])
  const [frequents, setFrequents]     = useState([])
  const [loadingId, setLoadingId]     = useState(null)
  const [ingPage, setIngPage]         = useState(0)
  const [pendingId, setPendingId] = useState(null)
  const [addedId, setAddedId]     = useState(null)
  // Un geste qui a échoué ('liste' ou 'ajout') : c'est dit, au lieu de rien
  // (relevé le 2026-10-08 — les deux résultats étaient jetés).
  const [echec, setEchec]         = useState(null)
  const addedTimerRef = useRef(null)
  useEffect(() => () => {
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    Promise.all([
      loadShoppingLists(userId),
      getFrequentIngredients(userId, 15), // 15 pour permettre la pagination
    ]).then(([lists, freq]) => {
      if (!alive) return
      setRecentLists(lists.slice(0, 3))
      setFrequents(freq)
    })
    return () => { alive = false }
  }, [userId, refreshKey])

  // Ingrédients fréquents de l'utilisateur (via ses listes sauvegardées)
  const personalSuggestions = (frequents ?? [])
    .map(f => ingredientIndex.get(f.ingredient_id))
    .filter(Boolean)

  // Mélange : jusqu'à 3 ingrédients personnels + complète jusqu'à 5 avec les
  // ingrédients de base (rotation par set de mots-clés). Pas de doublons.
  const finalSuggestions = useMemo(() => {
    const seen = new Set()
    const result = []
    // Tranche personnelle (paginée, pas de step fixe pour varier au refresh)
    for (let i = 0; i < personalSuggestions.length && result.length < 3; i++) {
      const ing = personalSuggestions[(ingPage * 3 + i) % personalSuggestions.length]
      if (ing && !seen.has(ing.id)) { result.push(ing); seen.add(ing.id) }
    }
    // Compléter avec les ingrédients de base (déduplication)
    const keywords = DEFAULT_KEYWORD_SETS[ingPage % DEFAULT_KEYWORD_SETS.length]
    // `fill` : l'empty state doit toujours proposer 5 chips — un bouche-trou
    // vaut mieux qu'une grille à moitié vide sur un écran déjà vide.
    for (const ing of pickDefaultIngredients(ingredientIndex, keywords, { fill: true })) {
      if (result.length >= 5) break
      if (!seen.has(ing.id)) { result.push(ing); seen.add(ing.id) }
    }
    return result
  }, [personalSuggestions, ingredientIndex, ingPage])

  // Couleurs adaptatives
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? 'rgba(240,232,220,0.65)' : 'rgba(44,26,14,0.60)'
  const border = darkMode ? 'rgba(247,168,94,0.28)' : 'rgba(212,106,16,0.22)'
  const cardBg = darkMode ? 'rgba(247,168,94,0.06)' : 'rgba(212,106,16,0.04)'
  const sectionBg = darkMode ? '#131E2C' : '#FFFFFF'

  async function handleAddIngredient(ing) {
    if (!onManualAdd || pendingId) return
    setPendingId(ing.id)
    // Filet de sécurité timeout. Si onManualAdd hang (Supabase
    // qui ne répond pas, session expirée silencieusement, etc.), le state
    // pendingId resterait bloqué et tous les chips disabled visuellement.
    // Après 8 s, on relâche le verrou. Le flag timedOut ignore le résultat
    // tardif pour éviter une animation "ajouté" hors-contexte.
    let timedOut = false
    const safetyTimer = setTimeout(() => {
      timedOut = true
      if (import.meta.env.DEV) {
        console.warn('[empty-basket] add timed out after 8s — releasing UI lock')
      }
      setPendingId(null)
    }, 8000)
    try {
      const packs = getPacksForIngredient(ing.id, lang, ing.subcat)
      const pack = packs?.[0] ?? null
      const item = {
        ingredient_id: ing.id,
        label: ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id,
        amount: pack?.size ?? 1,
        unit:   pack?.unit ?? 'pcs',
        price:  pack?.price ?? null,
      }
      const result = await onManualAdd(item)
      if (timedOut) return
      if (result?.error) { setEchec('ajout'); return }
      setEchec(null)
      setAddedId(ing.id)
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
      addedTimerRef.current = setTimeout(() => setAddedId(null), 1200)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[empty-basket] add failed:', err)
      setEchec('ajout')
    } finally {
      clearTimeout(safetyTimer)
      if (!timedOut) setPendingId(null)
    }
  }

  async function handleLoadList(list) {
    if (!onLoadList || loadingId) return
    setLoadingId(list.id)
    try {
      // passe { id, name } pour tracker la liste chargée
      const resultat = await onLoadList(list.items ?? [], { id: list.id, name: list.name })
      setEchec(resultat?.error ? 'liste' : null)
    } catch {
      setEchec('liste')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px 2px' }}>

      {/* ─── 1. Illustration empty (chaleureuse, pas triste) ──────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '10px', padding: '12px 12px 4px', textAlign: 'center',
      }}>
        <div aria-hidden="true" style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: darkMode
            ? 'linear-gradient(135deg, rgba(247,168,94,0.20) 0%, rgba(212,106,16,0.10) 100%)'
            : 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.10) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: darkMode ? 'var(--color-brand-400)' : '#C05010',
          boxShadow: darkMode
            ? '0 8px 24px rgba(212,106,16,0.20), inset 0 1px 0 rgba(247,168,94,0.30)'
            : '0 8px 24px rgba(212,106,16,0.15)',
        }}>
          <LuShoppingCart size={36} strokeWidth={1.6} />
        </div>
        <h2 style={{
          margin: 0, fontSize: '17px', fontWeight: 700, color: fg,
        }}>
          {isActiveListMode ? t.activeListTitle : t.empty}
        </h2>
        <p style={{
          margin: 0, fontSize: '13px', color: muted, lineHeight: 1.5,
          maxWidth: '320px',
        }}>
          {isActiveListMode ? t.activeListHint : t.emptyHint}
        </p>
        {echec && (
          <p role="alert" style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-danger)', maxWidth: '320px' }}>
            {echec === 'liste' ? t.listeEchec : t.ajoutEchec}
          </p>
        )}
        {isActiveListMode && onShowRecipes && (
          <Button
            variant="ghost"
            onClick={onShowRecipes}
            className="h-auto gap-1.5 rounded-lg border-[1.5px] px-4 py-[9px] text-[13px] font-bold hover:bg-[var(--color-warm-600)]/10"
            style={{
              borderColor: darkMode ? 'rgba(247,168,94,0.45)' : 'rgba(212,106,16,0.40)',
              color: darkMode ? 'var(--color-brand-400)' : '#C05010',
            }}
          >
            <LuArrowRight size={14} aria-hidden="true" />
            {t.browseRecipes}
          </Button>
        )}
      </div>

      {/* ─── 2. Mes listes récentes — extraite dans EmptyBasketSavedLists ─ */}
      <EmptyBasketSavedLists
        recentLists={recentLists}
        loadingId={loadingId}
        onLoad={handleLoadList}
        onOpenLists={onOpenLists}
        isActiveListMode={isActiveListMode}
        lang={lang}
        darkMode={darkMode}
        t={t}
        fg={fg}
        muted={muted}
        border={border}
        sectionBg={sectionBg}
        cardBg={cardBg}
      />


      {/* ─── 3. Ingrédients fréquents (démarrage from scratch) ────────── */}
      <section
        aria-labelledby="frequent-ingredients-title"
        style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          padding: '14px',
          background: sectionBg,
          border: `1.5px solid ${border}`,
          borderRadius: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true" style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(247,168,94,0.30) 0%, rgba(212,106,16,0.18) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: darkMode ? 'var(--color-brand-400)' : '#C05010',
          }}>
            <LuPackage size={14} strokeWidth={2} />
          </span>
          <h3
            id="frequent-ingredients-title"
            style={{ flex: 1, margin: 0, fontSize: '13px', fontWeight: 700, color: fg, letterSpacing: '0.01em' }}
          >
            {t.suggestionsTitle}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIngPage(p => p + 1)}
            title={t.refreshSuggestions}
            aria-label={t.refreshSuggestions}
            className="h-7 w-7 rounded-lg border hover:bg-[var(--color-warm-600)]/10"
            style={{ borderColor: border, color: darkMode ? 'var(--color-brand-400)' : '#C05010' }}
          >
            <LuRefreshCw size={13} aria-hidden="true" />
          </Button>
        </div>

        <div style={{
          fontSize: '11px', color: muted, lineHeight: 1.4,
          fontStyle: 'italic',
        }}>
          {personalSuggestions.length > 0 ? t.suggestionsHintPersonal : t.suggestionsHintDefault}
        </div>

        {/* Chips ingrédients : grille auto-fit responsive */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px',
        }}>
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
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(247,168,94,0.22) 0%, rgba(212,106,16,0.12) 100%)'
                  e.currentTarget.style.borderColor = darkMode
                    ? 'rgba(247,168,94,0.55)'
                    : 'rgba(212,106,16,0.50)'
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
              </Button>
            )
          })}
        </div>
      </section>

      {/* ─── 4. Idées de recettes — extraite dans EmptyBasketRecipeIdeas ─── */}
      <EmptyBasketRecipeIdeas
        lang={lang}
        darkMode={darkMode}
        t={t}
        onAddToCart={onAddToCart}
        fg={fg}
        border={border}
        sectionBg={sectionBg}
        cardBg={cardBg}
      />
    </div>
  )
}
