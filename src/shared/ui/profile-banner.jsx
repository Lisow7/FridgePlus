import { getBanner } from '@shared/lib/banners'

// Rendu d'une bannière de profil. Partagé (profil + communauté). Sert de bande
// seule OU de FOND d'en-tête (children superposés + scrim).
//
// kind 'quest' : dégradé signature + emoji « héros » (à droite, lueur) + reflet
// diagonal → chaque récompense de quête a un look unique et incarne sa quête.
//
// height : number (px) ou string ('100%'). Taille du héros basée sur h (90 si
// height non-numérique).
export default function ProfileBanner({ bannerId, height = 96, radius = 14, scrim = false, children, style }) {
  const b = getBanner(bannerId)
  const h = typeof height === 'number' ? height : 90

  const base = {
    position: 'relative',
    height,
    borderRadius: radius,
    overflow: 'hidden',
    background: b.value,
    ...style,
  }

  const isColor = b.kind === 'color'
  const isQuest = b.kind === 'quest'

  return (
    <div style={{
      ...base,
      ...(isColor ? {
        backgroundImage: 'radial-gradient(circle at 14px 14px, rgba(255,255,255,0.07) 2px, transparent 0)',
        backgroundSize: '26px 26px',
      } : null),
    }}>
      {isQuest && (
        <>
          {/* Lueur derrière le héros */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: '50%', right: `${Math.round(h * 0.16)}px`,
            transform: 'translateY(-50%)',
            width: h, height: h, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 70%)',
          }} />
          {/* Emoji héros */}
          <span aria-hidden="true" style={{
            position: 'absolute', top: '50%', right: `${Math.round(h * 0.14)}px`,
            transform: 'translateY(-50%) rotate(-8deg)',
            fontSize: Math.round(h * 0.66), lineHeight: 1,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
          }}>
            {b.hero}
          </span>
          {/* Reflet diagonal */}
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 38%)',
          }} />
        </>
      )}
      {scrim && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.50) 100%)',
        }} />
      )}
      {children}
    </div>
  )
}
