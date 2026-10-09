// Phase 8 launch (refonte Recettes) PR 8.7.b. Extraction de
// RecipeModal : 2 bannières liées aux allergènes.
//
// 1. `<RecipeAllergenWarning>` (rouge) : visible uniquement si l'utilisateur
//    est connecté ET a déclaré des allergènes ET au moins un est dans la
//    recette. Liste les allergènes de la recette qui matchent ses préférences.
// 2. `<RecipeAllergenStrip>` (discret) : toujours visible si la recette
//    contient des allergènes (référencés dans `recipeNutrition.allergens`).
//    Les allergènes en conflit avec ses préférences (s'il y en a) sont
//    surlignés en rouge ; les autres restent neutres.
//
// Les composants sont purs : reçoivent les data + i18n du parent.

export function RecipeAllergenWarning({ allergenWarnings, allergenTypes, lang, darkMode, t }) {
  if (!allergenWarnings || allergenWarnings.length === 0) return null
  return (
    <div style={{
      flexShrink: 0,
      padding: '10px 24px',
      background: darkMode ? 'rgba(220,38,38,0.14)' : 'rgba(220,38,38,0.08)',
      borderBottom: `1px solid ${darkMode ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.25)'}`,
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <span style={{ fontSize: '18px', flexShrink: 0 }}>🚨</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#FCA5A5' : '#B91C1C', marginBottom: '6px' }}>
          {t.allergenBannerTitle}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {allergenWarnings.map(a => {
            const info = allergenTypes[a]
            return (
              <span key={a} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 11px', borderRadius: '8px',
                background: darkMode ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.12)',
                border: `1px solid ${darkMode ? 'rgba(220,38,38,0.50)' : 'rgba(220,38,38,0.35)'}`,
                fontSize: '13px', fontWeight: 700,
                color: darkMode ? '#FCA5A5' : '#B91C1C',
              }}>
                {info?.icon} {info?.labels?.[lang] ?? info?.labels?.fr ?? a}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function RecipeAllergenStrip({ allergens, allergenWarnings, allergenTypes, lang, darkMode, t }) {
  if (!allergens || allergens.length === 0) return null
  return (
    <div style={{
      flexShrink: 0,
      padding: '8px 24px',
      borderBottom: `1px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}`,
      display: 'flex', alignItems: 'center', gap: '8px',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', flexShrink: 0 }}>
        {t.allergenSectionLabel}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {allergens.map(a => {
          const info = allergenTypes[a]
          const isMatch = allergenWarnings.includes(a)
          return (
            <span key={a} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 9px', borderRadius: '8px',
              background: isMatch
                ? (darkMode ? 'rgba(220,38,38,0.20)' : 'rgba(220,38,38,0.10)')
                : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
              border: `1px solid ${isMatch
                ? (darkMode ? 'rgba(220,38,38,0.40)' : 'rgba(220,38,38,0.25)')
                : (darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)')}`,
              fontSize: '13px', fontWeight: isMatch ? 700 : 500,
              color: isMatch
                ? (darkMode ? '#FCA5A5' : '#B91C1C')
                : (darkMode ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)'),
            }}>
              {info?.icon} {info?.labels?.[lang] ?? info?.labels?.fr ?? a}
            </span>
          )
        })}
      </div>
    </div>
  )
}
