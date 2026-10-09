import { LuArrowLeft } from 'react-icons/lu'

const ORDER = ['prepare', 'shopping', 'home', 'whatsNext']

const I18N = {
  fr: { back: 'Précédent' },
  en: { back: 'Back' },
}

// Bouton « ← Précédent » entre phases du panier. Pur, sans état.
// Masqué en 1re phase (Préparer) et en « Et après ? » (qui a ses propres CTAs).
export default function CartBackButton({ activePhase, onPhaseChange, lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const idx = ORDER.indexOf(activePhase)
  if (idx <= 0 || activePhase === 'whatsNext') return null
  const prev = ORDER[idx - 1]
  const label = t.back
  return (
    <button
      onClick={() => onPhaseChange(prev)}
      aria-label={label}
      className="flex items-center gap-1 text-[12px] font-semibold bg-transparent border-none cursor-pointer mb-1 min-h-[36px]"
      style={{ color: darkMode ? '#7A90A8' : '#8A6A60' }}
    >
      <LuArrowLeft size={14} aria-hidden="true" /> {label}
    </button>
  )
}
