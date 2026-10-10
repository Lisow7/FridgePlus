// Body du mode « détail » de RecipeModal (colonne ingrédients + zone
// onglets), extrait de recipe-modal.jsx le 2026-07-27 (audit front §2,
// suite du découpage community — même chantier, appliqué à recipe-modal).
//
// UN SEUL composant : la « zone onglets » (barre d'onglets + contenu +
// suggestions inverses + footer sticky Mode cuisine/J'ai cuisiné) n'est pas
// une zone autonome — le footer y embarque le flux de retrait
// (enterWithdraw, logCookedWithoutWithdraw, withdrawFeedback,
// feedbackTimerRef). La séparer de la colonne ingrédients n'aurait rien
// réduit au site d'appel (RecipeModal reste le seul appelant, avec la même
// liste de props) et aurait ajouté une couche de transmission manuelle de
// ~40 props — le risque d'erreur dépasse le gain de lisibilité.
//
// ⚠️ 2026-10-03 : le FOOTER seul en est sorti (`recipe-cook-footer.jsx`,
// 15 props). Gain fonctionnel, pas cosmétique : sur mobile, « J'ai cuisiné »
// devait vivre HORS de la zone qui défile (il était à 1 600 px d'un écran de
// 844). Le refus ci-dessus vaut toujours pour la zone onglets entière.
//
// Présentationnel : tout l'état (selections, pickerIndex, substituteIndex,
// addedFlashIndex, activeTab, reviewsAgg, withdrawFeedback…) reste dans
// RecipeModal, qui pilote toujours le flux détail ↔ retrait.
//
// Props nommées à l'identique des identifiants utilisés dans le JSX
// ci-dessous (y compris INGREDIENT_LOOKUP, RECIPE_NAMES) : aucune
// substitution d'identifiant dans le corps, déplacement byte-identique.

import { LuBookOpen, LuWallet, LuSalad, LuMessageSquare, LuStar } from 'react-icons/lu'
import Emoji from '@shared/ui/emoji'
import Button from '@shared/ui/button'
import StepText from '@shared/ui/step-text'
import { UpgradeGate } from '@shared/ui/upgrade-gate'
import { isInSeason } from '@shared/lib/ingredients/seasonality'
import { getIngredientGroups, getIngredientIds, getIngredientQty, isIngredientRequired, pickGroupName } from '@shared/lib/recipes/recipe-ingredients'
import { formatQty } from '@shared/lib/recipes/recipe-utils'
import RecipeSubstitutePopover from './recipe-substitute-popover'
import RecipeNutritionTab from './recipe-modal-nutrition-tab'
import RecipeUsingBaseSuggestions from './recipe-using-base-suggestions'
import RecipeCostTab from './recipe-cost-tab'
import RecipeReviewsSection from './recipe-reviews-section'
import { RecipeCookFooter } from './recipe-cook-footer'

export function RecipeDetailBody({
  recipe,
  lang,
  darkMode,
  isMobile,
  variant,
  stock,
  effectiveStock,
  scaleFactor,
  INGREDIENT_LOOKUP,
  ingredientsById,
  recipeNutrition,
  recipeCost,
  recipeSteps, stepsSeenRef,
  recipeName,
  hasStockIngredients,
  hasPremiumAccess, profileLoading = false, // profil pas encore là : aucun verrou affirmé (PREM-06)
  cost,
  recipesUsingThis,
  recipesById,
  RECIPE_NAMES,
  user,
  t,
  selections,
  setSelections,
  pickerIndex,
  setPickerIndex,
  substituteIndex,
  setSubstituteIndex,
  addedFlashIndex,
  activeTab,
  setActiveTab,
  reviewsAgg,
  setReviewsAgg,
  withdrawFeedback,
  setWithdrawFeedback,
  pickerRef,
  reviewsRef,
  feedbackTimerRef,
  handleBodyScroll,
  handleIngredientClick,
  onToggleIngredient,
  concreteOptions,
  flashAdded,
  navigate,
  onClose,
  enterWithdraw,
  logCookedWithoutWithdraw,
  setPeekRecipeId,
}) {
  return (
    <>
    <div
      className="fp-scroll"
      onScroll={isMobile ? handleBodyScroll : undefined}
      style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      flex: 1, minHeight: 0,
      overflowY: isMobile ? 'auto' : 'hidden',
      overflowX: 'hidden',
      // Chantier scroll mobile (2026-07-09) : empêche le scroll de la
      // fiche recette de "fuiter" vers le scroll de la page derrière
      // en atteignant une extrémité — cause connue d'à-coups sur mobile.
      overscrollBehavior: isMobile ? 'contain' : undefined,
    }}>

      {/* ── Colonne gauche (desktop) / Section haut (mobile) : Ingrédients ── */}
      <div className="fp-scroll" style={{
        width: isMobile ? '100%' : '280px',
        flexShrink: 0,
        overflowY: isMobile ? 'visible' : 'auto',
        padding: isMobile ? '14px 16px' : '20px',
        display: 'flex', flexDirection: 'column', gap: '6px',
        borderRight: isMobile ? 'none' : `1px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}`,
        borderBottom: isMobile ? `1px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}` : 'none',
      }}>
        <p className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-muted)] mb-1">{t.ingredientsLabel}</p>
        {(() => {
          let flatIndex = 0
          return getIngredientGroups(recipe).map((group, groupIndex) => {
            const groupName = pickGroupName(group.name, lang)
            const startIndex = flatIndex
            // `flatIndex` est un compteur local à cette IIFE, réinitialisé à
            // chaque rendu — accumulateur d'index à plat entre groupes, sans
            // état persistant ni effet de bord hors de cette passe de rendu.
            // eslint-disable-next-line react-hooks/immutability
            flatIndex += group.items.length
            return (
              <div key={groupIndex} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {groupName && (
                  <p style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)', margin: groupIndex === 0 ? '0 0 4px' : '14px 0 4px' }}>
                    {groupName}
                  </p>
                )}
                {group.items.map((ing, localI) => {
          const i = startIndex + localI
          const ingIds     = getIngredientIds(ing)
          const has        = ingIds.some(id => effectiveStock.has(id))
          const isSeasonal = ingIds.some(id => isInSeason(ingredientsById?.get?.(id)))
          const qData      = getIngredientQty(ing)
          const scaledAmount = qData?.amount != null && scaleFactor !== 1
            ? (qData.unit === 'pcs'
                ? Math.max(0.5, Math.round(qData.amount * scaleFactor * 2) / 2)
                : Math.round(qData.amount * scaleFactor * 10) / 10)
            : qData?.amount
          const qty        = qData ? formatQty(scaledAmount, qData.unit, lang) : null
          const isPickOpen = pickerIndex === i
          const interactive = !!onToggleIngredient
          const selectedId = selections[i]
          const ingRequired = isIngredientRequired(ing)
          const ingInfo = INGREDIENT_LOOKUP[selectedId ?? ingIds[0]]
          const ingName = ingInfo?.labels?.[lang] ?? ingInfo?.labels?.fr ?? ing.labels?.[lang] ?? ing.label

          return (
            <div key={i} ref={isPickOpen ? pickerRef : null} style={{ position: 'relative' }}>
              <div
                onClick={() => handleIngredientClick(ing, i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  borderRadius: '8px', padding: '3px 4px', margin: '0 -4px',
                  cursor: interactive ? 'pointer' : 'default', transition: 'background 0.15s',
                  background: isPickOpen ? (darkMode ? '#1A2535' : '#F0EAD8') : 'transparent',
                }}
                onMouseEnter={e => { if (interactive) e.currentTarget.style.background = darkMode ? '#1A2535' : '#F0EAD8' }}
                onMouseLeave={e => { if (interactive && !isPickOpen) e.currentTarget.style.background = 'transparent' }}
              >
                {/* La PASTILLE est le point d'entrée CLAVIER de la rangée (audit
                    2026-08-25) : la rangée elle-même reste un div souris — en
                    faire un role="button" imbriquait le bouton « Substituts IA »
                    dans un interactif (nested-interactive, attrapé par le
                    garde-fou). Pas de onClick propre : l'activation clavier
                    synthétise un click qui REMONTE au div parent. Son nom dit le statut en mots, que ✓ ✗ ○ ne disaient qu'aux yeux (audit du 2026-10-04, A11Y-06). */}
                <button
                  type="button" disabled={!interactive} aria-label={`${ingName} — ${has ? t.inFridge : ingRequired ? t.missing : t.optional}`} aria-expanded={interactive ? isPickOpen : undefined}
                  className={`shrink-0 flex items-center justify-center rounded-full text-white font-bold border-0${addedFlashIndex === i ? ' fp-badge-pop' : ''}`}
                  style={{ width: '24px', height: '24px', fontSize: '11px', padding: 0, cursor: 'inherit', background: has ? '#7BB078' : ingRequired ? '#D07070' : '#C4A555' }}
                >
                  {has ? '✓' : ingRequired ? '✗' : '○'}
                </button>
                <span
                  className="leading-tight"
                  style={{ fontSize: '15px', color: has ? (darkMode ? '#5DBF5A' : '#3A6A38') : ingRequired ? (darkMode ? '#D07070' : '#904040') : (darkMode ? 'rgba(255,255,255,0.70)' : 'var(--color-muted)'), fontWeight: has ? 600 : 400 }}
                >
                  {ingName}
                  {!ingRequired && <span className="opacity-50"> *</span>}
                  {qty && (
                    <span style={{ marginLeft: '4px', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', color: has ? (darkMode ? '#7DDC7A' : '#3A6A38') : ingRequired ? (darkMode ? '#E89090' : '#904040') : (darkMode ? 'rgba(255,255,255,0.70)' : 'var(--color-muted)') }}>
                      — {qty}
                    </span>
                  )}
                  {isSeasonal && (
                    <span role="img" title={t.inSeason} aria-label={t.inSeason}
                      style={{ marginLeft: '6px', fontSize: '16px', verticalAlign: 'baseline' }}>
                      🌱
                    </span>
                  )}
                </span>
                {/* Bouton IA "Substituts" — si ingrédient ABSENT et REQUIS, et pour un COMPTE
                    seulement (entrée Premium : ADR 0006, PREM-08). Click → popover IA, 3 suggestions. */}
                {!has && ingRequired && !!user && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPickerIndex(null)  // ferme un éventuel picker actif
                      setSubstituteIndex(substituteIndex === i ? null : i)
                    }}
                    title={t.aiSubstitutes}
                    aria-label={t.aiSubstitutes}
                    style={{
                      marginLeft: 'auto', flexShrink: 0,
                      background: substituteIndex === i ? (darkMode ? '#1A3A2A' : '#E8F5E9') : 'transparent',
                      border: 'none', cursor: 'pointer', padding: '4px 8px', minWidth: 32, minHeight: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '6px', fontSize: '14px', lineHeight: 1,
                      opacity: substituteIndex === i ? 1 : 0.65,
                      transition: 'background 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = substituteIndex === i ? '1' : '0.65' }}
                  >
                    🔄
                  </button>
                )}
              </div>

              {/* Chip de confirmation « ajouté au frigo » — flotte et disparaît */}
              {addedFlashIndex === i && (
                <span
                  aria-hidden="true"
                  className="fp-add-chip"
                  style={{
                    position: 'absolute', top: '-2px', right: '4px', zIndex: 40,
                    pointerEvents: 'none',
                    fontSize: '12px', fontWeight: 700, lineHeight: 1,
                    padding: '3px 7px', borderRadius: '999px',
                    color: darkMode ? '#5DBF5A' : '#3A6A38',
                    background: darkMode ? 'rgba(123,176,120,0.22)' : 'rgba(123,176,120,0.16)',
                    border: '1px solid rgba(123,176,120,0.40)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✓ {t.inFridgeChip}
                </span>
              )}

              {/* Popover IA "Substituts" — affiché si user clique sur le bouton 🔄 */}
              {substituteIndex === i && !has && ingRequired && (() => {
                const targetId = selectedId ?? ingIds[0]
                const baseInfo = INGREDIENT_LOOKUP[targetId]
                const baseName = baseInfo?.labels?.[lang] ?? baseInfo?.labels?.fr ?? ing.labels?.[lang] ?? ing.label ?? targetId
                return (
                  <RecipeSubstitutePopover
                    ingredientLabel={baseName}
                    recipeContext={recipeName}
                    lang={lang}
                    darkMode={darkMode}
                    onClose={() => setSubstituteIndex(null)}
                  />
                )
              })()}

              {/* Picker flottant — position absolute pour ne pas pousser les ingrédients */}
              {isPickOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 2px)', left: '28px', right: 0,
                  zIndex: 50,
                  borderRadius: '10px',
                  border: darkMode ? '1.5px solid #1A2A3D' : '1.5px solid #E8D5B8',
                  background: darkMode ? '#131E2C' : '#FDFAF6',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.20)',
                  overflow: 'hidden',
                }}>
                  {concreteOptions(ingIds).map(id => {
                    const info     = INGREDIENT_LOOKUP[id]
                    const inStock  = stock.has(id)
                    const name     = info?.labels?.[lang] ?? info?.labels?.fr ?? id
                    const emoji    = info?.emoji ?? '•'
                    const imageUrl = info?.image_url
                    return (
                      <Button
                        key={id}
                        variant="ghost"
                        onClick={e => {
                          e.stopPropagation()
                          if (!inStock) flashAdded(i)  // feedback seulement si AJOUT
                          onToggleIngredient(id)
                          setSelections(prev => { const n = { ...prev }; delete n[i]; return n })
                          setPickerIndex(null)
                        }}
                        aria-pressed={inStock}
                        className="h-auto w-full justify-start gap-2 rounded-none px-3 py-2.5 text-sm hover:bg-transparent"
                        style={{
                          background: inStock ? (darkMode ? '#1A3A2A' : '#E8F5E9') : 'transparent',
                          fontWeight: inStock ? 700 : 500,
                          color: inStock ? (darkMode ? '#5DBF5A' : '#3A6A38') : 'var(--color-charcoal)',
                          textAlign: 'left',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!inStock) e.currentTarget.style.background = darkMode ? '#1A2535' : '#F5EDD8' }}
                        onMouseLeave={e => { if (!inStock) e.currentTarget.style.background = 'transparent' }}
                      >
                        <Emoji char={emoji} size={16} style={{ flexShrink: 0 }} imageUrl={imageUrl} />
                        <span style={{ flex: 1 }}>{name}</span>
                        {inStock && <span style={{ fontSize: '12px', color: '#7BB078' }}>✓</span>}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          )
                })}
              </div>
            )
          })
        })()}

        {onToggleIngredient && (
          <div style={{
            marginTop: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(224,120,32,0.08)',
            border: `1px solid ${darkMode ? 'rgba(247,168,94,0.25)' : 'rgba(224,120,32,0.22)'}`,
            display: 'flex', alignItems: 'flex-start', gap: '7px',
          }}>
            <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>👆</span>
            <span style={{ fontSize: isMobile ? '13px' : '12px', lineHeight: 1.45, color: darkMode ? 'rgba(247,168,94,0.90)' : '#A05020', fontWeight: 500 }}>
              {t.clickTip}
            </span>
          </div>
        )}

        {/* Légende */}
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}`, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <p style={{ fontSize: isMobile ? '13px' : '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: darkMode ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)', marginBottom: '2px' }}>{t.legendLabel}</p>
          {[
            { bg: '#7BB078', symbol: '✓', label: t.inFridge },
            { bg: '#D07070', symbol: '✗', label: t.missing },
            { bg: '#C4A555', symbol: '○', label: t.optional },
          ].map(({ bg, symbol, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '999px', background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'white', fontWeight: 700 }}>
                {symbol}
              </div>
              <span style={{ fontSize: '15px', color: darkMode ? 'rgba(255,255,255,0.80)' : 'var(--color-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Colonne droite (desktop) / Section bas (mobile) : Onglets ── */}
      <div style={{
        flex: isMobile ? 'none' : 1,
        width: isMobile ? '100%' : 'auto',
        display: 'flex', flexDirection: 'column',
        minHeight: isMobile ? 'auto' : 0,
      }}>

        {/* Barre d'onglets — scrollable horizontalement sur mobile
            pour éviter le débordement avec icônes + 4 tabs.
            Sur mobile (mono-scroll), la barre est STICKY en haut de la
            zone scrollable (juste sous l'entête condensée) pour rester
            navigable même quand on a scrollé dans le contenu d'un onglet.
            Fond opaque = celui de la carte pour masquer ce qui passe
            dessous. */}
        <div role="tablist" aria-label={t.tabsLabel} style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center',
          borderBottom: `1px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}`,
          padding: isMobile ? '0 16px' : '0 20px',
          overflowX: isMobile ? 'auto' : 'visible',
          scrollbarWidth: 'none',
          position: isMobile ? 'sticky' : undefined,
          top: isMobile ? 0 : undefined,
          zIndex: isMobile ? 5 : undefined,
          background: isMobile ? (darkMode ? '#131E2C' : '#FDFAF6') : undefined,
        }}>
          {/* v3.194.0 — Refonte UX (PR 8.7.c) : icône Lucide à
              côté de chaque label d'onglet pour scan plus rapide.
              Étoile premium ⭐ ajoutée sur « Coût » si l'utilisateur
              n'a pas encore accès Premium. */}
          {[
            { id: 'steps',     label: t.tabSteps,      icon: LuBookOpen,      show: true },
            { id: 'cost',      label: t.tabCost,        icon: LuWallet,        show: hasPremiumAccess || !!user, premiumGated: !hasPremiumAccess && !profileLoading },
            { id: 'nutrition', label: t.tabNutrition,   icon: LuSalad,         show: recipeNutrition.hasData || recipeCost !== null },
            { id: 'reviews',   label: t.tabReviews,     icon: LuMessageSquare, show: !!(recipe.id && (!recipe.isCustom || recipe._isCommunity)), badge: reviewsAgg.count > 0 ? reviewsAgg.avg : null },
          ].filter(tab => tab.show).map(tab => {
            const Icon = tab.icon
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className="h-auto shrink-0 rounded-none bg-transparent hover:bg-transparent"
                style={{
                  gap: '6px',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: activeTab === tab.id ? 700 : 600,
                  color: activeTab === tab.id ? 'var(--link-accent)' : 'var(--color-muted)',
                  borderBottom: `2px solid ${activeTab === tab.id ? 'var(--color-brand-500)' : 'transparent'}`,
                  marginBottom: '-1px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--color-charcoal)' }}
                onMouseLeave={e => { if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--color-muted)' }}
              >
                <Icon size={14} />
                {tab.label}
                {tab.premiumGated && (
                  <LuStar size={11} fill="var(--color-brand-500)" color="var(--color-brand-500)" style={{ marginLeft: '-2px' }} />
                )}
                {tab.badge && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    padding: '1px 5px', borderRadius: '10px',
                    background: activeTab === tab.id ? 'rgba(224,120,32,0.15)' : (darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'),
                    color: activeTab === tab.id ? 'var(--color-brand-500)' : 'var(--color-muted)',
                  }}>
                    ⭐ {tab.badge}
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        {/* Contenu de l'onglet
            v3.193.0 — Sur mobile, pas de scroll interne ici :
            c'est le wrapper body qui scrolle (one-scroll global). */}
        <div className="fp-scroll" style={{
          flex: 1,
          overflowY: isMobile ? 'visible' : 'auto',
          padding: isMobile ? '14px 16px' : '20px',
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}>

          {/* Onglet Étapes */}
          {activeTab === 'steps' && (
            <>
              <p ref={stepsSeenRef} className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-muted)]" style={{ margin: 0 }}>{t.preparationLabel}</p>
              {recipeSteps.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--color-muted)', fontStyle: 'italic' }}>—</p>
              ) : (
                recipeSteps.map((step_, i) => (
                  <div key={i} className="flex gap-3">
                    <div
                      className="shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                      style={{ width: '26px', height: '26px', minWidth: '26px', fontSize: '12px', background: 'var(--color-brand-500)', marginTop: '1px' }}
                    >
                      {i + 1}
                    </div>
                    <p className="leading-relaxed" style={{ fontSize: '15px', color: 'var(--color-charcoal)' }}><StepText text={step_} lang={lang} darkMode={darkMode} currentRecipeId={recipe.id} onOpenBaseRecipe={setPeekRecipeId} /></p>
                  </div>
                ))
              )}
            </>
          )}

          {/* Onglet Coût */}
          {activeTab === 'cost' && !hasPremiumAccess && !profileLoading && (
            <UpgradeGate feature="recipe-cost" variant="hard" lang={lang} darkMode={darkMode} />
          )}
          {activeTab === 'cost' && hasPremiumAccess && (
            <RecipeCostTab
              recipe={recipe}
              lang={lang}
              darkMode={darkMode}
              ingredientsById={ingredientsById}
              stock={stock}
              scaleFactor={scaleFactor}
              t={t}
              cost={cost}
            />
          )}

          {/* Onglet Nutrition */}
          {activeTab === 'nutrition' && (
            <RecipeNutritionTab
              nutrition={recipeNutrition}
              t={t}
              darkMode={darkMode}
              isMobile={isMobile}
              lang={lang}
            />
          )}

          {/* Onglet Avis */}
          {activeTab === 'reviews' && recipe.id && (!recipe.isCustom || recipe._isCommunity) && (
            <RecipeReviewsSection
              ref={reviewsRef}
              recipeId={recipe.id}
              recipeSource={recipe._isCommunity || recipe.isCustom ? 'community' : 'base'}
              lang={lang}
              darkMode={darkMode}
              defaultCollapsed={false}
              onAggregateChange={setReviewsAgg}
            />
          )}

        </div>

        {/* Suggestions inverses : « Recettes qui utilisent cette
            recette » — visible uniquement si au moins une suggestion
            existe (jamais d'état vide affiché). Filtrage sur la liste
            résolue : `recipe_relations` (BDD) n'est pas garanti en
            phase avec le catalogue statique chargé (recette retirée,
            id orphelin) → on ne garde que les ids résolvables, sinon
            un titre de section pourrait s'afficher sans aucune carte.
            RGPD : relation de contenu statique recette↔recette, aucune
            donnée utilisateur, même liste pour tout le monde. */}
        <RecipeUsingBaseSuggestions
          ids={recipesUsingThis}
          recipesById={recipesById}
          recipeNames={RECIPE_NAMES}
          t={t}
          lang={lang}
          darkMode={darkMode}
          isMobile={isMobile}
          onSelect={(id) => {
            if (variant === 'modal') onClose?.()
            navigate(`/recipe/${id}`)
          }}
        />

        <RecipeCookFooter recipe={recipe} recipeSteps={recipeSteps} user={user} isMobile={isMobile} hasPremiumAccess={hasPremiumAccess} profileLoading={profileLoading} darkMode={darkMode} lang={lang} t={t} navigate={navigate} withdrawFeedback={withdrawFeedback} setWithdrawFeedback={setWithdrawFeedback} feedbackTimerRef={feedbackTimerRef} hasStockIngredients={hasStockIngredients} enterWithdraw={enterWithdraw} logCookedWithoutWithdraw={logCookedWithoutWithdraw} showCook={!isMobile} />

      </div>
    </div>
    {/* Mobile : « J'ai cuisiné » sous la zone qui défile, toujours visible */}
    {isMobile && <RecipeCookFooter recipe={recipe} recipeSteps={recipeSteps} user={user} isMobile={isMobile} hasPremiumAccess={hasPremiumAccess} profileLoading={profileLoading} darkMode={darkMode} lang={lang} t={t} navigate={navigate} withdrawFeedback={withdrawFeedback} setWithdrawFeedback={setWithdrawFeedback} feedbackTimerRef={feedbackTimerRef} hasStockIngredients={hasStockIngredients} enterWithdraw={enterWithdraw} logCookedWithoutWithdraw={logCookedWithoutWithdraw} showModeCuisine={false} />}
    </>
  )
}
