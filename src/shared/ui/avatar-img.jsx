import { getAvatarData, getAvatarUrl } from '@shared/lib/avatars'

// Décoratif par défaut (audit A11Y-19) : l'avatar accompagne toujours un nom
// ou un bouton déjà nommé. `alt` valait l'identifiant (« chef-1 », lu tel
// quel) et disparaissait sans avatar choisi — axe le relevait sur CHAQUE écran.
// Passer `alt` quand l'avatar est seul à dire qui c'est.
export default function AvatarImg({ avatarId, size = 80, style = {}, alt = '' }) {
  const avatar = getAvatarData(avatarId)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatar.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
      ...style,
    }}>
      <img
        src={getAvatarUrl(avatarId)}
        alt={alt}
        style={{ width: '62%', height: '62%', display: 'block' }}
        loading="lazy"
      />
    </div>
  )
}
