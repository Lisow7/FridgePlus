import { PREMIUM_ENABLED } from '@shared/lib/premium-config'

// Pastille de tier d'accès. Sobre, sans émoji (décision UX 2026-06-15).
const I18N = {
  fr: { free: 'Gratuit', account: 'Compte', soon: 'Prochainement', premium: 'Premium' },
  en: { free: 'Free',    account: 'Account', soon: 'Coming soon',   premium: 'Premium' },
}
const COLORS = {
  free:    { bg: 'rgba(30,132,73,0.12)',  fg: '#1E8449' },
  account: { bg: 'rgba(43,108,176,0.12)', fg: '#2B6CB0' },
  soon:    { bg: 'rgba(212,106,16,0.14)', fg: '#C05A10' },
  premium: { bg: 'rgba(202,138,4,0.16)',  fg: '#A16207' },
}

export default function TierBadge({ tier, lang = 'fr' }) {
  const t = I18N[lang] ?? I18N.fr
  // En mode premium actif, 'soon' devient 'premium'.
  const key = tier === 'soon' && PREMIUM_ENABLED ? 'premium' : tier
  const c = COLORS[key]
  if (!c) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
      background: c.bg, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.04em',
      lineHeight: 1.3, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {t[key]}
    </span>
  )
}
