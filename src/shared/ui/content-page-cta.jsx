import { Link } from 'react-router-dom'
import { LuArrowRight } from 'react-icons/lu'
import { getContentCta } from '@shared/lib/i18n/content-cta-i18n'

// Bloc de fin des pages de contenu public : `/faq` et `/guide`.
//
// ── Pourquoi dans `shared/ui` et pas dans l'une des deux pages ────────────
// Les deux pages vivent dans des features différentes (`legal` et
// `onboarding`), et `import/no-restricted-paths` interdit — à raison — qu'une
// feature importe un composant de l'autre. Le dupliquer aurait produit deux
// blocs destinés à diverger ; c'est celui qu'on ne relit plus qui se
// tromperait.
//
// ── Le lien croisé n'est pas décoratif ────────────────────────────────────
// `secondaryTo` sert le maillage interne : une page de contenu qui ne renvoie
// vers rien est un cul-de-sac, pour un lecteur comme pour un moteur. Le
// libellé décrit la page d'arrivée — c'est lui qui dit de quoi elle parle.

export default function ContentPageCta({ lang = 'fr', darkMode = false, secondaryTo, secondaryLabel }) {
  const t = getContentCta(lang)

  const muted = darkMode ? 'rgba(232,237,242,0.68)' : 'rgba(45,45,45,0.66)'
  const cardBg = darkMode ? '#1A2535' : '#FFFFFF'
  const cardBorder = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(224,120,32,0.16)'

  return (
    <section
      aria-labelledby="cta-fin-de-page"
      style={{
        marginTop: 34,
        padding: '22px 20px',
        borderRadius: 16,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        textAlign: 'center',
      }}
    >
      <h2
        id="cta-fin-de-page"
        style={{ fontSize: 18, fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.01em' }}
      >
        {t.title}
      </h2>

      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 22px', borderRadius: 12,
          background: 'var(--color-warm-600)', color: '#FFFFFF',
          fontSize: 15, fontWeight: 800, textDecoration: 'none',
        }}
      >
        {t.action}
        <LuArrowRight size={17} aria-hidden="true" />
      </Link>

      {/* Les deux objections les plus probables, levées avant d'être posées. */}
      <p style={{ margin: '10px 0 0', fontSize: 13, color: muted }}>{t.note}</p>

      {secondaryTo && (
        <p style={{ margin: '14px 0 0', fontSize: 13.5 }}>
          <Link
            to={secondaryTo}
            style={{ color: 'var(--color-warm-600)', fontWeight: 700, textDecoration: 'none' }}
          >
            {secondaryLabel} →
          </Link>
        </p>
      )}
    </section>
  )
}
