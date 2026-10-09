import { LuShoppingCart, LuStore, LuHouse, LuSparkles } from 'react-icons/lu'

const PHASES = [
  { id: 'prepare',   Icon: LuShoppingCart, fr: 'Préparer',   en: 'Prepare' },
  { id: 'shopping',  Icon: LuStore,        fr: 'En courses',  en: 'Shopping' },
  { id: 'home',      Icon: LuHouse,        fr: 'Rentré',      en: 'Home' },
  { id: 'whatsNext', Icon: LuSparkles,     fr: 'Et après ?',  en: "What's next?" },
]

const I18N = {
  fr: { ariaLabel: 'Étapes du panier' },
  en: { ariaLabel: 'Cart steps' },
}

export default function CartStepper({
  activePhase,
  donePhases = new Set(),
  onPhaseChange,
  basketEmpty = false,
  whatsNextAvailable = false,
  lang = 'fr',
  darkMode = false,
}) {
  const labelKey = lang === 'fr' ? 'fr' : 'en'
  const t = I18N[lang] ?? I18N.fr

  return (
    <div
      className="fixed top-[85px] lg:top-[93px] left-0 right-0 z-40 flex justify-center px-4 py-2.5 border-b"
      style={{
        background: darkMode ? '#0F1923' : '#EDE0D0',
        borderColor: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)',
      }}
      role="tablist"
      aria-label={t.ariaLabel}
    >
      <div className="flex gap-1.5" style={{ width: '100%', maxWidth: 480 }}>
        {PHASES.map(phase => {
          const isActive = activePhase === phase.id
          const isDone = donePhases.has(phase.id)
          // « Et après ? » accessible uniquement après les courses (snapshot dispo).
          // En courses / Rentré inaccessibles si le panier est vide.
          const isDisabled = phase.id === 'whatsNext'
            ? !whatsNextAvailable
            : (basketEmpty && phase.id !== 'prepare')
          const Icon = phase.Icon

          return (
            <button
              key={phase.id}
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              onClick={() => !isDisabled && onPhaseChange(phase.id)}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-[10px] px-3 py-1.5 border-none transition-all min-h-[44px]"
              style={{
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.35 : 1,
                background: isActive && !isDone
                  ? (darkMode ? '#E07820' : '#D46A10')
                  : isDone
                    ? (darkMode ? 'rgba(22,163,74,0.22)' : 'rgba(22,163,74,0.15)')
                    : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
              }}
            >
              {isDone && (
                <span className="absolute top-1 right-1 text-[9px]" aria-hidden="true">✓</span>
              )}
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              <span
                className="text-[11px] font-bold leading-none whitespace-nowrap"
                style={{
                  color: isActive && !isDone
                    ? 'white'
                    : isDone
                      ? (darkMode ? '#4ADE80' : '#15803D')
                      : (darkMode ? '#7A90A8' : '#6A4F45'),
                }}
              >
                {phase[labelKey]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
