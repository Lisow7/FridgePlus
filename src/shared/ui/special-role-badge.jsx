import { LuFlaskConical, LuHeadphones, LuStar, LuHandshake } from 'react-icons/lu'

const ROLE_CONFIG = {
  tester: {
    Icon: LuFlaskConical,
    label: { fr: 'Bêta-testeur', en: 'Beta tester' },
    color: '#374151',
    bg: 'rgba(107,114,128,0.22)',
  },
  support: {
    Icon: LuHeadphones,
    label: { fr: 'Équipe support', en: 'Support team' },
    color: '#1D4ED8',
    bg: 'rgba(59,130,246,0.20)',
  },
  influencer: {
    Icon: LuStar,
    label: { fr: 'Créateur partenaire', en: 'Partner creator' },
    color: '#5B21B6',
    bg: 'rgba(139,92,246,0.20)',
  },
  partner: {
    Icon: LuHandshake,
    label: { fr: 'Partenaire Fridge+', en: 'Fridge+ Partner' },
    color: '#9A3412',
    bg: 'rgba(212,106,16,0.22)',
  },
}

export default function SpecialRoleBadge({ role, lang = 'fr' }) {
  if (!role || !ROLE_CONFIG[role]) return null
  const { Icon, label: labels, color, bg } = ROLE_CONFIG[role]
  const label = labels[lang] ?? labels.fr
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '8px',
        background: bg,
        color,
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}
    >
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  )
}
