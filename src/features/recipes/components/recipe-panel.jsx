import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAhaTick } from '../hooks/use-aha-tick'
import { savePanelScroll, peekPanelScroll, clearPanelScroll, findScrollAnchor, applyScrollRestore, RECIPES_PANEL_SCROLL_KEY } from '@shared/lib/scroll/scroll-memory'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useRecipeForm } from '@shared/contexts/recipe-form-context'
import { useBaseRecipes } from '@shared/contexts/data-provider'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useRecipeFilters } from '@features/recipes/hooks/use-recipe-filters'
import { SEUIL_ROULETTE } from '@shared/lib/recipes/recipe-thresholds'
import RecipeFiltersBar from './recipe-filters-bar'
import RecipePanelHeader from './recipe-panel-header'
import RecipePanelModals from './recipe-panel-modals'
import { PANEL_I18N } from '@shared/static/recipe-panel-i18n'
import RecipeCard from './recipe-card'
import RecipeResultsCount from './recipe-results-count'
import { EmptyFavorites, EmptyCustomRecipes, EmptyGeneric } from './recipe-empty-state'
import { loadBulkAggregates } from '@features/recipes/api/recipe-reviews'
import { logError } from '@shared/lib/observability/sentry'
import Button from '@shared/ui/button'

// Sprint 11 S11.e.1 — RecipeFormModal LIFTÉ : import désormais dans
// AppOverlays au top-level d'App.jsx (rendu via RecipeFormProvider).
// Sprint 11 S11.e.2 — RecipeModal LIFTÉ : le détail recette est désormais
// la page routée /recipe/:id (RecipePage). Le clic sur une carte y navigue.

export default function RecipePanel({
  stock, onClose, onReset,
  favorites = new Set(), onToggleFavorite,
  lang = 'fr', darkMode = false,
  customRecipes = [], publicRecipes = [],
  // Sprint 11 S11.e.1 — onSaveCustomRecipe retiré : le RecipeFormModal
  // est désormais rendu au top-level d'App.jsx (RecipeFormOverlay) qui
  // a directement accès à handleSaveCustomRecipe.
  // Sprint 11 S11.e.2 — onToggleIngredient / onDeleteCustomRecipe /
  // onShowSupport retirés : le détail n'est plus rendu localement
  // (cf. RecipePage routée /recipe/:id branchée sur les contexts
  // Session + DeletingRecipe).
  onMarkAdminModifiedRead,
  allergenPrefs = [], onAddToCart, basketRecipeIds,
  leftovers = [],
  // Onboarding step 2 : callback appelé quand une recette de la liste triée
  // par stock est ouverte (pas une recherche libre). Optionnel — no-op si absent.
  onSuggestionOpen,
}) {
  const { user }                              = useAuth()
  const { recipes: RECIPES, recipeNames: RECIPE_NAMES } = useBaseRecipes()
  const windowWidth                           = useWindowWidth()
  const isMobile                              = windowWidth < 768
  const isDesktop                             = windowWidth >= 1024
  const t                                     = PANEL_I18N[lang] ?? PANEL_I18N.fr

  const panelRef         = useRef(null)
  const scrollRef        = useRef(null)
  const champRechercheRef = useRef(null)
  const [showScrollTop,      setShowScrollTop]      = useState(false)
  // Restauration du scroll au retour depuis une page recette. Peek PUR
  // (sans effet de bord — StrictMode double-invoque l'initialiseur) :
  // { y, count } ou null. Le `count` réhydrate la pagination pour que les
  // cartes profondes soient rendues avant qu'on rétablisse `scrollTop`.
  // La consommation (clear) se fait dans un effet ci-dessous.
  const [initialRestore] = useState(() => peekPanelScroll(RECIPES_PANEL_SCROLL_KEY))
  const restorePending = useRef(!!initialRestore)
  // La restauration se rejoue quand le panneau a fini d'entrer. Pendant qu'il
  // glisse depuis le bas, la liste est hors écran : ses cartes
  // (`content-visibility: auto`) n'ont pas leur vraie hauteur, la position
  // calculée est fausse, et l'ancrage du navigateur garde ensuite la mauvaise
  // carte. Les notes, en arrivant, la recalculaient ; sans base (réseau coupé,
  // CI), rien ne le faisait (07/10 : 5 retours faux sur 5).
  const rejouerLaRestauration = useCallback((e) => {
    if (e.target !== e.currentTarget || !restorePending.current || !initialRestore) return
    applyScrollRestore(scrollRef.current, initialRestore)
  }, [initialRestore])
  // Pagination de la liste recettes (perf mobile).
  // Avant : tous les RecipeCard (jusqu'à 1700) rendus dans le DOM →
  // CPU/mémoire mobile bloquée. Maintenant : 50 visibles initialement,
  // +50 dès que le scroll arrive à 400px du bas. Reset à 50 quand
  // les filtres changent (filtered change de référence).
  const [visibleCount, setVisibleCount] = useState(
    () => Math.max(50, initialRestore?.count ?? 0)
  )
  // Sprint 11 S11.e.2 — activeRecipe state SUPPRIMÉ. Le clic sur une
  // RecipeCard navigue vers /recipe/:id (page pleine). On mémorise la
  // position de scroll + pagination avant de partir → restaurées au retour.
  const navigate = useNavigate()
  // `visibleCount` est lu via une ref, pas capturé en dépendance : il change à
  // chaque palier du scroll infini (+50), ce qui recréerait ce callback, donc
  // la prop `onOpen` de chaque RecipeCard, donc casserait leur `memo`. La ref
  // donne la valeur courante au moment du clic sans lier l'identité du callback.
  const visibleCountRef = useRef(visibleCount)
  useEffect(() => { visibleCountRef.current = visibleCount }, [visibleCount])
  const openRecipePage = useCallback((recipe) => {
    const id = recipe?.id ?? (typeof recipe === 'string' ? recipe : null)
    if (!id) return
    savePanelScroll(RECIPES_PANEL_SCROLL_KEY, {
      y: scrollRef.current?.scrollTop ?? 0,
      count: visibleCountRef.current,
      ...findScrollAnchor(scrollRef.current),
    })
    navigate(`/recipe/${id}`)
  }, [navigate])
  // openEditForm passé via useRecipeForm. openCreate utilisé par les
  // boutons Créer (FAB orange + empty state).
  const { openCreate: openCreateForm } = useRecipeForm()
  const [showRouletteAlert,  setShowRouletteAlert]   = useState(false)
  const [showResetConfirm,   setShowResetConfirm]    = useState(false)
  // Drawer latéral filtres (PR 8.7.a). Remplace l'ancienne
  // section collapsible « Filtres avancés » + résumé chips actifs.
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)
  const [ratingsMap,         setRatingsMap]          = useState({})
  // Sprint 11 S11.e.2 — prevActiveRef SUPPRIMÉ (was used to fetchRatings
  // when activeRecipe modal closed — activeRecipe state lui-même retiré).

  // Le curseur de budget suit la visibilité des coûts (carte, onglet « Coût ») :
  // Premium seulement (audit du 2026-10-04, UX-07).
  const { hasPremiumAccess } = useSubscription()
  const filters = useRecipeFilters({
    recipes: RECIPES, stock, lang,
    favorites, customRecipes, publicRecipes, leftovers,
    RECIPE_NAMES,
    budgetVisible: hasPremiumAccess,
  })

  const { filtered, criteriaKey, counts, readyCount, searchQuery, filter, setFilter, resetFilters } = filters

  // Fix C — étape Aha : déclenche onSuggestionOpen dès que l'utilisateur voit
  // réellement une recette READY (pas simplement à l'ouverture du panneau).
  useAhaTick({ open: true, stockSize: stock?.size ?? 0, readyCount, searchQuery, onSuggestionOpen })

  const displayed = filtered

  // Handler d'ouverture d'une carte. Défini ici et mémoïsé plutôt qu'en flèche
  // inline dans le `.map()` : une flèche inline est une nouvelle référence à
  // chaque render du panneau, ce qui rendait le `memo()` de RecipeCard
  // inopérant — mesuré avant correction, ouvrir le tiroir de filtres
  // re-rendait les 50 cartes affichées alors qu'aucune de leurs données ne
  // change. `searchQuery` passe par une ref pour la même raison : le capturer
  // en dépendance recréerait le callback à chaque frappe.
  const searchQueryRef = useRef(searchQuery)
  useEffect(() => { searchQueryRef.current = searchQuery }, [searchQuery])
  const handleOpenRecipe = useCallback((r) => {
    // Onboarding étape Aha : ne coche QUE sur une recette READY
    // (matchPercent === 1, cuisinable maintenant) hors recherche —
    // pas sur ALMOST/0% (sinon faux-progrès, cf. Blocker A spec fil
    // rouge). Auth-indépendant : invité ('guest') comme connecté.
    if (!searchQueryRef.current.trim() && r.matchPercent === 1) onSuggestionOpen?.()
    openRecipePage(r)
  }, [onSuggestionOpen, openRecipePage])

  // Compteur de filtres actifs (affiché sur le bouton « Filtres »
  // et dans le badge header du drawer). N'inclut pas la recherche ni les
  // tabs primaires (Toutes/Prêtes/Presque/Favoris/Custom) qui ont leur
  // propre signalisation dans la barre du haut.
  // Options pays issues des recettes disponibles

  function pickRandomRecipe() {
    const eligible = filtered.filter(r => r.matchPercent >= SEUIL_ROULETTE)
    if (eligible.length === 0) { setShowRouletteAlert(true); return }
    // Sprint 11 S11.e.2 — navigate au lieu de setActiveRecipe : la
    // recette piochée s'ouvre en overlay /recipe/:id par-dessus le panel.
    openRecipePage(eligible[Math.floor(Math.random() * eligible.length)])
  }

  function handleResetPanel() {
    resetFilters()
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  // Échap ferme le panneau via `useFocusTrap({ onEscape })` plus bas, et non un
  // écouteur `window` : celui-ci ignorait la pile des pièges, et Échap dans le
  // tiroir des filtres fermait les DEUX (audit 2026-10-02).

  const fetchRatings = useCallback((ids) => {
    if (!ids?.length) { setRatingsMap({}); return }
    // Une lecture de la vue des agrégats (PERF-12) ; une erreur ne change rien
    // à l'écran (les étoiles manquent) mais va au journal au lieu de se taire.
    loadBulkAggregates(ids).then(({ aggregates, error }) => {
      setRatingsMap(aggregates)
      if (error) logError(error, { tag: 'notes.lecture' })
    })
  }, [])

  // Clé stable sur le CONTENU des ids : `filtered` change de référence plusieurs
  // fois au montage (scoring, stock différé) alors que la liste d'ids est souvent
  // identique → sans ça, on refetch les notes en double/triple. On ne refetch que
  // si l'ensemble des ids change réellement.
  const ratingIdsKey = useMemo(() => filtered.map(r => r.id).join(','), [filtered])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRatings(ratingIdsKey ? ratingIdsKey.split(',') : [])
  }, [ratingIdsKey, fetchRatings])

  const filteredRef = useRef(filtered)
  useEffect(() => { filteredRef.current = filtered }, [filtered])

  // Reset pagination + scroll top au changement de filtres.
  // setState dans effect = pattern requis (sync UI dépendante de prop).
  // Exception : tant qu'une restauration est en attente (retour depuis une
  // page recette), on ne reset PAS — on RÉ-applique la pagination + le
  // scroll mémorisés. `filtered` peut changer plusieurs fois au montage
  // (données async qui se stabilisent) et StrictMode rejoue les effets ;
  // on ré-applique idempotemment à chaque passe. Le flag se lève au
  // premier geste réel de l'utilisateur (cf. effet listeners ci-dessous).
  const lastCriteriaKey = useRef(criteriaKey)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (restorePending.current && initialRestore) {
      setVisibleCount((c) => Math.max(c, initialRestore.count, 50))
      applyScrollRestore(el, initialRestore)
      return
    }
    // Le reset ne suit que `criteriaKey` : une nouvelle référence de `filtered`
    // venue d'un like (favorites) ou du stock ne doit pas faire bouger la liste.
    if (lastCriteriaKey.current === criteriaKey) return
    lastCriteriaKey.current = criteriaKey
    setVisibleCount(50)
    if (el) el.scrollTop = 0
  // `ratingsMap` : les notes arrivent après coup et changent la hauteur des
  // cartes — la restauration doit se réappliquer à ce moment-là aussi.
  }, [filtered, criteriaKey, initialRestore, ratingsMap])

  // Fin de la restauration au 1er geste réel (molette / tactile / clic /
  // clavier). Les `scrollTop = …` programmatiques ne déclenchent PAS
  // wheel/touchstart → la restauration ne s'auto-annule pas. Une fois
  // levé, le reset normal au changement de filtres reprend.
  useEffect(() => {
    if (!initialRestore) return
    const scrollEl = scrollRef.current
    const panelEl = panelRef.current
    const stop = () => { restorePending.current = false }
    scrollEl?.addEventListener('wheel', stop, { passive: true, once: true })
    scrollEl?.addEventListener('touchstart', stop, { passive: true, once: true })
    panelEl?.addEventListener('pointerdown', stop, { once: true })
    panelEl?.addEventListener('keydown', stop, { once: true })
    return () => {
      scrollEl?.removeEventListener('wheel', stop)
      scrollEl?.removeEventListener('touchstart', stop)
      panelEl?.removeEventListener('pointerdown', stop)
      panelEl?.removeEventListener('keydown', stop)
    }
  }, [initialRestore])

  // Consomme la position mémorisée (clear) au montage : un refresh ne doit
  // pas ré-appliquer un scroll obsolète. La valeur est déjà capturée dans
  // `initialRestore` (state) — clear est idempotent et StrictMode-safe.
  useEffect(() => {
    if (initialRestore) clearPanelScroll(RECIPES_PANEL_SCROLL_KEY)
  }, [initialRestore])

  // Sprint 11 S11.e.2 — fetchRatings on activeRecipe close SUPPRIMÉ
  // (activeRecipe state n'existe plus). Les ratings sont fetched au
  // mount via l'effect initial. Pas critique : les notes ne changent
  // pas pendant la session.
  // Sprint 11 S11.e.1 — showForm de useRecipeForm n'est plus consommé
  // ici (le form est rendu top-level). Focus trap conditionne juste sur
  // l'absence de modale interne — ici aucune, donc always-active.
  useFocusTrap(panelRef, { active: true, onEscape: onClose })
  useCloseOnBackButton(true, onClose)

  const borderPanel = 'var(--panel-border)'
  const bgPanel     = 'var(--panel-bg)'

  // Objets regroupés, hissés hors du JSX : un littéral inline créerait une
  // nouvelle référence à chaque render, ce qui rendrait un `memo()` sur ces
  // enfants inopérant — cf. le commentaire sur openRecipePage plus haut.
  const theme = { darkMode, isMobile, borderPanel }
  const headerActions = { onClose, pickRandomRecipe, handleResetPanel, openCreateForm, setShowResetConfirm }
  const overlayUi = {
    showResetConfirm, setShowResetConfirm,
    showRouletteAlert, setShowRouletteAlert,
    filtersDrawerOpen, setFiltersDrawerOpen,
  }

  // Chip de filtre responsive : icon-only sur mobile quand inactif,
  // icon + label quand actif (chip actif reçoit 3× plus d'espace flex).
  // NB. Sous-composant local utilisé 5×. Le rule react-hooks/static-components
  // suggère de le sortir, mais il a besoin de closure sur isMobile/darkMode ;
  // chaque call-site est suppress unitairement.
  return (
    <>
      {/* Keyframe du point de découvrabilité "Prêt" — dupliqué depuis
          footer.jsx (même pattern que le point "nouveautés" de version) */}
      <style>{`
        @keyframes fridge-version-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>

      {/* Backdrop.
          🔴 PAS de backdropFilter ici : mesuré le 2026-08-27 (Playwright, 515
          cartes montées), un `blur(3px)` sur ce voile plein écran re-floute
          l'arrière-plan À CHAQUE FRAME de défilement du panneau au-dessus —
          24 fps avec, 60 fps sans, et c'était l'UNIQUE cause (toutes les
          autres pistes bissectées : images, ombres, contenu des cartes).
          Un flou de backdrop ne coûte rien sous un contenu STATIQUE (les
          autres modales le gardent) ; sous une liste défilante, il tue les
          FPS. Le voile légèrement plus sombre compense l'absence de flou. */}
      <div
        className="fixed inset-0 z-40 fp-modal-backdrop"
        style={{ background: 'rgba(18,10,4,0.45)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        onAnimationEnd={rejouerLaRestauration}
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        className="fixed flex flex-col overflow-hidden z-50"
        style={{
          ...(isDesktop ? { top: 0, right: 0, width: '620px', height: '100dvh' } : { inset: 0 }),
          borderLeft: isDesktop ? '3px solid #E07820' : 'none',
          background: bgPanel,
          boxShadow: isDesktop ? (darkMode ? '-8px 0 32px rgba(0,0,0,0.45)' : '-8px 0 32px rgba(0,0,0,0.16)') : 'none',
          animation: isMobile
            ? 'panel-slide-up 0.38s cubic-bezier(0.34,1.06,0.64,1) both'
            : 'panel-slide-in 0.38s cubic-bezier(0.34,1.06,0.64,1) both',
        }}
      >

        <RecipePanelHeader
          t={t} stock={stock} user={user}
          borderPanel={borderPanel} bgPanel={bgPanel}
          actions={headerActions}
        />

        <RecipeFiltersBar
          filters={filters}
          theme={theme}
          t={t}
          stock={stock}
          setFiltersDrawerOpen={setFiltersDrawerOpen}
          searchRef={champRechercheRef}
        />

        {/* ── Liste recettes ──────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 relative">
          <div
            ref={scrollRef}
            onScroll={e => {
              const el = e.currentTarget
              setShowScrollTop(el.scrollTop > 80)
              // Charge +50 cards quand on s'approche du bas
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 400
              if (nearBottom) {
                setVisibleCount(c => (c < filtered.length ? Math.min(c + 50, filtered.length) : c))
              }
            }}
            className="absolute inset-0 overflow-y-auto flex flex-col gap-2.5 p-3"
          >
            <RecipeResultsCount count={filtered.length} t={t} />
            {filtered.length === 0 ? (
              filter === 'favorites' ? (
                <EmptyFavorites
                  darkMode={darkMode}
                  t={t}
                  stockSize={stock.size}
                  onShowRecipes={setFilter}
                  onSearch={() => champRechercheRef.current?.focus()}
                />
              ) : filter === 'custom' ? (
                <EmptyCustomRecipes
                  darkMode={darkMode}
                  t={t}
                  onCreate={openCreateForm}
                />
              ) : (
                <EmptyGeneric
                  t={t}
                  stockSize={stock.size}
                  darkMode={darkMode}
                  onResetFilters={resetFilters}
                  onOpenFridge={onClose}
                />
              )
            ) : (
              <>
                {displayed.slice(0, visibleCount).map(recipe => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    lang={lang}
                    darkMode={darkMode}
                    stock={stock}
                    isFavorite={favorites.has(recipe.id)}
                    onToggleFavorite={onToggleFavorite}
                    onOpen={handleOpenRecipe}
                    allergenPrefs={allergenPrefs}
                    onMarkAdminModifiedRead={onMarkAdminModifiedRead}
                    onAddToCart={onAddToCart}
                    basketRecipeIds={basketRecipeIds}
                    rating={ratingsMap[recipe.id] ?? null}
                    t={t}
                  />
                ))}
                {/* v3.214.0 — Sentinel + indicateur "X recettes restantes"
                    affiché quand la pagination n'a pas encore tout chargé.
                    Le scroll proche du bas déclenche +50 automatiquement. */}
                {visibleCount < filtered.length && (
                  <div style={{
                    padding: '12px 8px', textAlign: 'center',
                    fontSize: '12px', color: 'var(--color-muted)',
                    fontWeight: 600,
                  }}>
                    {t.remainingCount(filtered.length - visibleCount)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* FAB scroll-top */}
          <Button
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={t.scrollTopLabel}
            className="absolute bottom-5 right-6 h-14 w-14 rounded-2xl bg-none bg-[#B85000] p-0 shadow-[0_4px_16px_rgba(184,80,0,0.32)] hover:opacity-100"
            style={{
              transform: showScrollTop ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.85)',
              opacity: showScrollTop ? 0.9 : 0,
              pointerEvents: showScrollTop ? 'auto' : 'none',
              transition: 'opacity 0.25s ease, transform 0.25s ease',
              zIndex: 10,
            }}
          >
            {[0, 0.9].map((delay, i) => (
              <div key={i} className="absolute inset-0 rounded-full" style={{
                border: '1.5px solid rgba(224,120,32,0.45)',
                animation: showScrollTop ? `tap-ring 2.2s ease-out ${delay}s infinite` : 'none',
              }} />
            ))}
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none" style={{ position: 'relative', zIndex: 1 }}>
              <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Sprint 11 S11.e.1 — RecipeFormModal LIFTÉ au top-level d'App.jsx
          (via RecipeFormProvider). Permet de l'ouvrir depuis n'importe
          quelle route (RecipePage cold/overlay, futur FAB quick-create…).
          Sprint 11 S11.e.2 — RecipeModal local SUPPRIMÉ : clic recette
          → navigate('/recipe/:id') (page pleine RecipePage).
          Edit/delete pour custom recipes owned : RecipePage.jsx les
          branche sur useRecipeForm + useDeletingRecipe contexts. */}

      <RecipePanelModals
        filters={filters}
        ui={overlayUi}
        t={t} lang={lang} darkMode={darkMode} isMobile={isMobile}
        counts={counts}
        filtered={filtered} onReset={onReset}
      />
    </>
  )
}
