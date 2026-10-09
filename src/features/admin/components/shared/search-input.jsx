import { LuSearch, LuX } from 'react-icons/lu'

// Champ de recherche admin unifié (Vague A — fondations). Icône loupe + bouton
// effacer. `onChange(value)` reçoit la chaîne (pas l'event) ; le bouton effacer
// appelle onChange('').
export default function SearchInput({ value = '', onChange, placeholder = 'Rechercher…', darkMode = false, ariaLabel, width }) {
  return (
    <div style={{ position: 'relative', ...(width ? { width } : { flex: 1 }) }}>
      <LuSearch size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
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
  )
}
