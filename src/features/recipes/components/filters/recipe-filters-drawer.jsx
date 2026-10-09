import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX, LuRotateCcw, LuLeaf, LuSalad, LuApple, LuRecycle, LuSnowflake, LuBaby, LuLayers, LuActivity, LuFlame, LuWallet } from 'react-icons/lu'
import FilterChips from './filter-chips'
import FilterDropdown from './filter-dropdown'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'
import { ToggleRow, RangeFilterRow } from './filter-drawer-rows'
import AllergenPrefsChips from './allergen-prefs-chips'
import { compterLesFiltresActifs } from '@features/recipes/lib/recipe-active-filters'

// Labels propres au drawer (5 langues), en complément des labels
// existants dans PANEL_I18N transmis via la prop `i18n`. Permet d'éviter
// d'enrichir PANEL_I18N juste pour 2 strings.
const DRAWER_LOCAL_I18N = {
  fr: { sortLabel: 'Tri',         preferencesLabel: 'Préférences', closeLabel: 'Fermer', clearLabel: 'Effacer' },
  en: { sortLabel: 'Sort',        preferencesLabel: 'Preferences', closeLabel: 'Close',  clearLabel: 'Clear' },
}

// Phase 8 launch (refonte Recettes) PR 8.7.a. Drawer latéral
// regroupant tous les filtres avancés (type, difficulté, régime, pays, tri,
// toggles saison/healthy). Auparavant ces filtres étaient disséminés dans la
// barre du haut de RecipePanel + une section collapsible (« ⋮ avancés »)
// qui était peu découvrable.
//
// Comportement :
// - Desktop ≥768px : slide-in depuis la droite, max-width 420px, full height.
// - Mobile : bottom sheet plein largeur, max-height 85vh.
// - Header : titre + bouton « Reset tout » (visible si filtres actifs) + ✕.
// - Footer sticky : « Appliquer (N résultats) » qui ferme le drawer.
// - Le hook `useRecipeFilters` n'est pas appelé ici — le parent passe les
//   setters/togglers en props pour préserver la single source of truth.

export default function RecipeFiltersDrawer({
  isOpen,
  onClose,
  isMobile,
  darkMode,
  lang,
  // Hook state (depuis useRecipeFilters)
  typeSet,        toggleType,
  difficultySet,  toggleDifficulty,
  dietSet,        toggleDiet,
  countrySet,     toggleCountry, clearCountry,
  sortMode,       setSortMode,
  seasonalOnly,           setSeasonalOnly,
  healthyOnly,            setHealthyOnly,
  noCookOnly,             setNoCookOnly,
  antiWasteOnly,          setAntiWasteOnly,
  freezerFriendlyOnly,    setFreezerFriendlyOnly,
  kidsFriendlyOnly,       setKidsFriendlyOnly,
  batchCookingOnly,       setBatchCookingOnly,
  // Phase 10b.3 — sliders nutrition + budget
  minProtein,    setMinProtein,
  maxCalories,   setMaxCalories,
  maxBudget,     setMaxBudget,
  // Le curseur de budget, pour qui voit les coûts seulement (audit UX-07).
  budgetVisible = false,
  resetFilters,
  counts,                 // { byType, byDifficulty, byCountry, byDiet, seasonal, healthy, noCook, antiWaste, freezer, kids, batch }
  // Données pour les options
  typeOptions,            // [{value, label}]
  difficultyOptions,
  dietOptions,
  countryOptions,         // [{value, label, flag}]
  sortOptions,            // [{value: 'match'|'alpha'|'quick', label}]
  // Compteurs / labels i18n
  resultsCount,
  i18n,                   // { title, reset, apply, type, difficulty, diet, country, seasonal, healthy }
                          // (sortLabel/preferencesLabel/closeLabel viennent de DRAWER_LOCAL_I18N[lang])
  // Couleurs sections (issues de TYPE_COLORS / DIFFICULTY_COLOR / dietTypes)
  getTypeColor,
  getDifficultyColor,
  getDietColor,
}) {
  // a11y : piège de focus + Échap. Échap passe par la pile des pièges : seul
  // le dessus réagit — avant, un écouteur `window` ici ET dans le panneau
  // fermaient les deux d'un coup (audit 2026-10-02).
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: isOpen, onEscape: onClose })
  useCloseOnBackButton(isOpen, onClose)

  if (!isOpen) return null

  const local = DRAWER_LOCAL_I18N[lang] ?? DRAWER_LOCAL_I18N.fr

  // Le même compte que le badge de la barre (une seule fonction, UX-07).
  const activeCount = compterLesFiltresActifs({
    typeSet, difficultySet, dietSet, countrySet, sortMode,
    seasonalOnly, healthyOnly, noCookOnly, antiWasteOnly, freezerFriendlyOnly, kidsFriendlyOnly, batchCookingOnly,
    minProtein, maxCalories, maxBudget, budgetVisible,
  })

  const panelBg     = darkMode ? '#1C2535' : '#FDFAF6'
  const border      = darkMode ? '#2A3A50' : 'var(--color-border-warm)'
  const textColor   = darkMode ? '#C8D8E8' : '#2d1b00'
  const mutedColor  = darkMode ? '#7A90A8' : '#7A5F56'
  const sectionBg   = darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={i18n.title}
      onClick={onClose}
      className="fp-modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(18,10,4,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex',
        // Desktop : drawer aligné à droite. Mobile : bottom sheet.
        alignItems: isMobile ? 'flex-end' : 'stretch',
        justifyContent: isMobile ? 'stretch' : 'flex-end',
      }}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : '420px',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100dvh',
          maxHeight: isMobile ? '85dvh' : '100dvh',
          background: panelBg,
          borderTopLeftRadius: isMobile ? '20px' : 0,
          borderTopRightRadius: isMobile ? '20px' : 0,
          borderLeft: isMobile ? 'none' : `1px solid ${border}`,
          boxShadow: darkMode ? '0 0 60px rgba(0,0,0,0.6)' : '0 0 60px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: isMobile
            ? 'modal-slide-up 0.28s cubic-bezier(0.34,1.10,0.64,1) both'
            : 'recipe-filters-slide-in 0.28s cubic-bezier(0.34,1.10,0.64,1) both',
        }}
      >
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: isMobile ? '14px 18px 12px' : '18px 22px 14px',
          borderBottom: `1px solid ${border}`,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <h2 style={{
            margin: 0, flex: 1,
            fontSize: isMobile ? '17px' : '18px', fontWeight: 800, color: textColor,
          }}>
            {i18n.title}
            {activeCount > 0 && (
              <span style={{
                marginLeft: '8px',
                fontSize: '12px', fontWeight: 700,
                padding: '2px 8px', borderRadius: '999px',
                background: 'rgba(224,120,32,0.15)', color: 'var(--color-brand-500)',
              }}>
                {activeCount}
              </span>
            )}
          </h2>
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={resetFilters}
              className="h-auto rounded-lg border bg-transparent px-3 py-1.5 text-xs font-bold hover:bg-transparent"
              style={{
                gap: '5px',
                borderColor: border,
                color: mutedColor,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-brand-500)' }}
              onMouseLeave={e => { e.currentTarget.style.color = mutedColor }}
            >
              <LuRotateCcw size={12} />
              {i18n.reset}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={local.closeLabel}
            className="h-auto w-auto p-1 hover:bg-transparent"
            style={{ color: mutedColor }}
          >
            <LuX size={20} />
          </Button>
        </div>

        {/* ─── Body sections (scrollable) ─────────────────────────────── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: isMobile ? '14px 18px' : '18px 22px',
          display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px',
        }}>
          {/* Tri — placé en premier (le filtre le plus utilisé) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '2px', height: '14px', borderRadius: '2px', background: 'rgba(224,120,32,0.55)' }} />
              <span style={{
                fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.10em', color: 'rgba(224,120,32,0.75)',
              }}>
                {local.sortLabel}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {sortOptions.map(opt => {
                const sel = sortMode === opt.value
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setSortMode(opt.value)}
                    className="h-auto flex-1 rounded-[10px] border-[1.5px] px-2 py-2.5 text-[13px] transition-all duration-150"
                    style={{
                      borderColor: sel ? 'var(--color-brand-500)' : border,
                      background: sel
                        ? (darkMode ? 'rgba(224,120,32,0.15)' : 'rgba(224,120,32,0.08)')
                        : sectionBg,
                      color: sel ? 'var(--color-brand-500)' : textColor,
                      fontWeight: sel ? 700 : 500,
                      gap: '6px',
                    }}
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <FilterChips
            label={i18n.type}
            values={typeSet}
            onToggle={toggleType}
            options={typeOptions}
            darkMode={darkMode}
            getColor={getTypeColor}
            counts={counts?.byType}
          />

          <FilterChips
            label={i18n.difficulty}
            values={difficultySet}
            onToggle={toggleDifficulty}
            options={difficultyOptions}
            darkMode={darkMode}
            getColor={getDifficultyColor}
            counts={counts?.byDifficulty}
          />

          <FilterChips
            label={i18n.diet}
            values={dietSet}
            onToggle={toggleDiet}
            options={dietOptions}
            darkMode={darkMode}
            getColor={getDietColor}
            counts={counts?.byDiet}
          />

          <AllergenPrefsChips lang={lang} darkMode={darkMode} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '2px', height: '14px', borderRadius: '2px', background: 'rgba(224,120,32,0.55)' }} />
              <span style={{
                fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.10em', color: 'rgba(224,120,32,0.75)',
              }}>
                {i18n.country}
              </span>
              {countrySet.size > 0 && (
                <span style={{
                  fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                  background: 'rgba(224,120,32,0.15)', color: 'var(--color-brand-500)',
                  border: '1px solid rgba(224,120,32,0.30)',
                }}>
                  {countrySet.size}
                </span>
              )}
            </div>
            <FilterDropdown
              values={countrySet}
              onToggle={toggleCountry}
              onClear={clearCountry}
              options={countryOptions}
              darkMode={darkMode}
              label={i18n.country}
              shortLabel={i18n.country}
              counts={counts?.byCountry}
            />
          </div>

          {/* Préférences (toggles) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '2px', height: '14px', borderRadius: '2px', background: 'rgba(224,120,32,0.55)' }} />
              <span style={{
                fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.10em', color: 'rgba(224,120,32,0.75)',
              }}>
                {local.preferencesLabel}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ToggleRow
                label={i18n.seasonal}
                description={i18n.seasonalDesc}
                icon={<LuLeaf size={15} />}
                color="#5A8A58"
                checked={seasonalOnly}
                onChange={() => setSeasonalOnly(v => !v)}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                sectionBg={sectionBg}
                count={counts?.seasonal}
              />
              <ToggleRow
                label={i18n.healthy}
                description={i18n.healthyDesc}
                icon={<LuSalad size={15} />}
                color="#3A8895"
                checked={healthyOnly}
                onChange={() => setHealthyOnly(v => !v)}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                sectionBg={sectionBg}
                count={counts?.healthy}
              />
              <ToggleRow
                label={i18n.noCook}
                description={i18n.noCookDesc}
                icon={<LuApple size={15} />}
                color="#1FA88B"
                checked={noCookOnly}
                onChange={() => setNoCookOnly(v => !v)}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                sectionBg={sectionBg}
                count={counts?.noCook}
              />
              <ToggleRow
                label={i18n.antiWaste}
                description={i18n.antiWasteDesc}
                icon={<LuRecycle size={15} />}
                color="#5A8A58"
                checked={antiWasteOnly}
                onChange={() => setAntiWasteOnly(v => !v)}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                sectionBg={sectionBg}
                count={counts?.antiWaste}
              />
              <ToggleRow
                label={i18n.freezerFriendly}
                description={i18n.freezerFriendlyDesc}
                icon={<LuSnowflake size={15} />}
                color="#4A8FBF"
                checked={freezerFriendlyOnly}
                onChange={() => setFreezerFriendlyOnly(v => !v)}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                sectionBg={sectionBg}
                count={counts?.freezer}
              />
              <ToggleRow
                label={i18n.kidsFriendly}
                description={i18n.kidsFriendlyDesc}
                icon={<LuBaby size={15} />}
                color="#E89B3C"
                checked={kidsFriendlyOnly}
                onChange={() => setKidsFriendlyOnly(v => !v)}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                sectionBg={sectionBg}
                count={counts?.kids}
              />
              <ToggleRow
                label={i18n.batchCooking}
                description={i18n.batchCookingDesc}
                icon={<LuLayers size={15} />}
                color="#7A5FBF"
                checked={batchCookingOnly}
                onChange={() => setBatchCookingOnly(v => !v)}
                darkMode={darkMode}
                border={border}
                textColor={textColor}
                sectionBg={sectionBg}
                count={counts?.batch}
              />
            </div>
          </div>

          {/* Nutrition & Budget (sliders) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '2px', height: '14px', borderRadius: '2px', background: 'rgba(224,120,32,0.55)' }} />
              <span style={{
                fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.10em', color: 'rgba(224,120,32,0.75)',
              }}>
                {budgetVisible ? i18n.nutritionBudgetLabel : i18n.nutritionLabel}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <RangeFilterRow
                label={i18n.minProtein}
                description={i18n.minProteinDesc}
                icon={<LuActivity size={15} />}
                color="#C44569"
                value={minProtein}
                onChange={setMinProtein}
                min={5} max={50} step={5} unit="g"
                darkMode={darkMode} border={border} textColor={textColor} sectionBg={sectionBg}
                clearLabel={local.clearLabel}
              />
              <RangeFilterRow
                label={i18n.maxCalories}
                description={i18n.maxCaloriesDesc}
                icon={<LuFlame size={15} />}
                color="#E67E22"
                value={maxCalories}
                onChange={setMaxCalories}
                min={200} max={1000} step={50} unit="kcal"
                darkMode={darkMode} border={border} textColor={textColor} sectionBg={sectionBg}
                clearLabel={local.clearLabel}
              />
              {budgetVisible && <RangeFilterRow
                label={i18n.maxBudget}
                description={i18n.maxBudgetDesc}
                icon={<LuWallet size={15} />}
                color="#16A085"
                value={maxBudget}
                onChange={setMaxBudget}
                min={1} max={20} step={1} unit="€"
                darkMode={darkMode} border={border} textColor={textColor} sectionBg={sectionBg}
                clearLabel={local.clearLabel}
              />}
            </div>
          </div>
        </div>

        {/* ─── Footer sticky ─────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: isMobile ? '12px 18px 16px' : '14px 22px 18px',
          borderTop: `1px solid ${border}`,
          background: panelBg,
        }}>
          <Button
            type="button"
            onClick={onClose}
            className="h-auto w-full rounded-xl bg-none bg-[#B85000] px-[18px] py-3 text-sm font-extrabold tracking-[0.01em] text-white"
            style={{
              boxShadow: '0 4px 16px rgba(184,80,0,0.30)',
              transition: 'box-shadow 0.2s, transform 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(212,106,16,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(212,106,16,0.30)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {i18n.apply(resultsCount)}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
