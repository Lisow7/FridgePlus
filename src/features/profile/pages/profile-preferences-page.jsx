import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LuGlobe, LuFlag, LuRefrigerator, LuTriangleAlert, LuWallet } from 'react-icons/lu'
import { FRIDGE_SHAPES, DEFAULT_FRIDGE_SHAPE } from '@shared/lib/resolve-fridge-layout'
import { useAuth } from '@shared/contexts/auth-provider'
// v3.409 — section Charte communauté déplacée vers Profil > Profil
// (identity-page). Imports retirés.
import { useSubscription } from '@shared/hooks/use-subscription'
import { useLang, useDarkMode } from '@shared/contexts/ui-provider'
import { useAllergenTypes, useCountries } from '@shared/contexts/data-provider'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import Button from '@shared/ui/button'
import AllergenPicker from '@features/profile/components/allergen-picker'
import ProfilePageIntro from '@features/profile/components/profile-page-intro'
import ProfileSection  from '@features/profile/components/profile-section'

// Sprint 11 S11.a.3 — sous-page /profile/preferences.
// Réglages perso : langue/dark mode, pays favori, allergens picker, budget mensuel.

const I18N = {
  fr: {
    pageTitle: 'Préférences',
    pageIntro: 'Comment tu utilises Fridge+ — langue, pays, allergènes, budget. Ces choix ne sont pas partagés.',
    langTitle: 'Langue & affichage',
    langDesc:  'La langue de l\'app et le thème clair/sombre.',
    langLabel: 'Langue',
    darkLabel: 'Mode sombre',
    countryTitle: 'Pays',
    // ⚠️ Ne pas re-promettre ici que le pays change la disposition du frigo :
    // c'était FAUX (aucun code ne le faisait) et la forme est désormais une
    // préférence dédiée (section « Forme du frigo » ci-dessous).
    countryDesc:  'Influence les recettes proposées.',
    countryNone: '— aucun —',
    shapeTitle: 'Forme du frigo',
    shapeDesc:  'La disposition de ton frigo virtuel. Elle ne dépend plus de la langue : celle que tu choisis ici te suit partout.',
    shapeTopFreezer: 'Congélateur en haut',
    shapeSideBySide: 'Portes côte à côte',
    shapeSaved: 'Forme enregistrée.',
    allergenTitle: 'Allergènes',
    allergenSub:   'Les recettes contenant ces allergènes seront signalées dans la communauté et le frigo.',
    allergenNone:  'Aucun allergène sélectionné.',
    allergenReset: 'Tout décocher',
    allergenSaveBtn: 'Enregistrer',
    allergenSaved: 'Préférences enregistrées.',
    budgetTitle: 'Budget courses',
    budgetDesc:  'Une limite mensuelle optionnelle. Une barre de progression s\'affiche dans ton panier pour suivre tes dépenses.',
    budgetPlaceholder: 'Montant',
    budgetSave:  'Enregistrer',
    budgetRemove: 'Supprimer la limite',
    budgetActive: (n) => `${Number(n).toLocaleString('fr-FR')} € / mois`,
    budgetNoLimit: 'Aucune limite définie',
    budgetError:   'Montant invalide (doit être supérieur à 0).',
    perTripTitle:  'Seuil par course',
    perTripDesc:   'Une alerte non-bloquante apparaît dans le panier dès que ton total estimé dépasse ce montant. Indépendant du budget mensuel.',
    perTripActive: (n) => `${Number(n).toLocaleString('fr-FR')} € max par course`,
    perTripNoLimit: 'Aucune limite par course',
    // v3.409 — Charte communauté i18n déplacé vers profile-identity-page.jsx
    // (section unifiée sur Profil pour éviter la duplication).
  },
  en: {
    pageTitle: 'Preferences',
    pageIntro: 'How you use Fridge+ — language, country, allergens, budget. These choices are not shared.',
    langTitle: 'Language & display',
    langDesc:  'App language and light/dark theme.',
    langLabel: 'Language',
    darkLabel: 'Dark mode',
    countryTitle: 'Country',
    countryDesc:  'Influences suggested recipes.',
    countryNone: '— none —',
    shapeTitle: 'Fridge shape',
    shapeDesc:  'The layout of your virtual fridge. It no longer depends on the language: the shape you pick here follows you everywhere.',
    shapeTopFreezer: 'Freezer on top',
    shapeSideBySide: 'Side-by-side doors',
    shapeSaved: 'Shape saved.',
    allergenTitle: 'Allergens',
    allergenSub:   'Recipes containing these allergens will be flagged in the community and the fridge.',
    allergenNone:  'No allergen selected.',
    allergenReset: 'Uncheck all',
    allergenSaveBtn: 'Save',
    allergenSaved: 'Preferences saved.',
    budgetTitle: 'Shopping budget',
    budgetDesc:  'An optional monthly limit. A progress bar appears in your basket to track spending.',
    budgetPlaceholder: 'Amount',
    budgetSave:  'Save',
    budgetRemove: 'Remove limit',
    budgetActive: (n) => `${Number(n).toLocaleString('en-US')} € / month`,
    budgetNoLimit: 'No limit set',
    budgetError:   'Invalid amount (must be greater than 0).',
    perTripTitle:  'Per-trip limit',
    perTripDesc:   'A non-blocking alert appears in your cart as soon as your estimated total exceeds this amount. Independent from the monthly budget.',
    perTripActive: (n) => `${Number(n).toLocaleString('en-US')} € max per trip`,
    perTripNoLimit: 'No per-trip limit',
    // v3.409 — Charter i18n moved to profile-identity-page.jsx.
  },
}

export default function ProfilePreferencesPage() {
  const { lang = 'fr', darkMode = false, profile } = useOutletContext()
  const t = I18N[lang] ?? I18N.fr
  const { updateProfile, allergenPrefs, updateAllergenPrefs } = useAuth()
  const { hasPremiumAccess } = useSubscription()
  const { setLang } = useLang()
  const { toggleDarkMode } = useDarkMode()
  const allergenTypes = useAllergenTypes()
  const ALLERGEN_KEYS = Object.keys(allergenTypes)
  const countries = useCountries()
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640

  // ── Pays ──────────────────────────────────────────────────────────────
  // Select CONTRÔLÉ (value=, pas defaultValue=) : `profile.country_code` est mis
  // à jour par updateProfile (setProfile dans auth-provider) → le choix reste
  // affiché après sauvegarde et au retour sur la page. Avant, defaultValue ne se
  // resynchronisait jamais → toujours « aucun » (la colonne manquait aussi en BDD).
  const [countrySaved, setCountrySaved] = useState(false)
  async function handleSaveCountry(code) {
    const { error } = await updateProfile({ country_code: code || null })
    if (!error) {
      setCountrySaved(true)
      setTimeout(() => setCountrySaved(false), 2000)
    }
  }

  // ── Forme du frigo (2026-08-27) ───────────────────────────────────────
  // La forme est découplée de la langue : préférence dédiée, défaut
  // top-freezer pour tous. Enregistrement immédiat au clic (comme le pays).
  const [shapeSaved, setShapeSaved] = useState(false)
  const [shapeSaving, setShapeSaving] = useState(false)
  const currentShape = FRIDGE_SHAPES.includes(profile?.fridge_shape) ? profile.fridge_shape : DEFAULT_FRIDGE_SHAPE
  async function handleSaveShape(shape) {
    if (shape === currentShape || shapeSaving) return
    setShapeSaving(true)
    const { error } = await updateProfile({ fridge_shape: shape })
    setShapeSaving(false)
    if (!error) {
      setShapeSaved(true)
      setTimeout(() => setShapeSaved(false), 2000)
    }
  }

  // v3.409 — Charte communauté handlers déplacés vers profile-identity-page.jsx
  // (section unifiée). Préférences reste pour les préférences UX pures.

  // ── Allergens (état local, sauvegarde manuelle) ──────────────────────
  const [localAllergens, setLocalAllergens] = useState(allergenPrefs ?? [])
  const [allergenSaved, setAllergenSaved] = useState(false)
  const [allergenSaving, setAllergenSaving] = useState(false)

  function toggleAllergen(key) {
    setLocalAllergens((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  async function handleSaveAllergens() {
    setAllergenSaving(true)
    const { error } = await updateAllergenPrefs(localAllergens)
    setAllergenSaving(false)
    if (!error) {
      setAllergenSaved(true)
      setTimeout(() => setAllergenSaved(false), 2000)
    }
  }

  // ── Budget ────────────────────────────────────────────────────────────
  const [budget, setBudget] = useState(profile?.monthly_budget != null ? String(profile.monthly_budget) : '')
  const [budgetError, setBudgetError] = useState(null)
  const [budgetSaving, setBudgetSaving] = useState(false)

  async function handleSaveBudget() {
    const n = Number(budget)
    if (!Number.isFinite(n) || n <= 0) {
      setBudgetError(t.budgetError)
      return
    }
    setBudgetSaving(true)
    setBudgetError(null)
    await updateProfile({ monthly_budget: n })
    setBudgetSaving(false)
  }

  async function handleRemoveBudget() {
    setBudgetSaving(true)
    await updateProfile({ monthly_budget: null })
    setBudget('')
    setBudgetSaving(false)
  }

  // v3.412 PR-E — second budget : par course (basket courant). Le warning
  // est non-bloquant (affiché dans le panier en temps réel). Distinct du
  // mensuel qui cumule toutes les courses du mois.
  const [perTripBudget, setPerTripBudget] = useState(profile?.per_trip_budget != null ? String(profile.per_trip_budget) : '')
  const [perTripError, setPerTripError] = useState(null)
  const [perTripSaving, setPerTripSaving] = useState(false)

  async function handleSavePerTripBudget() {
    const n = Number(perTripBudget)
    if (!Number.isFinite(n) || n <= 0) {
      setPerTripError(t.budgetError)
      return
    }
    setPerTripSaving(true)
    setPerTripError(null)
    await updateProfile({ per_trip_budget: n })
    setPerTripSaving(false)
  }

  async function handleRemovePerTripBudget() {
    setPerTripSaving(true)
    await updateProfile({ per_trip_budget: null })
    setPerTripBudget('')
    setPerTripSaving(false)
  }

  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'
  const border     = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const inputBg    = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.60)'

  // i18n objet attendu par AllergenPicker
  const allergenT = {
    allergenTitle: t.allergenTitle,
    allergenSub:   t.allergenSub,
    allergenNone:  t.allergenNone,
    saveBtn:       t.allergenSaveBtn,
  }

  return (
    <>
      <ProfilePageIntro title={t.pageTitle} description={t.pageIntro} darkMode={darkMode} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ProfileSection
          Icon={LuGlobe}
          title={t.langTitle}
          description={t.langDesc}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: textColor }}>{t.langLabel}</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                aria-label={t.langLabel}
                style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${border}`, background: inputBg, color: textColor }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={darkMode}
                onChange={() => toggleDarkMode()}
                aria-label={t.darkLabel}
              />
              <span style={{ fontSize: '13px', color: textColor }}>{t.darkLabel}</span>
            </label>
          </div>
        </ProfileSection>

        <ProfileSection
          Icon={LuFlag}
          title={t.countryTitle}
          description={t.countryDesc}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={profile?.country_code ?? ''}
              onChange={(e) => handleSaveCountry(e.target.value)}
              aria-label={t.countryTitle}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: `1px solid ${border}`,
                background: inputBg, color: textColor,
                width: '100%', maxWidth: '320px',
              }}
            >
              <option value="">{t.countryNone}</option>
              {Object.entries(countries ?? {}).map(([code, c]) => {
                const name = (c?.names?.[lang]) ?? (c?.names?.fr) ?? (c?.name_fr ?? c?.name ?? code)
                const flag = c?.flag ?? ''
                return (
                  <option key={code} value={code}>
                    {flag} {name}
                  </option>
                )
              })}
            </select>
            {countrySaved && (
              <span role="status" style={{ fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                ✓ {t.allergenSaved}
              </span>
            )}
          </div>
        </ProfileSection>

        <ProfileSection
          Icon={LuRefrigerator}
          title={t.shapeTitle}
          description={t.shapeDesc}
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div role="radiogroup" aria-label={t.shapeTitle} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {FRIDGE_SHAPES.map((shape) => {
                const selected = shape === currentShape
                const label = shape === 'top-freezer' ? t.shapeTopFreezer : t.shapeSideBySide
                return (
                  <button
                    key={shape}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleSaveShape(shape)}
                    disabled={shapeSaving}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                      padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                      border: selected ? '2px solid #D46A10' : `1px solid ${border}`,
                      background: selected ? 'rgba(212,106,16,0.10)' : inputBg,
                      color: textColor, font: 'inherit',
                    }}
                  >
                    {/* Croquis : la géométrie suffit, pas de texte dedans */}
                    {shape === 'top-freezer' ? (
                      <svg width="52" height="64" viewBox="0 0 52 64" aria-hidden="true">
                        <rect x="1" y="1" width="50" height="62" rx="7" fill="none" stroke="currentColor" strokeWidth="2"/>
                        <line x1="1" y1="20" x2="51" y2="20" stroke="currentColor" strokeWidth="2"/>
                        <rect x="42" y="6"  width="3" height="9"  rx="1.5" fill="#D46A10"/>
                        <rect x="42" y="26" width="3" height="18" rx="1.5" fill="#D46A10"/>
                      </svg>
                    ) : (
                      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                        <rect x="1" y="1" width="62" height="62" rx="7" fill="none" stroke="currentColor" strokeWidth="2"/>
                        <line x1="32" y1="1" x2="32" y2="63" stroke="currentColor" strokeWidth="2"/>
                        <rect x="25" y="14" width="3" height="20" rx="1.5" fill="#D46A10"/>
                        <rect x="36" y="14" width="3" height="20" rx="1.5" fill="#D46A10"/>
                      </svg>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: selected ? 700 : 500 }}>{label}</span>
                  </button>
                )
              })}
            </div>
            {shapeSaved && (
              <span role="status" style={{ fontSize: '13px', fontWeight: 600, color: '#16A34A' }}>
                ✓ {t.shapeSaved}
              </span>
            )}
          </div>
        </ProfileSection>

        <ProfileSection
          Icon={LuTriangleAlert}
          title={t.allergenTitle}
          description={t.allergenSub}
          lang={lang}
          darkMode={darkMode}
        >
          <AllergenPicker
            allergens={allergenTypes}
            allergenKeys={ALLERGEN_KEYS}
            selectedKeys={localAllergens}
            onToggle={toggleAllergen}
            onReset={() => setLocalAllergens([])}
            onSave={handleSaveAllergens}
            isLoading={allergenSaving}
            isSaved={allergenSaved}
            t={allergenT}
            lang={lang}
            darkMode={darkMode}
            isMobile={isMobile}
            border={border}
            inputBg={inputBg}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        </ProfileSection>

        {/* Sprint 11 — Budget Premium-gated : la barre de progression
            dépend de l'analyse des dépenses (feature Premium). Masqué
            pour les comptes free (pas d'utilité sans collecte des
            spending events). */}
        {hasPremiumAccess && <ProfileSection
          Icon={LuWallet}
          title={t.budgetTitle}
          description={t.budgetDesc}
          badge="premium"
          lang={lang}
          darkMode={darkMode}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '13px', margin: 0, color: textColor }}>
              {profile?.monthly_budget != null
                ? t.budgetActive(profile.monthly_budget)
                : t.budgetNoLimit}
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                min="1"
                value={budget}
                onChange={(e) => { setBudget(e.target.value); setBudgetError(null) }}
                placeholder={t.budgetPlaceholder}
                aria-label={t.budgetTitle}
                style={{
                  padding: '8px 10px', borderRadius: '8px',
                  border: `1px solid ${budgetError ? '#DC2626' : border}`,
                  background: inputBg, color: textColor, width: '140px',
                }}
              />
              <Button onClick={handleSaveBudget} loading={budgetSaving} disabled={budgetSaving || !budget}>
                {t.budgetSave}
              </Button>
              {profile?.monthly_budget != null && (
                <Button onClick={handleRemoveBudget} loading={budgetSaving} variant="secondary">
                  {t.budgetRemove}
                </Button>
              )}
            </div>
            {budgetError && <p style={{ color: '#DC2626', fontSize: '12px', margin: 0 }}>{budgetError}</p>}

            {/* v3.412 PR-E — second budget : seuil par course (basket
                courant). Distinct du mensuel : alerte non-bloquante
                pour ne pas dépasser sur UNE course donnée. */}
            <div style={{ borderTop: `1px dashed ${border}`, paddingTop: '12px', marginTop: '4px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: textColor, margin: '0 0 4px' }}>
                {t.perTripTitle}
              </p>
              <p style={{ fontSize: '12px', color: mutedColor, margin: '0 0 8px', lineHeight: 1.5 }}>
                {t.perTripDesc}
              </p>
              <p style={{ fontSize: '13px', margin: 0, color: textColor }}>
                {profile?.per_trip_budget != null
                  ? t.perTripActive(profile.per_trip_budget)
                  : t.perTripNoLimit}
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                <input
                  type="number"
                  min="1"
                  value={perTripBudget}
                  onChange={(e) => { setPerTripBudget(e.target.value); setPerTripError(null) }}
                  placeholder={t.budgetPlaceholder}
                  aria-label={t.perTripTitle}
                  style={{
                    padding: '8px 10px', borderRadius: '8px',
                    border: `1px solid ${perTripError ? '#DC2626' : border}`,
                    background: inputBg, color: textColor, width: '140px',
                  }}
                />
                <Button onClick={handleSavePerTripBudget} loading={perTripSaving} disabled={perTripSaving || !perTripBudget}>
                  {t.budgetSave}
                </Button>
                {profile?.per_trip_budget != null && (
                  <Button onClick={handleRemovePerTripBudget} loading={perTripSaving} variant="secondary">
                    {t.budgetRemove}
                  </Button>
                )}
              </div>
              {perTripError && <p style={{ color: '#DC2626', fontSize: '12px', margin: '8px 0 0' }}>{perTripError}</p>}
            </div>
          </div>
        </ProfileSection>}

        {/* v3.409 — Section Charte communauté DÉPLACÉE vers Profil > Profil
            (identity page). Plus de duplication. Préférences reste pour les
            préférences UX, Profil pour les engagements personnels (charte). */}
      </div>
    </>
  )
}
