import { cn } from '@shared/lib/cn'

// ProfileSectionBadge — badge visuel pour les sections Profile.
// Sprint 11 — pattern UI commun de la refonte UX (cf. spec §3.3).
//
// 4 variants : premium (orange), sensitive (slate), rgpd (blue), danger (red).
// Texte des trois badges teintés par jeton de thème (index.css) : la teinte
// pleine tombait sous 4,5:1 en sombre (1,4 à 2,5), et en clair pour le bleu et
// le rouge — décision du 2026-10-06, « couleurs = profond ».
// Le texte visible du badge EST son nom : un `aria-label` identique, sur un
// `<span>` sans rôle, est interdit par ARIA (axe : `aria-prohibited-attr`,
// audit A11Y-19) — retiré.

const VARIANTS = {
  premium: {
    bg: 'var(--gradient-deep)',
    color: '#FFFFFF',
    labelFr: 'Premium',
    labelEn: 'Premium',
  },
  sensitive: {
    bg: 'rgba(100,116,139,0.12)',
    color: 'var(--badge-neutral-text)',
    labelFr: 'Sensible',
    labelEn: 'Sensitive',
  },
  rgpd: {
    bg: 'rgba(59,130,246,0.12)',
    color: 'var(--badge-info-text)',
    labelFr: 'RGPD',
    labelEn: 'GDPR',
  },
  danger: {
    bg: 'rgba(220,38,38,0.10)',
    color: 'var(--badge-danger-text)',
    labelFr: 'Action critique',
    labelEn: 'Critical action',
  },
}

export default function ProfileSectionBadge({ variant = 'sensitive', lang = 'fr', children }) {
  const v = VARIANTS[variant] ?? VARIANTS.sensitive
  const label = children ?? (lang === 'en' ? v.labelEn : v.labelFr)
  return (
    <span
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
