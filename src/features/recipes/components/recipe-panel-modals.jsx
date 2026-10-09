import { LuRotateCcw } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useBaseRecipes, useCountries, useDietTypes } from '@shared/contexts/data-provider'
import { TYPE_COLORS, DIFFICULTY_COLOR } from '@shared/static/recipe-constants'
import RecipeFiltersDrawer from './filters/recipe-filters-drawer'

/**
 * Couche « overlays » du panneau Recettes : les deux modales locales
 * (vider le frigo, roulette sans résultat) et le montage du tiroir de filtres.
 *
 * Le tiroir consomme une trentaine de clés de `filters` : celui-ci arrive donc
 * en UNE prop, re-destructurée ici, plutôt qu'énuméré au site d'appel — sans
 * quoi on reconstruirait la couche de transmission que le playbook interdit.
 * Même chose pour `ui`, qui porte les trois drapeaux d'ouverture.
 */
export default function RecipePanelModals({ filters, ui, t, lang, darkMode, isMobile, counts, filtered, onReset }) {
  const { recipes: RECIPES } = useBaseRecipes()
  const countries = useCountries()
  const dietTypes = useDietTypes()
  const {
    showResetConfirm, setShowResetConfirm,
    showRouletteAlert, setShowRouletteAlert,
    filtersDrawerOpen, setFiltersDrawerOpen,
  } = ui
  const {
    sortMode, setSortMode, difficultySet, toggleDifficulty, typeSet, toggleType,
    countrySet, toggleCountry, clearCountry, dietSet, toggleDiet,
    seasonalOnly, setSeasonalOnly, healthyOnly, setHealthyOnly,
    noCookOnly, setNoCookOnly, antiWasteOnly, setAntiWasteOnly,
    freezerFriendlyOnly, setFreezerFriendlyOnly, kidsFriendlyOnly, setKidsFriendlyOnly,
    batchCookingOnly, setBatchCookingOnly,
    minProtein, setMinProtein, maxCalories, setMaxCalories, maxBudget, setMaxBudget,
    resetFilters,
  } = filters

  const allCodes = [...new Set(RECIPES.map(r => r.country).filter(Boolean))]
  const countryOptions = [
    { value: 'all', label: t.allCountries, flag: null },
    ...allCodes
      .map(code => ({
        value: code,
        label: countries[code]?.names?.[lang] ?? code,
        flag:  countries[code]?.flag ?? '',
      }))
      .sort((a, b) => {
        if (a.value === 'intl') return -1
        if (b.value === 'intl') return 1
        return a.label.localeCompare(b.label, lang)
      }),
  ]

  const difficultyOptions = [
    { value: 'Très facile',   label: t.difficultyMap['Très facile'] },
    { value: 'Facile',        label: t.difficultyMap['Facile'] },
    { value: 'Intermédiaire', label: t.difficultyMap['Intermédiaire'] },
    { value: 'Difficile',     label: t.difficultyMap['Difficile'] },
  ]

  const dietOptions = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'].map(k => ({
    value: k,
    label: dietTypes[k]?.labels?.[lang] ?? k,
  }))
  return (
    <>
  {/* Modale confirmation — vider le frigo */}
  {showResetConfirm && (
    <div
      onClick={() => setShowResetConfirm(false)}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="max-w-[380px] w-full p-7 rounded-2xl text-center"
        style={{
          background:  darkMode ? '#1A2535' : '#FFFAF3',
          border:      `1px solid ${darkMode ? 'rgba(208,80,80,0.22)' : 'rgba(208,80,80,0.18)'}`,
          boxShadow:   '0 12px 48px rgba(0,0,0,0.32)',
        }}
      >
        <div
          className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'rgba(208,80,80,0.10)', boxShadow: '0 0 0 8px rgba(208,80,80,0.06)' }}
        >
          <LuRotateCcw size={26} style={{ color: '#C05050' }} />
        </div>
        <div className="text-lg font-bold mb-2" style={{ color: darkMode ? 'var(--color-bg-warm)' : '#2C1A0E' }}>
          {t.resetConfirmTitle}
        </div>
        <p className="text-sm leading-relaxed mb-6" style={{ color: darkMode ? 'rgba(255,255,255,0.65)' : '#7A6A52' }}>
          {t.resetConfirmBody}
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowResetConfirm(false)}
            className="h-auto flex-1 rounded-xl border-[1.5px] bg-transparent px-4 py-2.5 text-sm font-semibold"
            style={{
              borderColor: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              color: 'var(--color-muted)',
            }}
          >{t.cancel}</Button>
          <Button
            onClick={() => { onReset(); setShowResetConfirm(false) }}
            className="h-auto flex-1 rounded-xl bg-[#C05050] px-4 py-2.5 text-sm font-bold text-white shadow-[0_3px_12px_rgba(192,80,80,0.32)] hover:brightness-110"
          >{t.resetLabel}</Button>
        </div>
      </div>
    </div>
  )}

  {/* Modale roulette : aucune recette éligible */}
  {showRouletteAlert && (
    <div
      onClick={() => setShowRouletteAlert(false)}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="max-w-[420px] w-full p-7 rounded-2xl text-center"
        style={{
          background: darkMode ? '#1A2535' : '#FFFAF3',
          border: `1px solid ${darkMode ? 'rgba(224,120,32,0.25)' : 'rgba(224,120,32,0.20)'}`,
          boxShadow: '0 12px 48px rgba(0,0,0,0.32)',
        }}
      >
        <div className="text-5xl mb-3">🎲</div>
        <div className="text-lg font-bold mb-2.5" style={{ color: darkMode ? 'var(--color-bg-warm)' : '#2C1A0E' }}>
          {t.rouletteLabel}
        </div>
        <p className="text-sm leading-relaxed mb-5" style={{ color: darkMode ? 'rgba(255,255,255,0.70)' : '#7A6A52' }}>
          {t.rouletteNoMatch}
        </p>
        <Button
          onClick={() => setShowRouletteAlert(false)}
          className="h-auto rounded-xl bg-[#E07820] px-7 py-2.5 text-sm font-bold text-white shadow-[0_3px_12px_rgba(224,120,32,0.35)]"
        >
          OK
        </Button>
      </div>
    </div>
  )}

  {/* v3.191.0 — Drawer latéral filtres (PR 8.7.a). */}
  <RecipeFiltersDrawer
    isOpen={filtersDrawerOpen}
    onClose={() => setFiltersDrawerOpen(false)}
    isMobile={isMobile}
    darkMode={darkMode}
    lang={lang}
    counts={counts}
    typeSet={typeSet}               toggleType={toggleType}
    difficultySet={difficultySet}   toggleDifficulty={toggleDifficulty}
    dietSet={dietSet}               toggleDiet={toggleDiet}
    countrySet={countrySet}         toggleCountry={toggleCountry}  clearCountry={clearCountry}
    sortMode={sortMode}             setSortMode={setSortMode}
    seasonalOnly={seasonalOnly}             setSeasonalOnly={setSeasonalOnly}
    healthyOnly={healthyOnly}               setHealthyOnly={setHealthyOnly}
    noCookOnly={noCookOnly}                 setNoCookOnly={setNoCookOnly}
    antiWasteOnly={antiWasteOnly}           setAntiWasteOnly={setAntiWasteOnly}
    freezerFriendlyOnly={freezerFriendlyOnly} setFreezerFriendlyOnly={setFreezerFriendlyOnly}
    kidsFriendlyOnly={kidsFriendlyOnly}     setKidsFriendlyOnly={setKidsFriendlyOnly}
    batchCookingOnly={batchCookingOnly}     setBatchCookingOnly={setBatchCookingOnly}
    minProtein={minProtein}       setMinProtein={setMinProtein}
    maxCalories={maxCalories}     setMaxCalories={setMaxCalories}
    maxBudget={maxBudget}         setMaxBudget={setMaxBudget}
    resetFilters={resetFilters}
    typeOptions={t.typeOptions.filter(o => o.value !== 'all')}
    difficultyOptions={difficultyOptions}
    dietOptions={dietOptions}
    countryOptions={countryOptions}
    sortOptions={[
      { value: 'match', label: `🎯 ${t.sortOptMatch}` },
      { value: 'alpha', label: `🔤 ${t.sortOptAlpha}` },
      { value: 'quick', label: `⏱ ${t.sortOptQuick}` },
    ]}
    resultsCount={filtered.length}
    i18n={{
      title:       t.moreFilters,
      reset:       t.clearAllFilters,
      apply:       (n) => t.resultsCount(n),
      type:        t.typeLabel,
      difficulty:  t.levelLabel,
      diet:        t.dietLabel,
      country:     t.countryLabel,
      seasonal:    t.seasonalShort,
      healthy:     t.healthyShort,
      noCook:          t.noCookShort,
      antiWaste:       t.antiWasteShort,
      freezerFriendly: t.freezerFriendlyShort,
      kidsFriendly:    t.kidsFriendlyShort,
      batchCooking:    t.batchCookingShort,
      seasonalDesc:        t.seasonalDesc,
      healthyDesc:         t.healthyDesc,
      noCookDesc:          t.noCookDesc,
      antiWasteDesc:       t.antiWasteDesc,
      freezerFriendlyDesc: t.freezerFriendlyDesc,
      kidsFriendlyDesc:    t.kidsFriendlyDesc,
      batchCookingDesc:    t.batchCookingDesc,
      // Phase 10b.3 — sliders nutrition + budget
      nutritionBudgetLabel: t.nutritionBudgetLabel,
      minProtein:           t.minProtein,
      minProteinDesc:       t.minProteinDesc,
      maxCalories:          t.maxCalories,
      maxCaloriesDesc:      t.maxCaloriesDesc,
      maxBudget:            t.maxBudget,
      maxBudgetDesc:        t.maxBudgetDesc,
    }}
    getTypeColor={(v) => TYPE_COLORS[v]
      ? { bg: TYPE_COLORS[v].bg, text: TYPE_COLORS[v].text, border: TYPE_COLORS[v].text }
      : null}
    getDifficultyColor={(v) => DIFFICULTY_COLOR[v]
      ? { bg: `${DIFFICULTY_COLOR[v]}20`, text: DIFFICULTY_COLOR[v], border: DIFFICULTY_COLOR[v] }
      : null}
    getDietColor={(v) => dietTypes[v]
      ? { bg: dietTypes[v].bg_color, text: dietTypes[v].color, border: dietTypes[v].color }
      : null}
  />
    </>
  )
}
