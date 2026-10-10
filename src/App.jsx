import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { isRecipesPanelOpen, withRecipesPanel } from '@shared/lib/recipes/recipes-panel-param'
import { parentIdsInStock } from '@shared/lib/fridge/parent-stock'
import { useEmailLinkBanner } from '@shared/hooks/use-email-link-banner'
import { useSharedBasketId, useSubscriptionActivated } from '@shared/hooks/use-url-boot-effects'
import { useSeoMeta } from '@shared/hooks/use-seo-meta'
import { useAppModals } from '@app/hooks/use-app-modals'
import { useAdminBadges } from '@app/hooks/use-admin-badges'
import { useFridgeDoors } from '@app/hooks/use-fridge-doors'
import { useBasketToasts } from '@app/hooks/use-basket-toasts'
import { useBasketActions } from '@app/hooks/use-basket-actions'
import { useCustomRecipesHandlers } from '@app/hooks/use-custom-recipes-handlers'
import { useUserSession } from '@app/hooks/use-user-session'
import { useResponsiveLayout } from '@app/hooks/use-responsive-layout'
import { resolveFridgeLayout } from '@shared/lib/resolve-fridge-layout'
import { useAppNavigation } from '@app/hooks/use-app-navigation'
import AppOverlays from '@app/components/app-overlays'
import TopBanners from '@app/components/top-banners'
import AppFooter from '@app/layout/app-footer'
import AppShell from '@app/layout/app-shell'
import RecipeFormOverlay from '@app/components/recipe-form-overlay'
// Imports STATIQUES (l'ancien commentaire « Lazy split » mentait) ; le différé réel vit plus bas : fuse.js et le JSON des prix, à l'usage.
import { useVoiceFlow } from '@app/hooks/use-voice-flow'
import { useReceiptScanFlow } from '@app/hooks/use-receipt-scan-flow'
import { useIngredients, useFridgeLayouts, useIngredientsById, useGroupMaps } from '@shared/contexts/data-provider'
import { SEO_META } from '@shared/static/seo-meta'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useAuth } from '@shared/contexts/auth-provider'
import { needsUsername } from '@features/auth/lib/needs-username'
// Sprint 11 S11.c.2 — useFridgeStock + useFavorites désormais
// consommés via SessionStateProvider (cf. main.jsx). Les hooks sont
// instanciés UNE seule fois dans le Provider et exposés via context
// pour que les routes (RecipePage cold-load) y aient accès.
import { useStockSession, useFavoritesSession, useCartSession } from '@shared/contexts/session-state-context'
import { useDeletingRecipe } from '@shared/contexts/deleting-recipe-context'
import { usePublicRecipesOnDemand } from '@app/hooks/use-public-recipes-on-demand'
import PageSkeleton from '@routes/page-skeleton'
import { useLang, useDarkMode } from '@shared/contexts/ui-provider'
// Sprint 6 PR S6.c — ToastProvider monté dans main.jsx,
// `useToast()` accessible depuis n'importe quel composant descendant.
import { UndoProvider } from '@shared/contexts/undo-provider'
import { NotificationsProvider } from '@features/notifications/providers/notifications-provider'
import { shouldOpenWelcome, markSuggestionOpened } from '@features/onboarding'
import { computeStapleIds } from '@features/recipes/lib/pantry-staples'
import { useLeftovers } from '@features/fridge/hooks/use-leftovers'
import { SubscriptionModalProvider, useUpgradeModal } from '@shared/contexts/subscription-modal-provider'
import { useSubscription } from '@shared/hooks/use-subscription'

// ── Code splitting : lazy-loaded au premier affichage
// L'écran du premier pseudo (et sa liste de gros mots) ne sert qu'une fois par
// compte (audit du 2026-10-04, PERF-03).
const ChooseUsernamePage = lazy(() => import('@features/auth/pages/choose-username-page'))
// Réduit le bundle initial de ~30% et améliore le FCP/LCP.
// AdminPanel (2030 lignes) chargé seulement pour les admins.
// Modales rares (Auth, Profile, Voice, Cart, Leftovers) chargées au clic.
// v3.20.5 : ajout de 5 composants supplémentaires (RecipeModal, SubcategoryModal,
// RecipeDeleteConfirmModal, SupportPanel, BannedScreen) pour réduire le JS unused
// au boot mesuré par Lighthouse mobile (~135 KiB d'unused dans index.js).

// Sprint 6 PR S6.a — `detectLang` + `SUPPORTED_LANGS` migrés
// vers `shared/contexts/ui-provider.jsx` (logique de détection encapsulée
// avec le state lang dans UIProvider).

function AppInner() {
 // Hook de test ErrorBoundary global (cf. src/lib/devCrashTrigger.js).
 // En prod l'import dynamique n'est jamais déclenché, et `?crash=1` n'a
 // aucun effet (le fichier `devCrashTrigger.js` n'est même pas dans le bundle).
 if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('crash')) {
 throw new Error('Dev crash trigger: app-level (ErrorBoundary global)')
 }
 const { user, profile, loading: authLoading, signOut, recoveryMode, isAdmin, allergenPrefs, restoreAccount, refreshProfile } = useAuth()
 const { isTrialing, trialDaysLeft, isPremium } = useSubscription()
 const { isUpgradeOpen, openUpgradeModal, closeUpgradeModal } = useUpgradeModal()

 // `useLocation()` est appelé ICI, avant `useAppModals` : la valeur y est
 // initiale (`useReducer`), lue au premier rendu seulement.
 const location = useLocation()
 // Welcome screen au 1er lancement, ET seulement sur la home : sur `/faq` ou
 // une recette il couvrait la page que le visiteur venait lire. Le pourquoi
 // complet est dans `shouldOpenWelcome` (features/onboarding/lib).
 const modals = useAppModals({ welcome: shouldOpenWelcome(location.pathname) })
 const INGREDIENTS = useIngredients()
 const FRIDGE_LAYOUTS = useFridgeLayouts()
 const ingredientsById = useIngredientsById()
 const groupMaps = useGroupMaps()
 // Aha — stapleIds calculés ici (root autorisé à importer @features/recipes) et
 // passés en prop à la carte coach (GettingStartedContainer) via fridgeHomeViewProps
 // pour respecter S9.a. La carte nomme la recette cuisinable (ex-nudge fusionné).
 const ahaStapleIds = useMemo(() => computeStapleIds(ingredientsById), [ingredientsById])
 const navigate = useNavigate()
 // Clic sur une recette → vraie navigation vers /recipe/:id (page pleine).
 // AppShell rend FridgeHomeView sur '/', sinon AppRoutes (dont RecipePage).
 const isHome = location.pathname === '/'
 // Sprint 6 PR S6.a — lang + darkMode migrés vers UIProvider.
 // Le state vit maintenant dans le Context global (cf. shared/contexts/ui-provider.jsx).
 // Les composants enfants continuent à recevoir lang/darkMode en props
 // pour cette PR (pas de big-bang) ; migration progressive ensuite.
 const { lang, setLang: setLangContext } = useLang()
 const { darkMode, toggleDarkMode } = useDarkMode()

 // handleLangChange devient un proxy direct sur setLang du Context (la
 // garde « FR-only au lancement » est désormais dans UIProvider).
 const handleLangChange = setLangContext

 // Bandeau du haut pour un lien reçu par e-mail : restauration de compte
 // ("?restore-account=<token>", fermé seul après 8 s) ou lien de connexion qui
 // n'aboutit pas (expiré, ouvert ailleurs). Cf. shared/hooks/use-email-link-banner.js.
 const [restoreBanner, dismissRestoreBanner] = useEmailLinkBanner({ lang, restoreAccount })

 // URL boot effects : panier partagé public (?shared=<uuid>),
 // retour Stripe Checkout (?subscription=activated), deep link mobile
 // (?modal=upgrade). Cf. shared/hooks/use-url-boot-effects.js.
 const [sharedBasketId, setSharedBasketId] = useSharedBasketId()
 const subscriptionActivatedToast = useSubscriptionActivated({ refreshProfile, openUpgradeModal, user, loading: authLoading })

 // Bandeau essai : persisté par session (réapparaît à chaque ouverture d'onglet)
 const [trialBannerDismissed, setTrialBannerDismissed] = useState(() => {
 try { return sessionStorage.getItem('fridge-trial-banner-v1') === '1' } catch { return false }
 })
 const dismissTrialBanner = () => {
 try { sessionStorage.setItem('fridge-trial-banner-v1', '1') } catch {}
 setTrialBannerDismissed(true)
 }
 const showTrialBanner = isTrialing && !trialBannerDismissed && !!user

 useSeoMeta(lang)
 const [activeSubcat, setActiveSubcat] = useState(null)

 // Panneau Recettes piloté par l'URL (?recettes=1) plutôt que par un
 // state local. Bénéfices : un clic recette (navigate /recipe/:id) puis
 // retour navigateur rouvre le panneau dans le même état (filtres
 // URL-synced) ; le lien « Toutes les recettes » (/?recettes=1) l'ouvre
 // au deep-link. L'API showRecipes/setShowRecipes reste identique pour
 // tous les consommateurs (voice, logout, reset…) — seule la source
 // de vérité change (URL au lieu de useState).
 const [searchParams, setSearchParams] = useSearchParams()
 const showRecipes = isRecipesPanelOpen(searchParams.toString())
 const setShowRecipes = useCallback((open) => {
   // Guard no-op : beaucoup d'appelants ferment le panneau « au cas où »
   // (logout, voix, ouverture panier…). Sans ce garde, setSearchParams
   // pousserait une entrée d'historique identique à chaque appel.
   const current = isRecipesPanelOpen(window.location.search)
   const want = typeof open === 'function' ? !!open(current) : !!open
   if (want === current) return
   setSearchParams((prev) => withRecipesPanel(prev.toString(), want), { replace: false })
 }, [setSearchParams])
 const goSignUp = useCallback(() => navigate('/signup'), [navigate])
 // Sprint 11 S11.c.5 — journalRecipe state SUPPRIMÉ. Le Journal cuisine
 // et les notifs recettes naviguent vers /recipe/:id (page pleine).
 // Sprint 6 PR S6.d/S6.f — state stock + favorites instanciés une seule
 // fois dans SessionStateProvider (cf. main.jsx) et consommés via les
 // hooks de context. Permet à RecipePage cold-load d'avoir accès aux
 // mêmes données sans dédoublement (Sprint 11 S11.c.2).
 const {
 stock, setStock,
 setStockMeta,
 toggleIngredient,
 emptyFridgeOptimistic,
 emptyFridgeConfirm,
 emptyFridgeUndo,
 addBatch: addStockBatch,
 removeBatch: removeStockBatch,
 } = useStockSession()
 const { favorites, setFavorites, toggleFavorite } = useFavoritesSession()
 const [customRecipes, setCustomRecipes] = useState(() => {
 try { return JSON.parse(localStorage.getItem('fridge-custom-recipes') ?? '[]') } catch { return [] }
 })
 // Lues à la première ouverture du panneau de recettes ou des restes, les
 // seuls à s'en servir — plus à chaque démarrage (PERF-07).
 const publicRecipes = usePublicRecipesOnDemand(showRecipes || ['today', 'thisweek'].includes(activeSubcat?.sub?.id))
 // Sprint 11 S11.e.2 — deletingRecipe lifté dans DeletingRecipeProvider
 // pour que RecipePage en overlay puisse demander une suppression. App.jsx
 // consume le state via le hook context, expose les setters via les
 // mêmes noms qu'avant pour minimiser les changements downstream.
 const { deletingRecipe, requestDelete: setDeletingRecipe, cancel: cancelDeleting } = useDeletingRecipe()
 // Modales centralisées dans `modals` (useAppModals).
 // Sprint 11 S11.c.5 — modals.community.recipeId retiré (recettes via
 // navigate /recipe/:id en page pleine).
 // Sprint 11 S11.d — modals.community ENTIÈREMENT retiré : la
 // Communauté est désormais une route /community.
 // state basket + helpers délégués au hook useBasket. App.jsx
 // garde uniquement les callbacks qui orchestrent plusieurs features
 // (handleAddToCart : couplé à stock/lang/ingredientsById ;
 // handleClearBasket : couplé au snapshot/toast undo + spending event).
 const {
 basket, setBasket,
 basketLoading,
 basketRecipeIds,
 refresh: refreshBasket,
 toggleItem: handleToggleBasketItem,
 changeItemPack: handleChangeBasketItemPack,
 removeItem: handleRemoveBasketItem,
 restoreItems: handleRestoreBasketItems,
 removeRecipe: handleRemoveBasketRecipe,
 } = useCartSession()
 const {
 adminPendingCount, adminSupportCount, supportUnread,
 refreshSupportUnread,
 } = useAdminBadges({
 isAdmin,
 adminPanelOpen: modals.admin.isOpen,
 userId: user?.id,
 })
 // Sprint 6 PR S6.g — state leftovers migré vers useLeftovers.
 // Le hook gère le load au mount + add/delete + memo `expiredLeftoversCount`.
 const {
 leftovers,
 expiredLeftoversCount,
 savedCount: leftoversSavedCount,
 addLeftover: handleAddLeftover,
 deleteLeftover: handleDeleteLeftover,
 } = useLeftovers(user)

 // version tracking + load post-login déplacés dans useBasket.
 // App.jsx orchestre désormais les operations qui touchent plusieurs
 // features (handleAddToCart, handleClearBasket, etc.).

 // Garde-fou : un id « catégorie » (parent de groupe) n'est jamais
 // sélectionnable côté frigo, il ne doit donc jamais figurer dans le stock.
 // On le retire dès qu'il apparaît — répare les sélections fantômes héritées
 // (ex. ajoutées par la voix avant le fix) et persiste le nettoyage (BDD ou
 // localStorage via removeStockBatch). Tous les compteurs frigo redeviennent
 // justes sans toucher chaque site d'affichage.
 useEffect(() => {
 const parents = parentIdsInStock(stock, groupMaps?.groupMap)
 if (parents.length > 0) removeStockBatch(parents)
 }, [stock, groupMaps, removeStockBatch])

 // Badges admin + support (extrait dans useAdminBadges).

 // --- Panier --- v3.234.0 : load géré par useBasket (cf. hook).

 // --- Restes --- v3.236.0 : load géré par useLeftovers (cf. hook).

 // Ferme automatiquement les modales user-only quand l'auth bascule à null.
 // Couvre les cas où le logout ne passe PAS par handleSignOut : expiration de
 // token, signOut depuis un autre onglet, session révoquée par admin. Sans ça,
 // l'UI reste bloquée sur une modale ouverte et vide jusqu'au prochain F5.
 // `modals.profile` n'y figure pas : /profile est une route gardée par
 // AuthGuard, qui redirige seule. Et `modals.*` / `cancelDeleting` sont hors
 // dépendances à dessein — ce sont les ACTIONS, pas le déclencheur ; les
 // inclure relancerait l'effet à chaque rendu qui recrée ces objets, refermant
 // les modales sous les doigts de l'utilisateur.
 useEffect(() => {
 if (user) return
 modals.support.close()
 modals.cart.close()
 cancelDeleting()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [user?.id])

 // Idem pour le panel admin si l'user perd ses droits (rôle changé, ban).
 // `modals.admin` est l'action, `isAdmin` le déclencheur.
 useEffect(() => {
 if (!isAdmin) modals.admin.close()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isAdmin])

 // handleAddLeftover / handleDeleteLeftover viennent du hook
 // useLeftovers (cf. déclaration au-dessus avec renaming destructure).


 // basketRecipeIds vient du hook useBasket (mémo interne).

 // --- Actions panier (CRUD + load liste sauvegardée + stepper) ---
 const {
 loadedListInfo,
 setLoadedListInfo,
 handleAddToCart,
 handleUpdateRecipeServings,
 handleManualAddBasketItem,
 handleLoadShoppingList,
 handleRenameLoadedList,
 } = useBasketActions({
 user, lang, basket, stock, ingredientsById, refreshBasket,
 })

 // handleToggleBasketItem + handleChangeBasketItemPack +
 // handleRemoveBasketItem + handleRestoreBasketItems +
 // handleRemoveBasketRecipe viennent du hook useBasket (renaming
 // destructure ci-dessus). Pattern optimistic + rollback inclus.

 // --- Toasts d'annulation des actions destructives panier ---
 // Vider le panier + transferer panier → frigo, mutuellement exclusifs.
 const {
 clearBasketToast,
 fridgeToast,
 handleClearBasket,
 handleRestoreClearedBasket,
 handleConfirmAddToFridge,
 handleFridgeUndo,
 } = useBasketToasts({
 user,
 lang,
 stock,
 basket,
 setBasket,
 refreshBasket,
 addStockBatch,
 removeStockBatch,
 setLoadedListInfo,
 modals,
 })

 const {
 anyDoorOpen, anyPantryOpen,
 doorCloseSignal, doorOpenSignal, pantryCloseSignal,
 setAnyDoorOpen, setAnyPantryOpen,
 closeAllDoors, openAllDoors, closePantry,
 } = useFridgeDoors()

 // --- Reconnaissance vocale ---
 const {
 voice,
 voiceToast,
 voiceConsentOpen,
 handleVoiceToggle,
 handleVoiceModalConfirm,
 handleVoiceConsentAccept,
 handleVoiceConsentRefuse,
 handleVoiceAdd,
 handleVoiceUndo,
 handleVoiceCancel,
 } = useVoiceFlow({
 lang,
 modals,
 activeSubcat,
 setActiveSubcat,
 showRecipes,
 setShowRecipes,
 closeAllDoors,
 addStockBatch,
 removeStockBatch,
 })
 const receiptScan = useReceiptScanFlow({
 lang, modals,
 ingredients: INGREDIENTS,
 user,
 stock, addStockBatch, removeStockBatch,
 })
 const layout = resolveFridgeLayout({ layouts: FRIDGE_LAYOUTS, lang, shape: profile?.fridge_shape ?? null })

 // toggleIngredient / emptyFridgeOptimistic /
 // emptyFridgeConfirm / emptyFridgeUndo viennent du hook useFridgeStock
 // (cf. déclaration au-dessus).

 // toggleFavorite vient du hook useFavorites (cf. déclaration).

 // --- Recettes custom (handlers RGPD-aware) ---
 const {
 handleSaveCustomRecipe,
 handleDeleteCustomRecipe,
 handleRecipeDeletionConfirmed,
 handleMarkAdminModifiedRead,
 } = useCustomRecipesHandlers({
 user,
 customRecipes,
 setCustomRecipes,
 setDeletingRecipe,
 })

 // Sprint 11 S11.b.4 — Reset password : Supabase émet l'event
 // PASSWORD_RECOVERY au clic du lien email → auth-provider active
 // `recoveryMode`. On navigate vers la route dédiée /auth/recovery
 // (gated par RecoveryGuard) au lieu d'ouvrir la modale auth.
 useEffect(() => {
 if (recoveryMode) navigate('/auth/recovery', { replace: true })
 }, [recoveryMode, navigate])

 // --- Cycle de vie session user (sync data + signOut orchestré) ---
 const { handleSignOut } = useUserSession({
 user, signOut,
 setStock, setStockMeta, setFavorites, setCustomRecipes,
 setDeletingRecipe, setActiveSubcat, setShowRecipes,
 modals,
 })

 const [mobileTab, setMobileTab] = useState('fridge')

 // --- Navigation handlers (compartiment / notif / retour accueil) ---
 const {
 handleSubcategoryClick,
 handleNotificationClick,
 handleReset,
 } = useAppNavigation({
 modals,
 setActiveSubcat, setShowRecipes, setMobileTab,
 // Sprint 11 S11.c.4 — setJournalRecipe / customRecipes / publicRecipes
 // retirés : le handleNotificationClick utilise désormais navigate vers
 // /recipe/:id (cf. useAppNavigation), useRecipeById gère le lookup.
 closeAllDoors,
 navigate,
 })

 // expiredLeftoversCount vient du hook useLeftovers (memo interne).
 const accueilCouvert = showRecipes || modals.cart.isOpen || modals.support.isOpen || modals.admin.isOpen || !!activeSubcat // un panneau recouvre l'accueil : carte, bouton orange ET fusée s'effacent
 const windowWidth = useWindowWidth()
 const fridgeBase = layout.type === 'side-by-side' ? 500 : 400

 // --- Layout responsive (footer bottom-sheet mobile + scale desktop) ---
 const {
 footerExpanded, setFooterExpanded,
 footerRef,
 desktopScale, desktopFridgeRef,
 } = useResponsiveLayout({ windowWidth, anyDoorOpen, anyPantryOpen, isHome })

 const fridgeProps = { layout, lang, stock, onSubcategoryClick: handleSubcategoryClick, onDoorChange: setAnyDoorOpen, doorCloseSignal, doorOpenSignal, darkMode, leftovers, expiredLeftoversCount, noAutoScale: true }
 const pantryProps = { sections: layout.pantry, stock, onSubcategoryClick: handleSubcategoryClick, label: layout.pantryLabel, closeSignal: pantryCloseSignal, onOpenChange: setAnyPantryOpen, darkMode, noAutoScale: true }
 // Sur tablette (640-1279px), le footer est dans la colonne flex → réduit la hauteur de main.
 // On soustrait son overhead estimé (~72px) pour que le scale reste cohérent.
 const footerFlexOverhead = windowWidth >= 640 && windowWidth < 1280 ? 160 : 0
 const mobileHeightScale = windowWidth < 1280 ? (window.innerHeight - 196 - footerFlexOverhead) / 680 : 1
 const fridgeMobileScale = windowWidth < 1280
 ? Math.min(1.5, (windowWidth - 24) / fridgeBase, mobileHeightScale)
 : 1
 const pantryMobileScale = windowWidth < 1280
 ? Math.min(1.5, (windowWidth - 24) / 240, mobileHeightScale)
 : 1
 // Position verticale du FAB (mobile + tablette) — au niveau de la charnière du bas du frigo.
 // overhead = pt-24(96) + tabs(48) + gap(16) = 160px ; charnière ≈ 85% de la hauteur du frigo scalé.
 const fabAnchorTop = windowWidth < 1280
 ? 160 + Math.round(680 * 0.85 * fridgeMobileScale)
 : undefined

 // Gate 1er login OAuth : tant que le pseudo n'est pas confirmé, on affiche
 // l'écran de choix par-dessus tout (pas un guard de route → ni boucle ni
 // navigation parasite). needsUsername exige profile non null → pas de flash.
 // Affiché AVANT le welcome/tour onboarding.
 if (needsUsername(user, profile)) {
 return <Suspense fallback={<PageSkeleton lang={lang} darkMode={darkMode} />}><ChooseUsernamePage lang={lang} darkMode={darkMode} /></Suspense>
 }

 return (
 <NotificationsProvider>
 <UndoProvider lang={lang} darkMode={darkMode}>
 <div className="min-h-dvh bg-[var(--color-cream)] flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
 <TopBanners
 restoreBanner={restoreBanner}
 onRestoreBannerDismiss={dismissRestoreBanner}
 subscriptionActivatedToast={subscriptionActivatedToast}
 showTrialBanner={showTrialBanner}
 trialDaysLeft={trialDaysLeft}
 onTrialActivate={openUpgradeModal}
 onTrialDismiss={dismissTrialBanner}
 lang={lang}
 />
 <AppShell
 anyDoorOpen={anyDoorOpen}
 lang={lang}
 onLangChange={handleLangChange}
 darkMode={darkMode}
 onDarkModeToggle={toggleDarkMode}
 onReset={handleReset}
 tagline={SEO_META[lang]?.tagline ?? ''}
 onShowAuth={(tab) => navigate(tab === 'signup' || tab === 'register' ? '/signup' : '/login')}
 onShowProfile={() => navigate('/profile')}
 onShowAdmin={() => modals.admin.open()}
 onShowCommunity={() => navigate('/community')}
 onShowSupport={user ? () => modals.support.open() : undefined}
 onSignOut={handleSignOut}
 pendingCount={adminPendingCount + adminSupportCount}
 supportUnread={supportUnread}
 basket={basket}
 basketCount={basket.filter(i => !i.checked).length}
 onShowCart={() => { modals.cart.open(); setShowRecipes(false) }}
 onShowCartWithLists={() => {
 modals.cart.open({ openLists: true })
 setShowRecipes(false)
 }}
 onShowRecipes={() => { setShowRecipes(true); modals.cart.close() }}
 onLoadShoppingList={handleLoadShoppingList}
 onNotificationClick={handleNotificationClick}
 isHome={isHome}
 fridgeHomeViewProps={{
 desktopFridgeRef, desktopScale, windowWidth,
 fridgeBase, fridgeMobileScale, pantryMobileScale,
 mobileTab, setMobileTab,
 fridgeProps, pantryProps, layout,
 lang, darkMode,
 user,
 onOpenRecipes: () => { setShowRecipes(true) },
 onSignUp: goSignUp,
 onOpenRewards: () => navigate('/profile/recompenses?reward=volume-1'),
 onQuickAdd: (ids) => addStockBatch(ids),
 onQuickRemove: (ids) => removeStockBatch(ids),
 onOpenRecipe: (id) => navigate(`/recipe/${id}`),
 onSuggestionOpen: () => markSuggestionOpened(user?.id ?? 'guest'),
 stapleIds: ahaStapleIds, coachCovered: accueilCouvert,
 }}
 stock={stock}
 stockCount={stock.size}
 recipesLabel={layout.recipesLabel}
 voiceListening={voice.isListening}
 jaLoading={voice.jaLoading}
 onVoiceToggle={handleVoiceToggle}
 onReceiptScanStart={receiptScan.openReceiptScan}
 fabAnyOpen={anyDoorOpen || anyPantryOpen || (mobileTab === 'pantry' && windowWidth < 1280) || (footerExpanded && windowWidth < 640)}
 onOpenFridge={openAllDoors}
 onCloseFridge={closeAllDoors}
 onEmptyOptimistic={emptyFridgeOptimistic}
 onEmptyConfirm={emptyFridgeConfirm}
 onEmptyUndo={emptyFridgeUndo}
 isHomeForFab={isHome && !accueilCouvert}
 fabAnchorTop={fabAnchorTop}
 fabActiveTab={mobileTab}
 fabDoorOpen={anyDoorOpen}
 fabPantryOpen={anyPantryOpen}
 onClosePantry={closePantry}
 onShowLeftovers={() => setActiveSubcat({ sub: { id: 'today' } })}
 leftoversExpiredCount={expiredLeftoversCount}
 />

 <AppFooter
 isHome={isHome && !accueilCouvert}
 windowWidth={windowWidth}
 footerExpanded={footerExpanded}
 setFooterExpanded={setFooterExpanded}
 footerRef={footerRef}
 lang={lang}
 darkMode={darkMode}
 />

 {/* Sprint 11 S11.e.1 — RecipeFormModal top-level. Ouverture/fermeture
     contrôlée par RecipeFormProvider (cf. useRecipeForm hook).
     Accessible depuis n'importe quelle route. */}
 <RecipeFormOverlay
   onSave={handleSaveCustomRecipe}
   lang={lang}
   darkMode={darkMode}
 />

 <AppOverlays
 globalOverlaysProps={{
 welcomeOpen: modals.welcome.isOpen,
 onWelcomeClose: () => modals.welcome.close(),
 onSignUp: goSignUp,
 onShowCommunity: () => navigate('/community'),
 user, profile, authLoading, isPremium,
 isUpgradeOpen, onUpgradeClose: closeUpgradeModal, onShowUpgrade: openUpgradeModal,
 lang, darkMode,
 }}
 recipeBrowserModalsProps={{
 deletingRecipe,
 onDeletingRecipeClose: () => setDeletingRecipe(null),
 onRecipeDeletionConfirmed: handleRecipeDeletionConfirmed,
 showRecipes,
 onShowRecipesClose: () => { setShowRecipes(false) },
 stock, favorites, customRecipes, publicRecipes, leftovers,
 basketRecipeIds, allergenPrefs,
 onToggleFavorite: toggleFavorite,
 onToggleIngredient: toggleIngredient,
 onEmptyOptimistic: emptyFridgeOptimistic, onEmptyConfirm: emptyFridgeConfirm, onEmptyUndo: emptyFridgeUndo,
 // Sprint 11 S11.e.1 — onSaveCustomRecipe retiré : RecipeFormModal est
 // désormais rendu via RecipeFormOverlay au top-level d'App.jsx, qui
 // passe handleSaveCustomRecipe directement.
 onDeleteCustomRecipe: handleDeleteCustomRecipe,
 onMarkAdminModifiedRead: handleMarkAdminModifiedRead,
 onAddToCart: handleAddToCart,
 onShowSupport: () => modals.support.open(),
 // Onboarding step 2 : notifie l'ouverture d'une suggestion triée par
 // stock (RecipePanel filtre côté recette si pas de recherche libre).
 onSuggestionOpen: () => markSuggestionOpened(user?.id ?? 'guest'),
 lang, darkMode,
 }}
 basketModalsRootProps={{
 user, profile, basket, basketLoading, basketRecipeIds,
 loadedListInfo, refreshBasket,
 onToggleBasketItem: handleToggleBasketItem,
 onRemoveBasketItem: handleRemoveBasketItem,
 onRestoreBasketItems: handleRestoreBasketItems,
 onRemoveBasketRecipe: handleRemoveBasketRecipe,
 onChangeBasketItemPack: handleChangeBasketItemPack,
 onClearBasket: handleClearBasket,
 onManualAddBasketItem: handleManualAddBasketItem,
 onUpdateRecipeServings: handleUpdateRecipeServings,
 onAddToCart: handleAddToCart,
 onLoadShoppingList: handleLoadShoppingList,
 onRenameLoadedList: handleRenameLoadedList,
 onConfirmAddToFridge: handleConfirmAddToFridge,
 clearBasketToast, fridgeToast,
 onRestoreClearedBasket: handleRestoreClearedBasket,
 onFridgeUndo: handleFridgeUndo,
 cartOpen: modals.cart.isOpen,
 onCartClose: () => modals.cart.close(),
 cartInitialOpenLists: modals.cart.openListsOnOpen,
 cartConsumeOpenLists: modals.cart.consumeOpenLists,
 addToFridgeOpen: modals.addToFridge.isOpen,
 onAddToFridgeOpen: () => modals.addToFridge.open(),
 onAddToFridgeClose: () => modals.addToFridge.close(),
 onShowRecipes: () => { setShowRecipes(true); modals.cart.close() },
 onShowSupport: () => modals.support.open(),
 lang, darkMode,
 }}
 appModalsRootProps={{
 modals, user, profile, isAdmin,
 lang, darkMode,
 refreshSupportUnread,
 }}
 fridgeOverlaysProps={{
 activeSubcat, setActiveSubcat,
 sharedBasketId, setSharedBasketId,
 stock, leftovers, savedCount: leftoversSavedCount, customRecipes, publicRecipes, allergenPrefs,
 toggleIngredient,
 onAddLeftover: handleAddLeftover,
 onDeleteLeftover: handleDeleteLeftover,
 user,
 onShowAuth: () => navigate('/login'),
 lang, darkMode,
 }}
 voiceOverlaysProps={{
 voice, voiceToast,
 voiceConfirmOpen: modals.voiceConfirm.isOpen,
 voiceModalOpen: modals.voiceModal.isOpen,
 voiceConsentOpen,
 onVoiceConsentAccept: handleVoiceConsentAccept,
 onVoiceConsentRefuse: handleVoiceConsentRefuse,
 onVoiceModalClose: () => modals.voiceModal.close(),
 onVoiceModalConfirm: handleVoiceModalConfirm,
 onVoiceAdd: handleVoiceAdd,
 onVoiceCancel: handleVoiceCancel,
 onVoiceToggle: handleVoiceToggle,
 onVoiceUndo: handleVoiceUndo,
 stock, lang, darkMode,
 }}
 receiptScanOverlaysProps={{
 lang, darkMode, stock,
 receiptScanStage: receiptScan.receiptScanStage,
 receiptScanError: receiptScan.receiptScanError,
 matched: receiptScan.matched,
 ambiguous: receiptScan.ambiguous,
 unmatchedCount: receiptScan.unmatchedCount,
 receiptToast: receiptScan.receiptToast,
 receiptReviewOpen: modals.receiptReview.isOpen,
 onConsentFileSelected: receiptScan.handleFileSelected,
 onConsentCancel: receiptScan.handleReceiptConsentCancel,
 onReceiptAdd: receiptScan.handleReceiptAdd,
 onReceiptCancel: receiptScan.handleReceiptCancel,
 onDismissError: receiptScan.dismissError,
 onLoginRequiredClose: receiptScan.handleReceiptLoginRequiredClose,
 onShowAuth: () => navigate('/login'),
 }}
 />
 </div>

 </UndoProvider>
 </NotificationsProvider>
 )
}

function AppWithSubscription() {
 return (
 <SubscriptionModalProvider>
 <AppInner />
 </SubscriptionModalProvider>
 )
}

export default AppWithSubscription
