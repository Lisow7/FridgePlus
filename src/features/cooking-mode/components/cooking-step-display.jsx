// src/features/cooking-mode/components/cooking-step-display.jsx
//
// Affiche l'étape courante en très gros (lisible à 1-2 m du plan de travail).
// `key={stepNumber}` re-monte le bloc à chaque changement d'étape, ce qui
// re-déclenche l'animation CSS fade-in + slide-up (pas de state/effet).

const I18N = {
  fr: { step: (n, total) => `Étape ${n} / ${total}` },
  en: { step: (n, total) => `Step ${n} / ${total}` },
}

export default function CookingStepDisplay({ stepText, stepNumber, totalSteps, lang = 'fr' }) {
  if (!stepText) return null

  const t = I18N[lang] ?? I18N.fr
  const stepLabel = t.step(stepNumber, totalSteps)

  return (
    <div
      key={stepNumber}
      style={{
        textAlign: 'center',
        padding: '24px',
        maxWidth: '90vw',
        animation: 'cooking-step-enter 0.4s ease-out',
      }}
    >
      <div
        style={{
          fontSize: '14px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--color-muted)',
          marginBottom: '24px',
          fontWeight: 700,
        }}
      >
        {stepLabel}
      </div>
      <p
        style={{
          fontSize: 'clamp(28px, 5vw, 64px)',
          lineHeight: 1.3,
          fontWeight: 600,
          color: 'var(--color-charcoal)',
          margin: 0,
        }}
      >
        {stepText}
      </p>
    </div>
  )
}
