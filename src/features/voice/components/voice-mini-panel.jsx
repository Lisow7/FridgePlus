import { createPortal } from 'react-dom'
import { LuMicOff } from 'react-icons/lu'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import Button from '@shared/ui/button'

// Sprint 7 PR S7.g — Alignement FR/EN.
const FLAGS = { fr: '🇫🇷', en: '🇬🇧' }

const I18N = {
  fr: { subtitle: 'Parle en français', stop: 'Arrêter', detected: n => `${n} détecté${n > 1 ? 's' : ''}` },
  en: { subtitle: 'Speak in English', stop: 'Stop', detected: n => `${n} detected` },
}

export default function VoiceMiniPanel({ lang = 'fr', transcript = '', matchedIngredients = [], onStop, darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const windowWidth = useWindowWidth()
  const isDesktop = windowWidth >= 1280

  const bg = darkMode ? '#131E2C' : '#FDFAF6'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const textMuted = darkMode ? '#7A90A8' : '#7A5F56'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        ...(isDesktop ? { top: '70px', right: '20px' } : { top: '70px', left: '16px', right: '16px' }),
        zIndex: 55,
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: '14px 16px',
        minWidth: '260px',
        maxWidth: isDesktop ? '360px' : 'none',
        animation: 'menu-slide-down 0.2s ease both',
      }}
    >
      {/* Row : drapeau + sous-titre + bouton stop */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: transcript || matchedIngredients.length > 0 ? '10px' : 0 }}>
        <span style={{ fontSize: '16px', flexShrink: 0, lineHeight: 1 }}>{FLAGS[lang]}</span>
        <span style={{ flex: 1, fontSize: '12px', color: textMuted, fontWeight: 500 }}>{t.subtitle}</span>
        <Button
          onClick={onStop}
          className="h-auto shrink-0 rounded-[7px] border-[1.5px] px-2.5 py-1 text-xs font-bold"
          style={{
            gap: '5px',
            borderColor: 'rgba(229,53,53,0.4)',
            background: 'rgba(229,53,53,0.08)',
            color: '#E53535',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(229,53,53,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(229,53,53,0.08)'}
        >
          <LuMicOff size={12} />
          {t.stop}
        </Button>
      </div>

      {/* Transcript interim OU points animés */}
      {transcript ? (
        <p style={{
          fontSize: '14px', color: textMuted, fontStyle: 'italic',
          marginBottom: matchedIngredients.length > 0 ? '10px' : 0,
          lineHeight: 1.45, opacity: 0.75,
        }}>
          {transcript}
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: matchedIngredients.length > 0 ? '10px' : 0 }}>
          {[0, 200, 400].map(delay => (
            <span key={delay} style={{
              width: '7px', height: '7px', borderRadius: '50%', background: '#E53535',
              display: 'inline-block',
              animation: `voice-dot-pulse 1.2s ease-in-out ${delay}ms infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Chips ingrédients matchés + compteur */}
      {matchedIngredients.length > 0 && (() => {
        const confirmed = matchedIngredients.filter(i => !i.ambiguous)
        return (
          <div>
            {confirmed.length > 0 && (
              <div style={{ marginBottom: '6px', fontSize: '11px', fontWeight: 600, color: textMuted, opacity: 0.7 }}>
                {t.detected(confirmed.length)}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {matchedIngredients.map((ing, idx) => {
                if (ing.ambiguous) {
                  return (
                    <span key={`ambig-${idx}`} style={{
                      padding: '4px 10px', borderRadius: '20px',
                      background: darkMode ? 'rgba(224,140,32,0.18)' : 'rgba(224,140,32,0.12)',
                      border: '1.5px solid rgba(224,140,32,0.55)',
                      color: darkMode ? '#E8A840' : '#B07020',
                      fontSize: '13px', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}>
                      {ing.word} ?
                    </span>
                  )
                }
                const label = ing.labels?.[lang] ?? ing.labels?.fr ?? ing.id
                const opacity = Math.max(0.4, ing.confidence ?? 1)
                return (
                  <span key={ing.id} style={{
                    padding: '4px 10px', borderRadius: '20px',
                    background: `rgba(50,180,120,${(opacity * 0.2).toFixed(2)})`,
                    border: `1.5px solid rgba(50,180,120,${(opacity * 0.6).toFixed(2)})`,
                    color: darkMode ? `rgba(80,220,150,${opacity.toFixed(2)})` : `rgba(28,130,72,${opacity.toFixed(2)})`,
                    fontSize: '13px', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                  }}>
                    {ing.emoji && <span style={{ fontSize: '14px', lineHeight: 1 }}>{ing.emoji}</span>}
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>,
    document.body
  )
}
