import { LuTrash2 } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { getDaysLeft, isLeftoverExpired } from '@features/fridge/api/leftovers'

// Phase 8 launch (refonte Modales) PR 8.8.b. Extraction depuis
// LeftoversModal : carte d'un reste avec badge DLC traffic-light + bouton
// supprimer. Inclut le helper `getDlcTone` (couleur du badge selon jours
// restants) et le sous-composant `<CountdownBadge>` qui n'avait pas
// d'utilisation hors LeftoverCard.

// Tons traffic-light pour la DLC (semantics jour calendaire) :
// daysLeft  < 0 → rouge plein (expiré, DLC dépassée)
// daysLeft == 0 → rouge clair (dernier jour, expire aujourd'hui)
// daysLeft == 1 → orange     (expire demain)
// daysLeft >= 2 → vert       (OK)
export function getDlcTone(daysLeft, darkMode) {
  if (daysLeft < 0)   return { bg: 'var(--color-danger)',                       color: '#FFFFFF' }
  if (daysLeft === 0) return { bg: darkMode ? '#3A0F12' : '#FEE2E2', color: 'var(--color-danger)' }
  if (daysLeft === 1) return { bg: darkMode ? '#3D2000' : '#FEF3C7', color: 'var(--color-warning)' }
  return                     { bg: darkMode ? '#1A2E1A' : '#DCFCE7', color: '#15803D' }
}

function CountdownBadge({ expiresAt, t, darkMode }) {
  const daysLeft = getDaysLeft(expiresAt)
  const tone = getDlcTone(daysLeft, darkMode)
  const text = daysLeft <  0  ? `⚠️ ${t.expiredSince(-daysLeft)}`
             : daysLeft === 0 ? `⚠️ ${t.daysLeftToday}`
                              : t.daysLeft(daysLeft)
  return (
    <span style={{
      fontSize: '13px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
      background: tone.bg, color: tone.color,
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

export default function LeftoverCard({ leftover, onDelete, t, lang, darkMode, INGREDIENTS }) {
  const isExpired = isLeftoverExpired(leftover.expires_at)
  const linkedLabel = leftover.ingredient_id
    ? (() => {
        for (const arr of Object.values(INGREDIENTS)) {
          const found = arr.find(i => i.id === leftover.ingredient_id)
          if (found) return found.labels?.[lang] ?? found.labels?.fr ?? leftover.ingredient_id
        }
        return null
      })()
    : null

  const bg = isExpired
    ? (darkMode ? 'rgba(185,28,28,0.18)' : '#FEF2F2')
    : (darkMode ? '#1A2535' : '#FDFAF6')
  const border = isExpired
    ? (darkMode ? '#B91C1C44' : '#FECACA')
    : (darkMode ? '#2A3A4D' : 'var(--color-border-warm)')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 12px', borderRadius: '12px',
      background: bg, border: `1px solid ${border}`,
      marginBottom: '6px',
    }}>
      <span style={{ fontSize: '24px', lineHeight: 1 }}>{leftover.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: '14px',
          color: 'var(--color-charcoal)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {leftover.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
          <CountdownBadge expiresAt={leftover.expires_at} t={t} darkMode={darkMode} />
          {linkedLabel && (
            <span style={{
              fontSize: '11px', padding: '2px 6px', borderRadius: '6px',
              background: darkMode ? '#243650' : '#EEF2FF', color: darkMode ? '#8AACCA' : '#4F46E5',
              fontWeight: 500,
            }}>
              🔗 {linkedLabel}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(leftover.id)}
        title={t.confirmConsumed}
        aria-label={t.confirmConsumed}
        className="h-auto w-auto rounded-lg p-1.5 hover:bg-transparent hover:text-[#EF4444]"
        style={{ color: darkMode ? '#7A90A8' : '#9CA3AF' }}
      >
        <LuTrash2 size={16} />
      </Button>
    </div>
  )
}
