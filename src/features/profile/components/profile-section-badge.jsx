import { cn } from '@shared/lib/cn'

// ProfileSectionBadge — badge visuel pour les sections Profile.
// Sprint 11 — pattern UI commun de la refonte UX (cf. spec §3.3).
//
// 4 variants : premium (orange), sensitive (slate), rgpd (blue), danger (red).
// aria-label sur le badge pour les lecteurs d'écran.

const VARIANTS = {
  premium: {
    bg: 'var(--gradient-warm)',
    color: '#FFFFFF',
    labelFr: 'Premium',
    labelEn: 'Premium',
  },
  sensitive: {
    bg: 'rgba(100,116,139,0.12)',
    color: '#475569',
    labelFr: 'Sensible',
    labelEn: 'Sensitive',
  },
  rgpd: {
    bg: 'rgba(59,130,246,0.12)',
    color: '#2563EB',
    labelFr: 'RGPD',
    labelEn: 'GDPR',
  },
  danger: {
    bg: 'rgba(220,38,38,0.10)',
    color: '#DC2626',
    labelFr: 'Action critique',
    labelEn: 'Critical action',
  },
}

export default function ProfileSectionBadge({ variant = 'sensitive', lang = 'fr', children }) {
  const v = VARIANTS[variant] ?? VARIANTS.sensitive
  const label = children ?? (lang === 'en' ? v.labelEn : v.labelFr)
  return (
    <span
      aria-label={label}
      className={cn(
        // Carré arrondi (jamais pill) — convention site Fridge+ (cf. mémoire
        // project_button_system_refactor).
        'inline-flex items-center px-2 py-0.5 rounded-md',
        'text-[10px] font-bold uppercase tracking-wide',
      )}
      style={{ background: v.bg, color: v.color }}
    >
      {label}
    </span>
  )
}
