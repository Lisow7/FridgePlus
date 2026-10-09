export const AVATAR_CATALOG = [
  { id: 'tomato',     code: '1f345', bg: '#FFE4E4' },
  { id: 'avocado',    code: '1f951', bg: '#DFF5E3' },
  { id: 'carrot',     code: '1f955', bg: '#FFF0DC' },
  { id: 'croissant',  code: '1f950', bg: '#FFF8E1' },
  { id: 'sushi',      code: '1f363', bg: '#E3F2FD' },
  { id: 'taco',       code: '1f32e', bg: '#FBE9E7' },
  { id: 'pizza',      code: '1f355', bg: '#FCE4EC' },
  { id: 'ramen',      code: '1f35c', bg: '#EDE7F6' },
  { id: 'strawberry', code: '1f353', bg: '#FFEBEE' },
  { id: 'burger',     code: '1f354', bg: '#F3E5F5' },
]

// Hébergées par le site, comme les autres emoji (décision du 2026-10-06).
const TWEMOJI = `${import.meta.env.BASE_URL}emoji/twemoji`

export function getAvatarData(avatarId) {
  return AVATAR_CATALOG.find(a => a.id === avatarId) ?? AVATAR_CATALOG[0]
}

export function getAvatarUrl(avatarId) {
  const { code } = getAvatarData(avatarId)
  return `${TWEMOJI}/${code}.svg`
}
