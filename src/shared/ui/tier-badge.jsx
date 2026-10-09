import { PREMIUM_ENABLED } from '@shared/lib/premium-config'

// Pastille de tier d'accès. Sobre, sans émoji (décision UX 2026-06-15).
const I18N = {
  fr: { free: 'Gratuit', account: 'Compte', soon: 'Prochainement', premium: 'Premium' },
  en: { free: 'Free',    account: 'Account', soon: 'Coming soon',   premium: 'Premium' },
}
// Texte par jeton de thème (index.css) : la teinte pleine plafonnait sous
// 4,5:1 sur son propre fond, en clair (3,6 à 4,4) comme en sombre (2,0 à 2,5)
// — décision du 2026-10-06, « couleurs = profond ».
const COLORS = {
  free:    { bg: 'rgba(30,132,73,0.12)',  fg: 'var(--badge-free-text)' },
  account: { bg: 'rgba(43,108,176,0.12)', fg: 'var(--badge-account-text)' },
  soon:    { bg: 'rgba(212,106,16,0.14)', fg: 'var(--color-warm-text)' },
  premium: { bg: 'rgba(202,138,4,0.16)',  fg: 'var(--badge-premium-text)' },
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
