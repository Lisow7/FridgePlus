import Header from '@app/layout/header'
import AppRoutes from '@routes/index'
import FridgeHomeView from '@app/components/fridge-home-view'
import ErrorBoundary from '@app/error/error-boundary'
import FridgeFAB from '@features/fridge/components/fridge-fab'
import { Z_INDEX } from '@shared/lib/z-index'
import { SHELL_I18N } from '@shared/lib/i18n/app-shell-i18n'

// Composant orchestrant le shell visible de l'app sur la home et
// les pages /legal /changelog : lueur dark mode + Header + <main>
// (route home → FridgeHomeView ; autres routes → AppRoutes) +
// FridgeFAB. Sprint 10 S10.a.24 — extrait depuis App.jsx.
//
// Le shell est délibérément construit autour de la home view car la
// majorité des interactions utilisateur partent du Header (ouverture
// modales, panier, recettes, langue, profile, communauté) ou du
// FridgeFAB (vocal, recettes, anti-gaspillage, fermer portes).
//
// `isHomeForFab` est dérivé côté App.jsx car la condition dépend de
// l'état de toutes les modales ouvertes (showRecipes + modals.*),
// ce qui serait fragile à recalculer ici.

// Libellé du lien d'évitement — dans `@shared/lib/i18n/app-shell-i18n` et non
// ici : un dictionnaire défini dans un composant échappe au glob de
// `i18n-dictionaries-parity.test.js` (`*i18n*`), donc au garde-fou de parité
// des langues. Voir l'en-tête de ce fichier.

export default function AppShell({
  // Lueur dark mode
  anyDoorOpen,
  // Header — i18n / theme
  lang,
  onLangChange,
  darkMode,
  onDarkModeToggle,
  // Header — navigation
  onReset,
  tagline,
  onShowAuth,
  onShowProfile,
  onShowAdmin,
  onShowCommunity,
  onShowSupport,
  onSignOut,
  // Header — badges
  pendingCount,
  supportUnread,
  // Header — basket popover
  basket,
  basketCount,
  onShowCart,
  onShowCartWithLists,
  onShowRecipes,
  onLoadShoppingList,
  onNotificationClick,
  // Main routing
  isHome,
  fridgeHomeViewProps,
  // FridgeFAB
  stock,
  stockCount,
  recipesLabel,
  voiceListening,
  jaLoading,
  onVoiceToggle,
  onReceiptScanStart,
  fabAnyOpen,
  onOpenFridge,
  onCloseFridge,
  onEmptyOptimistic,
  onEmptyConfirm,
  onEmptyUndo,
  isHomeForFab,
  fabAnchorTop,
  fabActiveTab,
  fabDoorOpen,
  fabPantryOpen,
  onClosePantry,
  onShowLeftovers,
  leftoversExpiredCount,
}) {
  const tShell = SHELL_I18N[lang] ?? SHELL_I18N.fr

  return (
    <>
      {/* ── Lien d'évitement ────────────────────────────────────────────────
          Invisible tant qu'il n'a pas le focus, puis premier arrêt de la
          tabulation. Sans lui, quelqu'un qui navigue au clavier retraverse
          tout l'en-tête — aide, notifications, communauté, langue, menu — à
          CHAQUE page, avant d'atteindre le contenu.

          `position: fixed` et non `absolute` : le shell place `<main>` dans un
          conteneur de défilement, et un lien en `absolute` remonterait hors
          écran avec lui au lieu d'apparaître là où le focus se trouve.

          ⚠️ Ne PAS le rendre `sr-only` en permanence : un lien d'évitement doit
          devenir VISIBLE au focus, sinon un utilisateur voyant qui navigue au
          clavier voit son focus disparaître. C'est le défaut le plus courant de
          ce motif. */}
      <a href="#contenu-principal" className="fp-skip-link">
        {tShell.skipToContent}
      </a>
      <style>{`
        .fp-skip-link {
          position: fixed;
          top: 8px;
          left: -9999px;
          /* Au-dessus de l’en-tête collant (60) pour être visible au focus,
             mais SOUS les modales (1000) : quand une modale est ouverte le
             focus y est piégé, ce lien n’a rien à y faire. */
          z-index: ${Z_INDEX.BANNER};
          padding: 10px 18px;
          border-radius: 10px;
          background: #B85000;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 6px 20px rgba(0,0,0,0.28);
        }
        .fp-skip-link:focus {
          left: 8px;
          outline: 3px solid #fff;
          outline-offset: 2px;
        }
      `}</style>

      {/* Lueur de frigo — mode sombre uniquement */}
      {darkMode && (
        <div
          aria-hidden
          style={{
            position: 'fixed', inset: 0,
            pointerEvents: 'none', zIndex: Z_INDEX.BASE,
            background: 'radial-gradient(ellipse 95% 80% at 38% 54%, rgba(185,228,255,0.18) 0%, rgba(175,220,255,0.10) 22%, rgba(162,210,255,0.05) 46%, rgba(150,202,255,0.02) 65%, transparent 84%)',
            opacity: anyDoorOpen ? 1 : 0,
            transition: 'opacity 0.75s ease',
          }}
        />
      )}

      <Header
        lang={lang}
        onLangChange={onLangChange}
        darkMode={darkMode}
        onDarkModeToggle={onDarkModeToggle}
        onReset={onReset}
        tagline={tagline}
        onShowAuth={onShowAuth}
        onShowProfile={onShowProfile}
        onShowAdmin={onShowAdmin}
        onShowCommunity={onShowCommunity}
        onShowSupport={onShowSupport}
        onSignOut={onSignOut}
        pendingCount={pendingCount}
        supportUnread={supportUnread}
        basket={basket}
        basketCount={basketCount}
        onShowCart={onShowCart}
        onShowCartWithLists={onShowCartWithLists}
        onShowRecipes={onShowRecipes}
        onLoadShoppingList={onLoadShoppingList}
        onNotificationClick={onNotificationClick}
        onOpenFridge={onOpenFridge}
        onVoiceToggle={onVoiceToggle}
        onShowLeftovers={onShowLeftovers}
      />

      <main
        id="contenu-principal"
        // `tabIndex={-1}` : sans lui, sauter vers un conteneur non focalisable
        // déplace le défilement mais PAS le focus clavier — la tabulation
        // repartirait du haut de l'en-tête, et le lien d'évitement n'aurait
        // rien évité. C'est le second défaut classique de ce motif.
        tabIndex={-1}
        // Réserve l'espace du bandeau cookies (`pb-[var(--fp-bottom-inset,0px)]`) :
        // sans ça, les compartiments bas du frigo passaient dessous,
        // inatteignables (100dvh, pas de scroll). Sur l'accueil grand écran,
        // la réservation est LEVÉE (`min-[1600px]:pb-0`) : le bandeau y est une
        // carte de coin qui ne recouvre pas la scène, et réserver faisait sauter
        // le frigo centré de ~80 px à son arrivée puis à son départ. Le seuil
        // est celui de `COOKIE_BANNER_LIGNE_MIN_WIDTH` — un test lie les deux.
        // Historique : jusqu'au 2026-09-11 la réservation était un style en
        // ligne, qui écrasait `pb-6`/`pb-12` en silence — la valeur effective
        // sans bandeau était donc 0, et c'est ce que les classes conservent.
        // `scroll-pt-24` / `scroll-pb-…` (audit A11Y-15, WCAG 2.4.11) : un élément
        // qui reçoit le focus en remontant (Maj+Tab) défilait jusqu'au bord du
        // conteneur, SOUS l'en-tête fixe — ou sous le bandeau cookies en bas.
        className={isHome
          ? 'flex-1 overflow-y-auto xl:overflow-hidden xl:flex xl:items-center xl:justify-center pt-24 pb-[var(--fp-bottom-inset,0px)] min-[1600px]:pb-0 px-4 md:px-6 scroll-pt-24 scroll-pb-[var(--fp-bottom-inset,0px)]'
          : 'flex-1 pt-24 pb-[var(--fp-bottom-inset,0px)] px-4 md:px-6 overflow-y-auto scroll-pt-24 scroll-pb-[var(--fp-bottom-inset,0px)]'
        }
        style={!isHome && !darkMode ? { background: '#F5F0E8' } : undefined}
      >
        {!isHome ? (
          <AppRoutes lang={lang} darkMode={darkMode} />
        ) : (
          <ErrorBoundary level="page" lang={lang}>
            <FridgeHomeView {...fridgeHomeViewProps} />
          </ErrorBoundary>
        )}
      </main>

      {/* v3.118.0 — FridgeFAB remplace les boutons épars
          (FridgeToolbar + sticky Mes recettes + Fermer portes) */}
      <FridgeFAB
        lang={lang}
        darkMode={darkMode}
        stock={stock}
        stockCount={stockCount}
        recipesLabel={recipesLabel}
        onShowRecipes={onShowRecipes}
        voiceListening={voiceListening}
        jaLoading={jaLoading}
        onVoiceToggle={onVoiceToggle}
        onReceiptScanStart={onReceiptScanStart}
        anyOpen={fabAnyOpen}
        onOpenFridge={onOpenFridge}
        onCloseFridge={onCloseFridge}
        onEmptyOptimistic={onEmptyOptimistic}
        onEmptyConfirm={onEmptyConfirm}
        onEmptyUndo={onEmptyUndo}
        isHome={isHomeForFab}
        fabAnchorTop={fabAnchorTop}
        activeTab={fabActiveTab}
        doorOpen={fabDoorOpen}
        pantryOpen={fabPantryOpen}
        onClosePantry={onClosePantry}
        onShowLeftovers={onShowLeftovers}
        leftoversExpiredCount={leftoversExpiredCount}
      />
    </>
  )
}
