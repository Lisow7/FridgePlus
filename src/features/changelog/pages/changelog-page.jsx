import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LuArrowLeft } from 'react-icons/lu'
import { CHANGELOG } from '@features/changelog/data/changelog'
import { pickReleaseName, localizeReleaseDate } from '@features/changelog/data/changelog-i18n'
import { CURRENT_VERSION } from '@shared/lib/version'
import { useNewRelease } from '@features/changelog/hooks/use-new-release'
import ChangelogTagline from '@features/changelog/components/changelog-tagline'
import ScrollToTopButton from '@shared/ui/scroll-to-top-button'
import { useDocumentTitle } from '@shared/hooks/use-document-title'

const I18N = {
  fr: {
    back: 'Retour',
    title: 'Nouveautés',
    current: 'Version actuelle',
    feat: 'Nouveauté',
    fix: 'Correction',
    pageTitle: 'Nouveautés — Fridge+',
  },
  en: {
    back: 'Back',
    title: "What’s new",
    current: 'Current version',
    feat: 'New',
    fix: 'Fix',
    pageTitle: "What’s new — Fridge+",
  },
}

// Une couleur PAR THÈME, et pas une seule pour les deux.
//
// 🔴 Ces badges portaient `#10b981` et `#3b82f6` quel que soit le thème. Leur
// fond étant semi-transparent, il se compose avec la page : clair (#e2f7f0,
// #ebf3fe) ou sombre (#132a25, #172840). Une même couleur de texte y donnait
// 2,27 et 3,29:1 en thème clair — pour un seuil WCAG AA de 4,5.
//
// ⚠️ Aucune valeur unique ne pouvait convenir : sur fond clair il faut assombrir,
// sur fond sombre il faut éclaircir. Même impasse que les boutons du bandeau de
// consentement, et même issue — la couleur suit le thème.
//
// Teinte et saturation conservées, seule la luminosité bouge, du minimum
// nécessaire. Mesuré : feat 4,54 (clair) / 5,97 (sombre) · fix 4,53 / 4,52.
const TYPE_COLORS = {
  feat: { bg: 'rgba(16,185,129,0.12)', clair: '#0B7E58', sombre: '#10B981' },
  fix:  { bg: 'rgba(59,130,246,0.10)', clair: '#0D64F4', sombre: '#4B8CF7' },
}

export default function ChangelogPage({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const { markSeen } = useNewRelease()

  // Marquer la version comme vue dès l'ouverture de la page
  useEffect(() => { markSeen() }, [markSeen])

  // Override titre pendant la visite de la page changelog.
  // Le mécanisme vit dans `@shared/hooks/use-document-title` depuis que `/faq`
  // et `/guide` en ont le même besoin — trois copies auraient divergé.
  useDocumentTitle(t.pageTitle)

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  // Opacité claire portée de 0,60 à 0,64 le 2026-08-23 : à 0,60, le composite
  // sur blanc donnait 4,45:1 — sous le seuil de 4,5 d'un cheveu, mais sur 8
  // nœuds (dates et numéros de version de chaque entrée). À 0,64 : 5,06:1.
  // L'écart visuel est de 8 niveaux sur 255. La branche sombre est déjà
  // conforme et n'est pas touchée.
  const muted  = darkMode ? 'rgba(240,232,220,0.65)' : 'rgba(44,26,14,0.64)'
  const cardBg = darkMode ? '#131E2C' : '#FFFFFF'
  const cardBorder = darkMode ? 'rgba(247,168,94,0.18)' : 'rgba(212,106,16,0.14)'
  const cardShadow = darkMode
    ? 'none'
    : '0 2px 12px rgba(212,106,16,0.08), 0 1px 3px rgba(44,26,14,0.04)'

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 16px 80px', color: fg }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '13px', fontWeight: 600,
          color: 'var(--link-accent)',
          textDecoration: 'none', marginBottom: '24px',
        }}
      >
        <LuArrowLeft size={15} aria-hidden="true" />
        <span>{t.back}</span>
      </Link>

      <header style={{ marginBottom: '28px' }}>
        <h1 style={{
          fontSize: '28px', fontWeight: 800, margin: '0 0 6px',
          background: 'var(--gradient-warm)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}>
          {t.title}
        </h1>
        <ChangelogTagline lang={lang} darkMode={darkMode} />
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {CHANGELOG.map((entry) => {
          const isCurrent = entry.version === CURRENT_VERSION
          return (
            <article
              key={entry.version}
              style={{
                padding: '20px 22px',
                borderRadius: '12px',
                background: cardBg,
                border: isCurrent
                  ? '1.5px solid rgba(212,106,16,0.45)'
                  : `1px solid ${cardBorder}`,
                boxShadow: isCurrent
                  ? '0 4px 20px rgba(212,106,16,0.18), 0 1px 3px rgba(44,26,14,0.06)'
                  : cardShadow,
              }}
            >
              {/* En-tête release */}
              <div style={{
                display: 'flex', alignItems: 'baseline',
                justifyContent: 'space-between', gap: '12px',
                flexWrap: 'wrap', marginBottom: '14px',
              }}>
                <h2 style={{
                  fontSize: '16px', fontWeight: 700, color: fg, margin: 0,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {pickReleaseName(entry, lang)}
                  <span style={{ fontSize: '11px', fontWeight: 500, color: muted }}>
                    · v{entry.version}
                  </span>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: '10px', fontWeight: 800,
                        padding: '2px 8px', borderRadius: '999px',
                        background: 'var(--gradient-warm)',
                        color: '#2C1A0E', textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {t.current}
                    </span>
                  )}
                </h2>
                <span style={{ fontSize: '12px', color: muted }}>{localizeReleaseDate(entry.date, lang)}</span>
              </div>

              {/* Liste des changements */}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {entry.changes.map((change, i) => {
                  const colors = TYPE_COLORS[change.type] ?? TYPE_COLORS.feat
                  const typeLabel = t[change.type] ?? change.type
                  const label = typeof change.label === 'string'
                    ? change.label
                    : (change.label?.[lang] ?? change.label?.fr ?? '')
                  return (
                    <li key={i} style={{ display: 'flex', gap: '12px' }}>
                      <span
                        style={{
                          flexShrink: 0, fontSize: '10px', fontWeight: 700,
                          padding: '3px 8px', borderRadius: '6px',
                          background: colors.bg,
                          color: darkMode ? colors.sombre : colors.clair,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          height: 'fit-content', marginTop: '2px',
                        }}
                      >
                        {typeLabel}
                      </span>
                      <span style={{ fontSize: '13.5px', color: fg, lineHeight: 1.7, opacity: 0.9 }}>
                        {label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        })}
      </div>

      <ScrollToTopButton lang={lang} />
    </div>
  )
}
