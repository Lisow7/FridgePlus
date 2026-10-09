import Emoji from '@shared/ui/emoji'
import { pickLocalizedName } from '@shared/lib/recipes/recipe-i18n'

// Section « Recettes qui utilisent cette recette » du RecipeModal — extraite
// (2026-07-25, audit front §2) pour alléger le composant monstre.
//
// Visible uniquement si au moins une suggestion existe (jamais d'état vide) :
// `recipe_relations` (BDD) n'est pas garanti en phase avec le catalogue statique
// chargé (recette retirée, id orphelin) → on ne garde que les ids résolvables,
// sinon un titre de section pourrait s'afficher sans aucune carte.
// RGPD : relation de contenu statique recette↔recette, aucune donnée
// utilisateur, même liste pour tout le monde.
export default function RecipeUsingBaseSuggestions({ ids, recipesById, recipeNames, t, lang = 'fr', darkMode = false, isMobile = false, onSelect }) {
  const resolved = ids
    .map(id => ({ id, target: recipesById.get(id) }))
    .filter(({ target }) => target)
  if (resolved.length === 0) return null

  return (
    <div style={{ padding: isMobile ? '14px 16px' : '20px', borderTop: `1px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}`, flexShrink: 0 }}>
      <p className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-muted)] mb-2">{t.usingBaseLabel}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {resolved.map(({ id, target }) => {
          const name = pickLocalizedName(recipeNames[id], null, lang, id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '12px',
                border: `1.5px solid ${darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}`,
                background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <Emoji char={target.emoji} size={22} />
              <span style={{ flex: 1, fontSize: '14.5px', fontWeight: 700, color: darkMode ? '#E0C890' : 'var(--color-charcoal)' }}>{name}</span>
              <span aria-hidden="true" style={{ color: 'var(--color-muted)' }}>→</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
