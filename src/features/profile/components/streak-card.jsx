// Carte « série hebdo » (présentational pur). 🔥 + nb de semaines + record.
// Données calculées en amont via computeWeeklyStreak. État vide non anxiogène.

export default function StreakCard({ streak, t, darkMode, border, textColor, mutedColor }) {
  const { current = 0, best = 0 } = streak ?? {}
  const empty = current === 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '16px', borderRadius: '12px',
      border: `1px solid ${border}`,
      background: darkMode ? 'rgba(247,168,94,0.06)' : 'rgba(247,168,94,0.08)',
    }}>
      <span aria-hidden="true" style={{ fontSize: '32px', lineHeight: 1 }}>🔥</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: mutedColor,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {t.streakTitle}
        </span>
        {empty ? (
          <span style={{ fontSize: '14px', color: textColor }}>{t.streakEmpty}</span>
        ) : (
          <>
            <span style={{ fontSize: '20px', fontWeight: 800, color: textColor }}>
              {t.streakWeeks(current)}
            </span>
            {best > current && (
              <span style={{ fontSize: '12px', color: mutedColor }}>{t.streakBest(best)}</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
