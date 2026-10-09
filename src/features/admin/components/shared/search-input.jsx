import { useId } from 'react'
import { LuSearch, LuX } from 'react-icons/lu'

// Champ de recherche admin unifié (Vague A — fondations). Icône loupe + bouton
// effacer. `onChange(value)` reçoit la chaîne (pas l'event) ; le bouton effacer
// appelle onChange('').
// `label` nomme le champ et se lit à gauche du cadre, à la hauteur des pastilles
// de filtre voisines (décision du 2026-10-06, « libellés = visibles ») ; un
// `placeholder`, s'il y en a un, n'est qu'un exemple. `width` règle le cadre.
// Sur un téléphone, le libellé passe au-dessus du cadre plutôt que de pousser
// la page hors de l'écran (« Rechercher un commentaire » + 200 px > 343 px).
export default function SearchInput({ value = '', onChange, label, placeholder, darkMode = false, width }) {
  const champId = useId()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px', ...(width ? {} : { flex: 1 }) }}>
      <label htmlFor={champId} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{label}</label>
      <div style={{ position: 'relative', ...(width ? { width } : { flex: 1 }) }}>
        <LuSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
        <input
          id={champId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', padding: '8px 32px 8px 30px', borderRadius: 10, border: `1px solid ${darkMode ? '#2A3A50' : '#D9CCBA'}`, background: darkMode ? '#141F2E' : '#FFF', color: darkMode ? '#C8D8E8' : '#1A0F00', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange?.('')}
            aria-label="Effacer la recherche"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: 2, display: 'flex' }}
          >
            <LuX size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
