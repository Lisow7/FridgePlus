const I18N = {
  fr: { label: 'Total estimé', sources: 'Sources', noPrice: 'Prix indicatifs non disponibles' },
  en: { label: 'Estimated total', sources: 'Sources', noPrice: 'Indicative prices unavailable' },
}

export default function CartBudgetBar({ total = 0, lang = 'fr', darkMode = false, onShowSources }) {
  const t = I18N[lang] ?? I18N.fr
  const hasPrice = total > 0
  const muted = darkMode ? '#7A90A8' : '#8A6A60'

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-3 border"
      style={{
        background: darkMode ? '#131E2C' : '#fff',
        borderColor: darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)',
      }}
    >
      <span className="text-xs font-semibold" style={{ color: muted }}>
        {t.label}
      </span>
      <div className="flex items-center gap-2">
        {hasPrice ? (
          <>
            <span className="text-lg font-black" style={{ color: '#D46A10' }}>
              ~{total.toFixed(2).replace('.', ',')} €
            </span>
            {onShowSources && (
              <button
                onClick={onShowSources}
                className="text-[10px] underline cursor-pointer bg-transparent border-none p-0"
                style={{ color: muted }}
              >
                {t.sources}
              </button>
            )}
          </>
        ) : (
          <span className="text-[11px] italic" style={{ color: muted }}>
            {t.noPrice}
          </span>
        )}
      </div>
    </div>
  )
}
