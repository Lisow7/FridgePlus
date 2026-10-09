import InfoTooltip from '@shared/ui/info-tooltip'

// Onglet Nutrition du RecipeModal — extrait de recipe-modal.jsx (2026-07-25,
// audit front §2) pour alléger le composant monstre. Purement présentationnel :
// reçoit les valeurs nutritionnelles déjà calculées (par portion) et les
// libellés i18n ; aucune logique de calcul ici.
export default function RecipeNutritionTab({ nutrition, t, darkMode = false, isMobile = false, lang = 'fr' }) {
  if (!nutrition.hasData) {
    return (
      <p style={{ fontSize: '14px', color: 'var(--color-muted)', fontStyle: 'italic' }}>{t.noNutrition}</p>
    )
  }

  const items = [
    { label: t.calLabel,  value: `${nutrition.cal} kcal`, icon: '🔥' },
    { label: t.protLabel, value: `${nutrition.prot} g`,   icon: '🥩' },
    { label: t.carbLabel, value: `${nutrition.carb} g`,   icon: '🍞' },
    { label: t.fatLabel,  value: `${nutrition.fat} g`,    icon: '🫒' },
    { label: t.fibLabel,  value: `${nutrition.fib} g`,    icon: '🌿' },
  ]
  // Desktop : ordre alphabétique du libellé (chantier E, 2026-07-09).
  // Mobile : ordre nutritionnel d'origine conservé (non demandé).
  const ordered = isMobile ? items : [...items].sort((a, b) => a.label.localeCompare(b.label, lang))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', margin: 0 }}>
          {t.nutritionLabel}
        </p>
        <InfoTooltip text={t.nutritionInfo} darkMode={darkMode} />
      </div>
      {/* Grille responsive : 1 colonne sur mobile (chantier E, 2026-07-09 —
          demande explicite), 3 sur desktop. minmax(0, 1fr) autorise les cases
          à rétrécir sous la largeur de leur contenu (évite l'overflow). */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
        {ordered.map(({ label, value, icon }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, padding: '10px 12px', borderRadius: '10px', background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
            <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: 1.2 }}>{label}</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: darkMode ? '#E0C890' : 'var(--color-charcoal)' }}>{value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
