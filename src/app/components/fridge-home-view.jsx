import Fridge from '@features/fridge/components/fridge'
import PantryShelf from '@features/fridge/components/pantry-shelf'
import { GettingStartedContainer } from '@features/onboarding'

// Anti-gaspi — le score (🌿) a été déplacé sur le Profil (onglet Activité,
// 2026-06-22). La porte du frigo n'affiche plus de badge.

// Composant orchestrant la home view du frigo : layout responsive
// desktop (≥ 1280 px) avec scale dynamique vs mobile/tablette
// (< 1280 px) avec onglets frigo/pantry et un panneau scalé à la
// fois. Sprint 10 S10.a.23 — extrait depuis App.jsx (~70 lignes JSX).
//
// Desktop : Fridge + PantryShelf côte à côte avec scale calculé
// (useResponsiveLayout) pour remplir la viewport verticalement.
// `isolation: isolate` + clipPath éviteent que les portes 3D du
// frigo recouvrent le garde-manger en animation d'ouverture.
//
// Mobile/Tablette : onglets [frigo, pantry] (texte seul, sans icône
// depuis le retour utilisateur du 2026-07-11). Le panneau actif est
// wrappé dans une boîte de taille
// visuelle exacte (largeur × hauteur post-scale) pour que le layout
// flex respecte le scale appliqué via transform.

export default function FridgeHomeView({
  // Responsive layout (useResponsiveLayout)
  desktopFridgeRef,
  desktopScale,
  windowWidth,
  fridgeBase,
  fridgeMobileScale,
  pantryMobileScale,
  // Mobile tab state
  mobileTab,
  setMobileTab,
  // Fridge/Pantry data
  fridgeProps,
  pantryProps,
  layout,
  lang,
  darkMode,
  // Onboarding activation card (connectés-only, null = invité)
  user,
  onOpenRecipes,
  onSignUp,
  onOpenRewards,
  // Quick-add batch d'ingrédients (empty-state Task 3)
  onQuickAdd,
  onQuickRemove,
  // Aha nudge (Mécanisme B)
  onOpenRecipe,
  onSuggestionOpen,
  stapleIds,
  // true quand un panneau recouvre l'accueil : la carte coach s'efface
  coachCovered = false,
}) {
  return (
    <>
      {/* Le titre de la page d'accueil, pour les lecteurs d'écran.
          `sr-only` : l'accueil EST le frigo, dessiné à l'écran — un titre
          visible ferait doublon avec ce que l'on voit. Mais sans lui la page
          n'avait, jusqu'au 2026-08-22, AUCUN titre de premier niveau : le seul
          `<h1>` du DOM venait de l'en-tête et nommait le site.

          ⚠️ Dérivé de `layout` et non d'un dictionnaire de plus : ces libellés
          sont ceux que la page affiche déjà (onglets mobiles, plus bas). Le
          titre reste donc cohérent avec ce qui est RÉELLEMENT à l'écran, y
          compris quand la langue retombe sur le fallback — et il échappe au
          risque d'un dictionnaire hors d'un fichier `*i18n*`, que le garde-fou
          de parité des langues ne relit pas.

          Le `<h1>` de `WelcomeScreen` n'entre pas en concurrence : cet écran
          est un `role="dialog" aria-modal="true"`, un périmètre que les
          technologies d'assistance traitent seul, contenu du fond exclu. */}
      <h1 className="sr-only">
        {(layout.fridgeLabel || 'Frigo') + ' & ' + (layout.pantryLabel || 'Garde-manger')}
      </h1>

      {/* Carte « coach » onboarding — FLOTTANTE (portail vers body, ancrée écran).
          Montée UNE seule fois : elle ne vit pas dans le flux desktop/mobile.
          GettingStartedContainer gère toutes les gardes (invité, flag, dismissed,
          completed) ET absorbe l'ancien nudge Aha (nomme la recette cuisinable). */}
      <GettingStartedContainer
        lang={lang} user={user}
        onOpenRecipes={onOpenRecipes} onSignUp={onSignUp} onOpenRewards={onOpenRewards}
        onQuickAdd={onQuickAdd} onQuickRemove={onQuickRemove} onOpenRecipe={onOpenRecipe} onSuggestionOpen={onSuggestionOpen} stapleIds={stapleIds}
        covered={coachCovered}
      />

      {/* Desktop (≥ 1280 px) — isolation empêche les portes 3D de
          recouvrir le garde-manger. Wrapper flex-col : le groupe frigo+
          garde-manger (scalé) s'empile avec la carte d'activation
          onboarding rendue en dessous dans ce même conteneur flex-col. */}
      <div className="hidden xl:flex flex-col items-center justify-center" style={{ alignSelf: 'stretch' }}>
        {/* Échelle dynamique : la rangée grandit sur un grand écran et rétrécit
            sur un portable pour tenir entre l'en-tête et le pied
            (`computeDesktopFridgeScale`). */}
        <div
          ref={desktopFridgeRef}
          data-desktop-fridge-row
          className="flex items-start gap-6"
          style={{
            transform: desktopScale !== 1 ? `scale(${desktopScale})` : 'none',
            transformOrigin: 'center center',
            transition: 'transform 0.5s ease',
          }}
        >
          <div style={{ position: 'relative', isolation: 'isolate', clipPath: 'inset(0 -360px -180px -400px)' }}>
            <Fridge {...fridgeProps} />
          </div>
          <PantryShelf {...pantryProps} lang={lang} />
        </div>
      </div>

      {/* Mobile & Tablette (< 1280 px) — onglets + un panneau à la fois,
          scalé individuellement */}
      <div className="flex flex-col items-center xl:hidden" style={{ width: '100%', gap: '16px', paddingBottom: '8px' }}>
        {/* Onglets */}
        <div style={{ display: 'flex', background: darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)', borderRadius: '10px', padding: '4px', flexShrink: 0 }}>
          {[
            { id: 'fridge', label: layout.fridgeLabel || 'Frigo' },
            { id: 'pantry', label: layout.pantryLabel },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              style={{
                padding: windowWidth >= 768 ? '10px 28px' : '8px 22px',
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: mobileTab === id ? (darkMode ? '#243650' : '#FDFAF6') : 'transparent',
                color: mobileTab === id ? 'var(--color-warm-600)' : 'var(--color-muted)',
                fontWeight: mobileTab === id ? 700 : 500,
                fontSize: windowWidth >= 768 ? '16px' : '13px',
                boxShadow: mobileTab === id ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
        {/* Panneau actif — wrapper-box : la boîte de layout = taille
            visuelle exacte */}
        {mobileTab === 'fridge' ? (
          <>
            <div style={{ width: `${fridgeBase * fridgeMobileScale}px`, height: `${680 * fridgeMobileScale}px`, position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${fridgeMobileScale})` }}>
                <div style={{ isolation: 'isolate', clipPath: 'inset(0 -360px -180px -400px)' }}>
                  <Fridge {...fridgeProps} />
                </div>
              </div>
            </div>
            {/* Citation sous le frigo retirée en mobile strict (2026-07-10) :
                prenait de la place entre le frigo et le footer sans réel
                bénéfice — visible dans le header dès sm (≥640px). */}
          </>
        ) : (
          <div style={{ width: `${240 * pantryMobileScale}px`, height: `${680 * pantryMobileScale}px`, position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${pantryMobileScale})` }}>
              <PantryShelf {...pantryProps} lang={lang} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
