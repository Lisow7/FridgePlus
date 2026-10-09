// src/features/cooking-mode/components/cooking-timer-widget.jsx
//
// Countdown visuel pour l'étape courante. Affiché uniquement si une durée
// a été détectée dans le texte de l'étape (timer != null).
// États visuels : idle (gris) / running (warm) / paused (muted) / done (success).

function formatTime(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

const STATE_STYLES = {
  idle:    { color: 'var(--color-muted)',   border: 'var(--color-border-warm)' },
  running: { color: 'var(--color-warm-600)', border: 'var(--color-warm-400)' },
  paused:  { color: 'var(--color-muted)',   border: 'var(--color-muted)' },
  done:    { color: 'var(--color-success)', border: 'var(--color-success)' },
}

const I18N = {
  fr: { done: 'Terminé !' },
  en: { done: 'Done!' },
}

export default function CookingTimerWidget({ timer, lang = 'fr' }) {
  if (!timer) return null

  const t = I18N[lang] ?? I18N.fr
  const palette = STATE_STYLES[timer.state] ?? STATE_STYLES.idle
  const isDone = timer.state === 'done'
  const display = isDone
    ? t.done
    : formatTime(timer.secondsLeft)

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '12px 20px',
        borderRadius: '16px',
        border: `2px solid ${palette.border}`,
        background: 'var(--color-surface)',
        minWidth: '120px',
      }}
      role="timer"
      aria-live="off"
    >
      {/* La fin se dit dans une région vive PERMANENTE : allumer `aria-live`
          dans le même rendu que « Terminé ! » ne l'annonçait jamais, et le
          compte à rebours, lui, doit rester muet (audit du 2026-10-04, A11Y-17). */}
      <span className="sr-only" role="status" aria-live="polite">{isDone ? t.done : ''}</span>
      {timer.label && (
        <span style={{ fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {timer.label}
        </span>
      )}
      <span
        style={{
          fontSize: 'clamp(28px, 6vw, 44px)',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: palette.color,
          lineHeight: 1,
          animation: timer.state === 'running' ? 'soft-blink 1s steps(2) infinite' : 'none',
        }}
      >
        {display}
      </span>
    </div>
  )
}
