import BaseRecipeOverlay from './base-recipe-overlay'
import { RecipeAllergenWarning, RecipeAllergenStrip } from './recipe-allergens-banners'
import RecipeDeleteDialog from './recipe-delete-dialog'
import { AdminModifiedBanner, WithdrawFeedbackBanner } from './recipe-modal-banners'
import RecipeJsonLd from './recipe-jsonld'
import RecipeShareSheet from './recipe-share-sheet'
import { pickLocalizedName } from '@shared/lib/recipes/recipe-i18n'
import { RecipeWithdrawHeader, RecipeWithdrawBody } from './recipe-withdraw-view'
import { RecipeDetailBody } from './recipe-detail-body'
import { RecipeDetailHeader } from './recipe-detail-header'
import useRecipeModal from '@features/recipes/hooks/use-recipe-modal'

// Détection frigo/garde-manger via préfixe d'ID :
//   fr-, frz-, vg-, jp- → frigo (frais, congélateur, légumes, frais japonais)
//   gp-, sp-, bk-       → garde-manger (épicerie, épices, boulangerie sec)


// Sprint 11 S11.c.1 — prop `variant` :
//   - 'modal' (défaut) : overlay flottant avec backdrop (comportement
//      historique — utilisé par RecipePanel, Communauté, Journal).
//   - 'page' : rendu plein écran sans backdrop (utilisé par RecipePage
//      sur la route /recipe/:id). Toggle uniquement le chrome extérieur
//      (wrapper position/background, taille carte, border-radius,
//      focus trap, role aria) — le contenu (1700+ L) reste identique.
//      Bonnes pratiques 2026 : sur une route directe, pas de role
//      dialog/aria-modal forcé, pas de focus trap (sinon impossible
//      d'atteindre le Header), pas de backdrop dimmé qui n'a aucun
//      sens visuel sans page de fond.
//
// eslint-disable-next-line no-unused-vars -- onShowSupport reçu par contrat avec RecipePanel
export default function RecipeModal({ recipe, stock, onClose, onAllRecipes, favorites = new Set(), onToggleFavorite, lang = 'fr', darkMode = false, onToggleIngredient, onEditRecipe, onDeleteRecipe, allergenPrefs = [], onAddToCart, basketRecipeIds, onShowSupport, variant = 'modal', returnBanner, lockedServings, lockedByLabel, lockedOriginServings }) {
  // L'état, les effets et les actions vivent dans le hook : il retourne un
  // objet unique, destructuré ici pour que le JSX garde ses noms.
  const {
    activeTab, addedFlashIndex, allergenTypes, allInFridge, barColor, barTextColor,
    canConfirm, canEditRecipe, cartHeaderNotice, cartHeaderNoticeRef, closePeek, collapseStyle, concreteOptions, condensed, confirmWithdraw,
    cost, countryInfo, dialogRef, dietTypes, effectiveStock, enterWithdraw,
    feedbackTimerRef, flagHovered, flashAdded, handleBodyScroll, handleIngredientClick,
    hasPremiumAccess, hasStockIngredients, headerBg, headerBorder, headerText, INGREDIENT_LOOKUP, ingredientsById, isAdmin, isApprovedCommunity,
    isInCart, isMobile, isPage, isPubliclyShareable, logCookedWithoutWithdraw,
    matchCount, minServings, mutedColor, navigate, pct, peekRecipeId, pickerIndex,
    pickerRef, recipeAllergens, recipeAllergenWarnings, recipeCost,
    recipeDescription, recipeDiets, recipeName, RECIPE_NAMES, recipeNutrition, recipesById,
    recipeSteps, recipesUsingThis, required, reviewsAgg,
    reviewsRef, scaleFactor, schemaData, selectedServings, selections,
    servingsLocked, setActiveTab, setCartHeaderNotice, setFlagHovered, setPeekRecipeId, setPickerIndex, setReviewsAgg, setSelectedServings, setSelections, setShareOpen, setShowDeleteConfirm, setStep,
    setStepTwoState, setSubstituteIndex, setWithdrawFeedback, shareOpen, shareUrl,
    showDeleteConfirm, step, stepTwoState, substituteIndex, t, theme, titleRef, user, withdrawFeedback,
  } = useRecipeModal({ recipe, stock, onClose, lang, darkMode, onToggleIngredient, allergenPrefs, basketRecipeIds, variant, lockedServings })


  return (
    <div
      className={isPage
        ? 'flex w-full justify-center'
        : 'fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6 fp-modal-backdrop'
      }
      style={isPage
        ? { background: 'transparent', height: '100%' }
        : { background: 'rgba(18,10,4,0.55)', backdropFilter: 'blur(8px)' }
      }
      onClick={isPage ? undefined : onClose}
    >
      <RecipeJsonLd data={schemaData} />
      <div
        ref={dialogRef}
        role={isPage ? undefined : 'dialog'}
        aria-modal={isPage ? undefined : 'true'}
        // 🔴 L'étiquette ne va QU'AVEC le rôle. En modale, `role="dialog"`
        // l'accepte et elle nomme la fenêtre. En PAGE il n'y a pas de rôle :
        // ARIA interdit de nommer un élément générique, et l'étiquette est
        // purement IGNORÉE — `aria-prohibited-attr` sur les 515 recettes.
        // Aucune perte : en mode page, le `<h1>` porte déjà le nom.
        aria-label={isPage ? undefined : pickLocalizedName(recipe?.name, null, lang, 'Recette')}
        style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          background: darkMode ? '#131E2C' : '#FDFAF6',
          boxShadow: isPage ? 'none' : '0 8px 40px rgba(0,0,0,0.28)',
          width: '100%',
          maxWidth: isPage ? '1280px' : (isMobile ? '100%' : '1020px'),
          // En page mode, la carte fait exactement la hauteur de la boîte de
          // contenu de <main> (100%, cf. wrapper parent) — <main> est déjà
          // dimensionné correctement par le flex layout (flex-1) pour
          // exclure le header (fixed, compensé par son padding) ET
          // AppFooter (frère flex, hauteur réelle quelle qu'elle soit).
          // AVANT : hauteur recalculée à la main (`calc(100svh - 180px)`)
          // en supposant un AppFooter de 36px (ancien design bottom-sheet
          // « peek »). Le footer a depuis été rendu pleinement visible
          // (2026-07) sans que ce calcul soit mis à jour → sur la fiche
          // recette, le footer réel (plus grand) débordait de la marge
          // prévue et devenait inatteignable (le scroll interne de la
          // carte ne chaîne pas vers <main>, cf. overscrollBehavior
          // 'contain' ci-dessous). 100% élimine ce nombre magique fragile.
          maxHeight: isPage ? '100%' : (isMobile ? '92svh' : '92vh'),
          minHeight: isPage ? '100%' : undefined,
          borderRadius: isPage ? 0 : (isMobile ? '20px 20px 0 0' : '24px'),
          animation: isPage
            ? 'none'
            : (isMobile
              ? 'panel-slide-up 0.38s cubic-bezier(0.34,1.06,0.64,1) both'
              : 'modal-enter 0.38s cubic-bezier(0.34,1.10,0.64,1) both'),
        }}
        onClick={isPage ? undefined : e => e.stopPropagation()}
      >
        {returnBanner && (
          <button
            type="button"
            onClick={returnBanner.onClick}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
              padding: '13px 18px', background: 'var(--color-brand-500, #E07820)', color: '#fff',
              fontSize: '13.5px', fontWeight: 600, border: 'none', width: '100%',
              textAlign: 'left', cursor: 'pointer',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>←</span> {returnBanner.label}
          </button>
        )}

        {/* Drag handle sur mobile */}
        {isMobile && (
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '2px', background: headerBg }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '999px', background: darkMode ? 'rgba(255,255,255,0.15)' : `${theme.text}30` }} />
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: isMobile ? '12px 16px 14px' : '24px 28px 16px', background: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
          {step === 'detail' ? (
            <RecipeDetailHeader
              recipe={recipe}
              recipeName={recipeName}
              isPage={isPage}
              theme={theme}
              headerText={headerText}
              pct={pct}
              darkMode={darkMode}
              isMobile={isMobile}
              lang={lang}
              t={t}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
              onAllRecipes={onAllRecipes}
              onClose={onClose}
              onEditRecipe={onEditRecipe}
              onAddToCart={onAddToCart}
              hasPremiumAccess={hasPremiumAccess}
              isAdmin={isAdmin}
              canEditRecipe={canEditRecipe}
              isApprovedCommunity={isApprovedCommunity}
              isInCart={isInCart}
              allInFridge={allInFridge}
              cartHeaderNotice={cartHeaderNotice}
              setCartHeaderNotice={setCartHeaderNotice}
              cartHeaderNoticeRef={cartHeaderNoticeRef}
              selectedServings={selectedServings}
              setSelectedServings={setSelectedServings}
              servingsLocked={servingsLocked}
              minServings={minServings}
              lockedByLabel={lockedByLabel}
              lockedOriginServings={lockedOriginServings}
              reviewsAgg={reviewsAgg}
              setActiveTab={setActiveTab}
              setShareOpen={setShareOpen}
              setShowDeleteConfirm={setShowDeleteConfirm}
              titleRef={titleRef}
              flagHovered={flagHovered}
              setFlagHovered={setFlagHovered}
              countryInfo={countryInfo}
              dietTypes={dietTypes}
              recipeDescription={recipeDescription}
              recipeDiets={recipeDiets}
              condensed={condensed}
              collapseStyle={collapseStyle}
              barColor={barColor}
              barTextColor={barTextColor}
              matchCount={matchCount}
              required={required}
            />
          ) : (
            <RecipeWithdrawHeader
              recipe={recipe}
              recipeName={recipeName}
              headerText={headerText}
              theme={theme}
              darkMode={darkMode}
              isMobile={isMobile}
              t={t}
              onBack={() => setStep('detail')}
              onClose={onClose}
            />
          )}
        </div>

        <AdminModifiedBanner
          visible={!!recipe.admin_modified && !!recipe.isCustom}
          darkMode={darkMode}
          t={t}
        />

        {user && (
          <RecipeAllergenWarning
            allergenWarnings={recipeAllergenWarnings}
            allergenTypes={allergenTypes}
            lang={lang}
            darkMode={darkMode}
            t={t}
          />
        )}

        {/* v3.200.0 — Strip allergènes désormais TOUJOURS visible (même
            quand la bannière warning rouge est affichée au-dessus). Les
            2 niveaux d'info sont complémentaires : la bannière alerte
            sur le conflit avec les préférences déclarées, le strip donne
            la vue exhaustive des allergènes contenus dans la recette
            (utile pour l'impression et les invités sans préférences). */}
        {/* Strip allergènes exhaustif : se replie quand le header est condensé
            (mobile, au scroll). La bannière d'alerte rouge ci-dessus, elle,
            reste TOUJOURS visible — c'est de la sécurité, on ne la cache pas. */}
        <div style={collapseStyle}>
          <RecipeAllergenStrip
            allergens={recipeAllergens}
            allergenWarnings={recipeAllergenWarnings}
            allergenTypes={allergenTypes}
            lang={lang}
            darkMode={darkMode}
            t={t}
          />
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        {/* v3.193.0 — Fix responsive : sur mobile, body en column avec
            UN SEUL scroll global (le wrapper). Les sous-colonnes
            (Ingrédients + Onglets) prennent leur hauteur naturelle
            l'une après l'autre. Sur desktop : 2 colonnes côte à côte
            avec scroll indépendant chacune (comportement d'origine). */}
        {step === 'detail' ? (
          <RecipeDetailBody
            recipe={recipe}
            lang={lang}
            darkMode={darkMode}
            isMobile={isMobile}
            variant={variant}
            stock={stock}
            effectiveStock={effectiveStock}
            scaleFactor={scaleFactor}
            INGREDIENT_LOOKUP={INGREDIENT_LOOKUP}
            ingredientsById={ingredientsById}
            recipeNutrition={recipeNutrition}
            recipeCost={recipeCost}
            recipeSteps={recipeSteps}
            recipeName={recipeName}
            hasStockIngredients={hasStockIngredients}
            hasPremiumAccess={hasPremiumAccess}
            cost={cost}
            recipesUsingThis={recipesUsingThis}
            recipesById={recipesById}
            RECIPE_NAMES={RECIPE_NAMES}
            user={user}
            t={t}
            selections={selections}
            setSelections={setSelections}
            pickerIndex={pickerIndex}
            setPickerIndex={setPickerIndex}
            substituteIndex={substituteIndex}
            setSubstituteIndex={setSubstituteIndex}
            addedFlashIndex={addedFlashIndex}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            reviewsAgg={reviewsAgg}
            setReviewsAgg={setReviewsAgg}
            withdrawFeedback={withdrawFeedback}
            setWithdrawFeedback={setWithdrawFeedback}
            pickerRef={pickerRef}
            reviewsRef={reviewsRef}
            feedbackTimerRef={feedbackTimerRef}
            handleBodyScroll={handleBodyScroll}
            handleIngredientClick={handleIngredientClick}
            onToggleIngredient={onToggleIngredient}
            concreteOptions={concreteOptions}
            flashAdded={flashAdded}
            navigate={navigate}
            onClose={onClose}
            enterWithdraw={enterWithdraw}
            logCookedWithoutWithdraw={logCookedWithoutWithdraw}
            setPeekRecipeId={setPeekRecipeId}
          />
        ) : (
          <RecipeWithdrawBody
            recipe={recipe}
            stepTwoState={stepTwoState}
            setStepTwoState={setStepTwoState}
            canConfirm={canConfirm}
            confirmWithdraw={confirmWithdraw}
            ingredientLookup={INGREDIENT_LOOKUP}
            mutedColor={mutedColor}
            darkMode={darkMode}
            isMobile={isMobile}
            lang={lang}
            t={t}
          />
        )}

        <RecipeDeleteDialog
          isOpen={showDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => { onDeleteRecipe?.(recipe.id); onClose() }}
          isMobile={isMobile}
          darkMode={darkMode}
          t={t}
        />

        <WithdrawFeedbackBanner
          message={step !== 'detail' ? withdrawFeedback : null}
          isMobile={isMobile}
        />

        <RecipeShareSheet
          open={shareOpen}
          lang={lang}
          darkMode={darkMode}
          onClose={() => setShareOpen(false)}
          recipe={recipe}
          shareUrl={shareUrl}
          isShareable={isPubliclyShareable}
        />

        {peekRecipeId && (
          <BaseRecipeOverlay
            recipeId={peekRecipeId}
            originRecipe={recipe}
            originServings={selectedServings}
            onClose={closePeek}
            lang={lang}
            darkMode={darkMode}
            stock={stock}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onToggleIngredient={onToggleIngredient}
            allergenPrefs={allergenPrefs}
            onAddToCart={onAddToCart}
            basketRecipeIds={basketRecipeIds}
          />
        )}
      </div>

    </div>
  )
}
