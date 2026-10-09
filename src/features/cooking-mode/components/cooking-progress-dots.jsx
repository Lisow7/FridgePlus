// src/features/cooking-mode/components/cooking-progress-dots.jsx
//
// Indicateur de progression ●●○○○ — un point par étape, rempli jusqu'à
// l'étape courante incluse. Au-delà de 12 étapes, bascule en texte "n / total"
// pour rester lisible.

export default function CookingProgressDots({ current, total }) {
  if (!total || total < 1) return null

  if (total > 12) {
    return (
      <div style={{ fontSize: '14px', color: 'var(--color-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {current} / {total}
      </div>
    )
  }

  return (
    <div role="img" style={{ display: 'flex', gap: '8px', alignItems: 'center' }} aria-label={`${current} / ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const filled = i < current
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: filled ? 'var(--color-warm-600)' : 'transparent',
              border: `2px solid ${filled ? 'var(--color-warm-600)' : 'var(--color-border-warm)'}`,
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
          />
        )
      })}
    </div>
  )
}
