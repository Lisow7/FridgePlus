import { getAvatarData, getAvatarUrl } from '@shared/lib/avatars'

export default function AvatarImg({ avatarId, size = 80, style = {} }) {
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
        alt={avatarId}
        style={{ width: '62%', height: '62%', display: 'block' }}
        loading="lazy"
      />
    </div>
  )
}
