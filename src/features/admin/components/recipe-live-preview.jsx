// Aperçu live de la fiche recette (vue utilisateur) affiché à côté du formulaire
// admin. Lecture seule, rendu depuis l'état courant du formulaire.

const DIET_LABELS = {
  vegetarian: { fr: '🌿 Végétarien', en: '🌿 Vegetarian' },
  vegan: { fr: '🌱 Végan', en: '🌱 Vegan' },
  'gluten-free': { fr: '🚫🌾 Sans gluten', en: '🚫🌾 Gluten-free' },
  'dairy-free': { fr: '🥛 Sans lactose', en: '🥛 Dairy-free' },
}

export default function RecipeLivePreview({ emoji, imageUrl, name = {}, timeMins, servings, diet = [], ingredients = [], steps = {}, lang = 'fr', darkMode = false }) {
  const fg = darkMode ? '#E8EEF5' : '#2C1A0E'
  const muted = darkMode ? '#9FB0C4' : '#7A6A52'
  const cardBg = darkMode ? '#111E2D' : '#FFF'
  const border = darkMode ? '#243450' : '#ECE3D5'
  const title = name[lang] || name.fr || ('(sans nom)')
  const ingLabel = (slot) => slot?.labels?.[lang] || slot?.labels?.fr || ''
  const stepList = steps?.[lang] ?? steps?.fr ?? []

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: muted, marginBottom: 8 }}>
        {'Aperçu live (vue utilisateur)'}
      </div>
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ height: 120, background: 'linear-gradient(135deg,#FAE3C8,#F3CBA0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, overflow: 'hidden' }}>
          {imageUrl
            ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            : (emoji || '🍽️')}
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: fg }}>{title}</div>
          <div style={{ fontSize: 13, color: muted, margin: '6px 0 10px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span>⏱ {timeMins || '—'} min</span>
            <span>·</span>
            <span>👤 {servings || '—'} {'pers'}</span>
            {(diet ?? []).map((d) => (
              <span key={d} style={{ fontSize: 12 }}>{DIET_LABELS[d]?.[lang] ?? DIET_LABELS[d]?.fr ?? d}</span>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: muted, margin: '8px 0 4px' }}>
            {'Ingrédients'} ({ingredients.length})
          </div>
          {ingredients.length === 0
            ? <div style={{ fontSize: 13, color: muted, fontStyle: 'italic' }}>—</div>
            : ingredients.map((slot, i) => (
              <div key={i} style={{ fontSize: 13, color: fg, padding: '2px 0' }}>• {ingLabel(slot) || <em style={{ color: muted }}>(libellé vide)</em>}</div>
            ))}

          {stepList.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: muted, margin: '12px 0 4px' }}>
                {'Étapes'} ({stepList.length})
              </div>
              {stepList.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: fg, padding: '3px 0', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--color-brand-500)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{s || <em style={{ color: muted }}>…</em>}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
