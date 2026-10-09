// Primitive `EmptyState` — Sprint 9 S9.b.3.
//
// Atomic component pour les états vides ("Aucun résultat", "Pas de tickets",
// "Tout est OK 🎉"). Unifie ~12 implémentations dispersées dans le code.
//
// 3 variantes selon `variant` :
//   - 'inline'  (défaut) : <p> centré italique simple, padding modéré
//   - 'block'           : <div> centré avec emoji + titre + description
//   - 'card'            : variante block enveloppée dans une card avec
//                         bordure (pour les sections de liste)
//
// API :
//   <EmptyState>Aucun ticket pour « tomate ».</EmptyState>
//   <EmptyState variant="block" icon="🎉" title="Tout est OK !" />
//   <EmptyState variant="card" icon="📭" title="Aucun message"
//               description="Les nouveaux messages apparaîtront ici." />

const NEUTRAL_MUTED  = 'var(--color-muted, #7A6A52)'
const NEUTRAL_BORDER = 'var(--color-border-soft, #EDE4D4)'
const NEUTRAL_CARD   = 'var(--color-card-bg, #FFFFFF)'

export default function EmptyState({
  variant = 'inline',
  icon,
  title,
  description,
  children,
  muted = NEUTRAL_MUTED,
  border = NEUTRAL_BORDER,
  cardBg = NEUTRAL_CARD,
  className = '',
  style = {},
}) {
  // Variante 'inline' — simple <p> centré italique
  if (variant === 'inline') {
    return (
      <p
        className={className}
        style={{
          textAlign: 'center',
          padding: '32px 0',
          color: muted,
          fontSize: 13,
          fontStyle: 'italic',
          margin: 0,
          ...style,
        }}
      >
        {children ?? title}
      </p>
    )
  }

  // Variante 'block' ou 'card'
  const inner = (
    <>
      {icon && (
        <div style={{ fontSize: 32, marginBottom: 8, lineHeight: 1 }}>{icon}</div>
      )}
      {(title || children) && (
        <div style={{ color: muted, fontSize: 13 }}>{children ?? title}</div>
      )}
      {description && (
        <div style={{ color: muted, fontSize: 12, marginTop: 6, opacity: 0.8 }}>
          {description}
        </div>
      )}
    </>
  )

  if (variant === 'card') {
    return (
      <div
        className={className}
        style={{
          padding: '32px 16px',
          borderRadius: 12,
          background: cardBg,
          border: `1px solid ${border}`,
          textAlign: 'center',
          ...style,
        }}
      >
        {inner}
      </div>
    )
  }

  // variant === 'block'
  return (
    <div className={className} style={{ padding: '36px 16px', textAlign: 'center', ...style }}>
      {inner}
    </div>
  )
}
