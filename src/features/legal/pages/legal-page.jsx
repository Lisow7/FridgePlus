import { Link } from 'react-router-dom'
import { LuArrowLeft, LuTriangleAlert, LuShield, LuFileText, LuLock, LuMessageCircleQuestion, LuInfo, LuLanguages, LuCreditCard, LuDownload } from 'react-icons/lu'
import { Section } from '@features/legal/components/legal-content-blocks'
import ScrollToTopButton from '@shared/ui/scroll-to-top-button'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { getLegalSection, getTranslationFallbackNote } from '@features/legal/data/legal-content'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'
// eslint-disable-next-line import/no-restricted-paths -- page composant réutilise le CTA PWA testé (DRY), cf. déplacement du footer (2026-07-10)
import { InstallButton, usePwaInstallable } from '@features/pwa'

// Page Mentions légales / CGU / Confidentialité / FAQ.
//
// Le contenu juridique vit dans `src/data/legalContent.js` (séparation
// data / rendu). Cette page se contente de :
//   1. Afficher l'en-tête + sommaire + disclaimer pré-launch
//   2. Itérer sur les 4 sections (legal, terms, privacy, faq)
//   3. Pour chaque section, rendre les blocs typés via renderBlock()
//
// Types de blocs supportés (cf. legalContent.js) :
//   - p / list / h3 / citation / note
//
// A11y :
//   - role="article" sur la page
//   - sections avec id pour les ancres du sommaire
//   - scroll-margin-top compense la hauteur du Header sticky
//   - chaque bloc citation a son <cite> sémantique
//
// Visuel :
//   - Cards blanches (light) / sombres (dark) avec ombre orange tintée
//   - Le bandeau pré-launch pose le contexte (rédaction de référence,
//     validation juriste à venir)

const I18N = {
  fr: {
    title: 'Mentions légales & informations',
    subtitle: 'Tout ce qu’il faut savoir sur Fridge+, vos données et vos droits.',
    backHome: 'Retour à l’accueil',
    summaryTitle: 'Sommaire',
    sections: {
      legal:   { title: 'Mentions légales',                    desc: 'Éditeur, hébergeur, contact' },
      terms:   { title: 'Conditions Générales d’Utilisation', desc: 'Règles d’usage du service' },
      cgv:     { title: 'Conditions Générales de Vente',       desc: 'Abonnement premium — tarifs, rétractation, remboursement' },
      privacy: { title: 'Politique de confidentialité',        desc: 'Vos données et vos droits' },
      faq:     { title: 'Questions fréquentes',                desc: 'Aide rapide pour démarrer' },
    },
    installTitle: 'Installer l’app',
    installBody: 'Ajoute Fridge+ à ton écran d’accueil pour un accès plus rapide, en plein écran.',
    disclaimerTitle: 'Note importante (avant launch public)',
    disclaimerBody: "Les contenus juridiques de cette page constituent une rédaction de référence basée sur les modèles publics et les obligations légales identifiées (RGPD, LCEN, DSA, CNIL). Avant le lancement public officiel de Fridge+ et la formalisation du statut auto-entrepreneur de l’éditeur, ces textes seront relus par un professionnel du droit pour garantir leur pleine conformité. En attendant, ils servent de base transparente : si tu repères une erreur ou une imprécision, contacte-nous via le support — on corrige.",
    citationLabel: 'Référence légale',
    premiumNoticeTitle: 'Lancement gratuit',
    premiumNoticeBody: 'Fridge+ est actuellement en lancement gratuit. Les fonctionnalités premium, le paiement (Stripe) et la facturation ne sont pas encore actifs : les clauses correspondantes (abonnement, droit de rétractation, Conditions Générales de Vente) ne s’appliqueront qu’à l’activation du premium.',
  },
  en: {
    title: 'Legal & information',
    subtitle: 'Everything you need to know about Fridge+, your data and your rights.',
    backHome: 'Back to home',
    summaryTitle: 'Table of contents',
    sections: {
      legal:   { title: 'Legal notice',         desc: 'Publisher, hoster, contact' },
      terms:   { title: 'Terms of Service',     desc: 'Service usage rules' },
      cgv:     { title: 'Terms of Sale',        desc: 'Premium subscription — pricing, withdrawal, refunds' },
      privacy: { title: 'Privacy policy',       desc: 'Your data and your rights' },
      faq:     { title: 'Frequently asked questions', desc: 'Quick help to get started' },
    },
    installTitle: 'Install the app',
    installBody: 'Add Fridge+ to your home screen for faster, full-screen access.',
    disclaimerTitle: 'Important note (before public launch)',
    disclaimerBody: 'The legal content on this page is a reference draft based on public templates and identified legal obligations (GDPR, French LCEN, DSA, CNIL). Before Fridge+\'s official public launch and the formalization of the publisher’s auto-entrepreneur status, these texts will be reviewed by a legal professional to ensure full compliance. In the meantime, they serve as a transparent baseline — if you spot an error or imprecision, please contact us via support so we can fix it.',
    citationLabel: 'Legal reference',
    premiumNoticeTitle: 'Free launch',
    premiumNoticeBody: 'Fridge+ is currently in free launch. Premium features, payment (Stripe) and billing are not yet active: the corresponding clauses (subscription, right of withdrawal, Terms of Sale) will only apply once premium is activated.',
  },
}

const ICON_BY_KEY = {
  legal:   LuFileText,
  terms:   LuShield,
  cgv:     LuCreditCard,
  privacy: LuLock,
  faq:     LuMessageCircleQuestion,
}

// La section CGV (abonnement premium) est masquée tant que le paiement n'est
// pas actif (mode Launch Free) : ses placeholders [À COMPLÉTER] ne doivent pas
// être publics. Réapparaît automatiquement à l'activation du premium.
// ⚠️ `faq` N'EST PLUS une section de cette page : elle a sa propre route `/faq`.
// Deux URL servant le meme texte = contenu duplique, ce qui dessert le
// referencement qu'on cherche justement a ameliorer. Le sommaire ci-dessous
// garde une carte « Questions frequentes » qui pointe vers `/faq`.
const SECTION_KEYS = PREMIUM_ENABLED
  ? ['legal', 'terms', 'cgv', 'privacy']
  : ['legal', 'terms', 'privacy']

// Entrees du sommaire qui menent AILLEURS que vers une ancre de cette page.
const SUMMARY_LINKS = [{ key: 'faq', to: '/faq' }]

// ─── Renderer de blocs typés ────────────────────────────────────────────


// ─── Composant principal ────────────────────────────────────────────────

export default function LegalPage({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const fallbackNote = getTranslationFallbackNote(lang)
  const { installable } = usePwaInstallable()

  // Le HTML servi est pré-rendu en français ; ici on aligne l'onglet sur la
  // langue affichée — et sur une navigation interne, où aucun HTML n'est
  // rechargé, c'est la SEULE chose qui pose le titre de cette page.
  useDocumentTitle(`${t.title} — Fridge+`)

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? 'rgba(240,232,220,0.7)' : 'rgba(44,26,14,0.65)'
  const cardBg = darkMode ? '#131E2C' : '#FFFFFF'
  const cardBorder = darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.14)'
  const cardShadow = darkMode
    ? 'none'
    : '0 2px 12px rgba(212,106,16,0.08), 0 1px 3px rgba(44,26,14,0.04)'

  return (
    <div style={{
      maxWidth: '820px', margin: '0 auto',
      padding: '32px 16px 80px',
      color: fg,
    }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '13px', fontWeight: 600,
          color: 'var(--link-accent)',
          textDecoration: 'none',
          marginBottom: '24px',
        }}
      >
        <LuArrowLeft size={15} aria-hidden="true" />
        <span>{t.backHome}</span>
      </Link>

      <header style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px', fontWeight: 800,
          margin: 0,
          background: 'var(--gradient-warm)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          marginBottom: '8px',
        }}>
          {t.title}
        </h1>
        <p style={{ fontSize: '15px', fontWeight: 400, color: muted, margin: 0, lineHeight: 1.55 }}>
          {t.subtitle}
        </p>
      </header>

      {/* CTA « Installer l'app » — déplacé du footer (2026-07-10) : le
          bouton y créait une 2e ligne sur mobile (footer trop haut). Rendu
          conditionnel via usePwaInstallable, comme InstallButton lui-même. */}
      {installable && (
        <section
          style={{
            padding: '18px',
            borderRadius: '12px',
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: cardShadow,
            marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
          }}
        >
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: darkMode ? 'rgba(224,120,32,0.14)' : 'rgba(224,120,32,0.10)',
          }}>
            <LuDownload size={20} aria-hidden="true" style={{ color: 'var(--color-warm-600)' }} />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: fg, margin: '0 0 2px' }}>
              {t.installTitle}
            </h2>
            <p style={{ fontSize: '13px', color: muted, margin: 0, lineHeight: 1.5 }}>
              {t.installBody}
            </p>
          </div>
          <InstallButton lang={lang} darkMode={darkMode} />
        </section>
      )}

      {/* Disclaimer pré-launch */}
      <aside
        role="note"
        style={{
          padding: '16px 18px',
          borderRadius: '12px',
          background: darkMode
            ? 'linear-gradient(135deg, rgba(247,168,94,0.12) 0%, rgba(212,106,16,0.06) 100%)'
            : 'linear-gradient(135deg, rgba(247,168,94,0.20) 0%, rgba(212,106,16,0.10) 100%)',
          border: `1.5px solid ${darkMode ? cardBorder : 'rgba(212,106,16,0.30)'}`,
          marginBottom: '24px',
          display: 'flex', gap: '12px',
          boxShadow: darkMode ? 'none' : '0 2px 12px rgba(212,106,16,0.10)',
        }}
      >
        <LuTriangleAlert size={20} aria-hidden="true" style={{ color: 'var(--color-warm-600)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-warm-600)', margin: '0 0 6px' }}>
            {t.disclaimerTitle}
          </h2>
          <p style={{ fontSize: '13px', fontWeight: 400, color: fg, margin: 0, lineHeight: 1.6 }}>
            {t.disclaimerBody}
          </p>
        </div>
      </aside>

      {/* A1 — Bandeau Launch Free : premium/paiement pas encore actifs, pour que
          la Politique de confidentialité et les CGU restent exactes (le checkout
          Stripe est bloqué en mode gratuit). Disparaît à l'activation du premium. */}
      {!PREMIUM_ENABLED && (
        <aside
          role="note"
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: darkMode ? 'rgba(74,222,128,0.08)' : 'rgba(74,222,128,0.10)',
            border: `1.5px solid ${darkMode ? 'rgba(74,222,128,0.25)' : 'rgba(34,197,94,0.30)'}`,
            marginBottom: '24px',
            display: 'flex', gap: '12px',
            color: fg,
          }}
        >
          <LuInfo size={20} aria-hidden="true" style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-success-text)', margin: '0 0 6px' }}>
              {t.premiumNoticeTitle}
            </h2>
            <p style={{ fontSize: '13px', fontWeight: 400, color: fg, margin: 0, lineHeight: 1.6 }}>
              {t.premiumNoticeBody}
            </p>
          </div>
        </aside>
      )}

      {/* Sommaire */}
      <nav
        aria-label={t.summaryTitle}
        style={{
          padding: '18px',
          borderRadius: '12px',
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          boxShadow: cardShadow,
          marginBottom: '32px',
        }}
      >
        <h2 style={{
          fontSize: '12px', fontWeight: 700,
          color: 'var(--color-warm-600)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          margin: '0 0 12px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span aria-hidden="true" style={{
            display: 'inline-block',
            width: '3px', height: '13px',
            background: 'linear-gradient(180deg, #F7A85E 0%, #D46A10 100%)',
            borderRadius: '2px',
          }} />
          {t.summaryTitle}
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {SECTION_KEYS.map(key => {
            const Icon = ICON_BY_KEY[key]
            const section = t.sections[key]
            return (
              <li key={key}>
                <a
                  href={`#${key}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    color: fg, textDecoration: 'none',
                    fontSize: '14px', fontWeight: 600,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(247,168,94,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon size={16} aria-hidden="true" style={{ color: 'var(--color-warm-600)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div>{section.title}</div>
                    <div style={{ fontSize: '12px', fontWeight: 400, color: muted, marginTop: '2px' }}>
                      {section.desc}
                    </div>
                  </div>
                </a>
              </li>
            )
          })}
          {SUMMARY_LINKS.map(({ key, to }) => {
            const Icon = ICON_BY_KEY[key]
            const section = t.sections[key]
            return (
              <li key={key}>
                <Link
                  to={to}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    color: fg, textDecoration: 'none',
                    fontSize: '14px', fontWeight: 600,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(247,168,94,0.10)' : 'rgba(247,168,94,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon size={16} aria-hidden="true" style={{ color: 'var(--color-warm-600)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div>{section.title}</div>
                    <div style={{ fontSize: '12px', fontWeight: 400, color: muted, marginTop: '2px' }}>
                      {section.desc}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* v3.26.2 — Note fallback EN affichée une seule fois en haut
          (au lieu d'être répétée par section) pour ES/DE/JA. Encart
          distinct du disclaimer pré-launch, avec icône LuLanguages
          pour signaler clairement qu'il s'agit d'une question de
          traduction. */}
      {fallbackNote && (lang !== 'fr' && lang !== 'en') && (
        <aside
          role="note"
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: cardBg,
            border: `1.5px dashed ${darkMode ? 'rgba(247,168,94,0.30)' : 'rgba(212,106,16,0.30)'}`,
            marginBottom: '24px',
            display: 'flex', gap: '12px',
            color: fg,
          }}
        >
          <LuLanguages
            size={20}
            aria-hidden="true"
            style={{ color: 'var(--color-warm-600)', flexShrink: 0, marginTop: '2px' }}
          />
          <p style={{
            fontSize: '13px', fontWeight: 400,
            color: fg, margin: 0,
            lineHeight: 1.6,
          }}>
            {fallbackNote}
          </p>
        </aside>
      )}

      {/* Sections détaillées */}
      {SECTION_KEYS.map(key => {
        const Icon = ICON_BY_KEY[key]
        const section = t.sections[key]
        const content = getLegalSection(lang, key)
        return (
          <Section
            key={key}
            id={key}
            title={section.title}
            Icon={Icon}
            intro={content?.intro}
            blocks={content?.blocks}
            fg={fg}
            muted={muted}
            citationLabel={t.citationLabel}
            cardBg={cardBg}
            cardBorder={cardBorder}
            cardShadow={cardShadow}
            darkMode={darkMode}
          />
        )
      })}

      <ScrollToTopButton lang={lang} />
    </div>
  )
}
