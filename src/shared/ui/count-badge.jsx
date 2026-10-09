// Pastille compteur unifiée (#6 cohérence UI). Remplace les pastilles
// numériques dupliquées (compteur Admin en attente, panier). Masquée si
// count <= 0, plafonnée à `max`+ au-delà (ex. « 99+ »).
//
// Usage :
//   <CountBadge count={pendingCount} />
//   <CountBadge count={basketCount} max={9} aria-label="3 articles" />
//
// `aria-label` : la phrase lue À LA PLACE du chiffre. Posé sur le <span> (sans
// rôle), il était ignoré des lecteurs d'écran (lot 9e) : il devient un texte
// `sr-only`, et le chiffre seul est caché d'eux.
//
// `style` permet un override ponctuel (positionnement absolu, etc.) sans
// dupliquer le socle visuel (dégradé de marque + dimensions de la pastille).
export default function CountBadge({ count = 0, max = 99, 'aria-label': ariaLabel, style }) {
  if (!count || count <= 0) return null
  const text = count > max ? `${max}+` : String(count)
  return (
    <span
      style={{
        background: 'var(--gradient-deep)',
        color: 'white',
        fontSize: '11px', fontWeight: 700,
        minWidth: '20px', height: '20px',
        borderRadius: '10px', padding: '0 5px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      {ariaLabel ? <><span aria-hidden="true">{text}</span><span className="sr-only">{ariaLabel}</span></> : text}
    </span>
  )
}
