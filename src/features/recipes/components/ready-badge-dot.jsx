// Point pulsé de découvrabilité sur la carte "Prêt" — cf. spec
// la conception « recipes-ready-badge-discoverability » du 2026-07-19.
// Purement décoratif (aria-hidden) : le compteur `card.count` reste
// l'information accessible, ce point n'est qu'un signal visuel d'appoint.
export function ReadyBadgeDot({ show }) {
  if (!show) return null
  return (
    <span
      data-testid="ready-badge-dot"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '-2px',
        right: '-2px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#4CAF7D',
        boxShadow: '0 0 0 2px var(--card-bg, #fff)',
        animation: 'fridge-version-pulse 1.8s ease-in-out infinite',
      }}
    />
  )
}
