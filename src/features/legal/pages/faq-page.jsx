import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LuArrowLeft, LuMessageCircleQuestion } from 'react-icons/lu'
import { Section } from '@features/legal/components/legal-content-blocks'
import ScrollToTopButton from '@shared/ui/scroll-to-top-button'
import JsonLd from '@shared/ui/json-ld'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import ContentPageCta from '@shared/ui/content-page-cta'
import { getLegalSection } from '@features/legal/data/legal-content'
import { getFaqBasics, getFaqBasicsMeta } from '@shared/lib/i18n/faq-basics-i18n'
import FabGlyph from '@shared/ui/fab-glyph'
import { getContentCta } from '@shared/lib/i18n/content-cta-i18n'

// Page FAQ dédiée — /faq
//
// ── Pourquoi une page à part, et pas une ancre `/legal#faq` ────────────────
// La FAQ vivait à deux endroits : un accordéon de 5 questions dans la modale
// « Aide & infos », et une 5ᵉ section de `/legal`. Aucun des deux n'avait
// d'URL propre. Conséquences : introuvable depuis un moteur de recherche,
// impossible à envoyer à quelqu'un, et la partie « aide » était noyée au
// milieu des CGU/CGV/confidentialité.
//
// Cette page réunit les deux, dans l'ordre où on en a besoin :
//   1. la prise en main (les 5 questions d'usage de la modale) ;
//   2. la FAQ du service (gratuité, compte, données, RGPD).
//
// ⚠️ Les deux sources ont été retirées de leur emplacement d'origine. Deux URL
// servant le même texte, c'est du contenu dupliqué — exactement ce qu'on
// cherche à éviter en travaillant le référencement. La modale et `/legal`
// gardent chacune un lien vers ici.
//
// Aucun texte n'est réécrit ici : `HELP_I18N[lang].faq` et
// `getLegalSection(lang, 'faq')` restent les sources uniques.
//
// ── Sur le balisage `FAQPage` ──────────────────────────────────────────────
// ⚠️ Ne pas en attendre l'accordéon dans les résultats Google : depuis août
// 2023, ce résultat enrichi est réservé aux sites gouvernementaux et de santé
// reconnus. Le balisage est posé quand même — il est gratuit, il aide à faire
// comprendre de quoi parle la page, et il redeviendrait utile si la règle
// changeait. Mais **le vrai levier de cette page, c'est d'exister à une URL,
// d'être pré-rendue avec son propre titre et d'être déclarée au sitemap.**
//
// ── Langues ────────────────────────────────────────────────────────────────
// Les deux dictionnaires ne portent que fr + en ; `legal-content.js` fait déjà
// retomber es/de/ja sur l'anglais. On applique la même règle au bloc « prise
// en main », sinon la page mélangerait deux langues.

const I18N = {
  fr: {
    title: 'Questions fréquentes',
    subtitle: 'Les réponses aux questions qu’on nous pose le plus souvent sur Fridge+.',
    backHome: 'Retour à l’accueil',
    citationLabel: 'Référence',
    basicsTitle: 'Prise en main',
    serviceTitle: 'Le service',
    guideCta: 'Voir comment ça marche, étape par étape',
    stepLink: (n) => `Voir l’étape ${n} du guide`,
  },
  en: {
    title: 'Frequently asked questions',
    subtitle: 'Answers to the questions we get asked most about Fridge+.',
    backHome: 'Back to home',
    citationLabel: 'Reference',
    basicsTitle: 'Getting started',
    serviceTitle: 'The service',
    guideCta: 'See how it works, step by step',
    stepLink: (n) => `See step ${n} of the guide`,
  },
  es: {
    title: 'Preguntas frecuentes',
    subtitle: 'Las respuestas a las preguntas más habituales sobre Fridge+.',
    backHome: 'Volver al inicio',
    citationLabel: 'Referencia',
    basicsTitle: 'Primeros pasos',
    serviceTitle: 'El servicio',
    guideCta: 'Ver cómo funciona, paso a paso',
    stepLink: (n) => `Ver el paso ${n} de la guía`,
  },
  de: {
    title: 'Häufige Fragen',
    subtitle: 'Antworten auf die Fragen, die uns am häufigsten zu Fridge+ gestellt werden.',
    backHome: 'Zurück zur Startseite',
    citationLabel: 'Referenz',
    basicsTitle: 'Erste Schritte',
    serviceTitle: 'Der Dienst',
    guideCta: 'Schritt für Schritt ansehen, wie es funktioniert',
    stepLink: (n) => `Schritt ${n} der Anleitung ansehen`,
  },
  ja: {
    title: 'よくある質問',
    subtitle: 'Fridge+ について最もよく寄せられる質問への回答です。',
    backHome: 'ホームに戻る',
    citationLabel: '参照',
    basicsTitle: 'はじめかた',
    serviceTitle: 'サービスについて',
    guideCta: '使い方をステップごとに見る',
    stepLink: (n) => `ガイドのステップ${n}を見る`,
  },
}

// Balisage FAQPage. On ne retient que le bloc « prise en main » : ses paires
// question/réponse sont explicites et courtes. La FAQ du service est une suite
// de `h3` + `p` — la transformer en Q/R demanderait de deviner l'appariement,
// et un balisage qui ne décrit pas fidèlement la page est pire que pas de
// balisage du tout.
function construireFaqJsonLd(questions) {
  if (!questions?.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

export default function FaqPage({ lang = 'fr', darkMode = false }) {
  const t = I18N[lang] ?? I18N.fr
  const content = getLegalSection(lang, 'faq')
  const basics = getFaqBasics(lang)
  const meta = getFaqBasicsMeta(lang)
  // Le HTML servi est pré-rendu en français ; ici on aligne l'onglet sur la
  // langue affichée. Le canonical et les `og:*`, eux, ne bougent pas.
  useDocumentTitle(`${t.title} — Fridge+`)
  // Mémoïsé : sans ça, chaque rendu produirait un nouvel objet, et l'effet de
  // `JsonLd` retirerait puis réinjecterait le script à chaque fois.
  const jsonLd = useMemo(() => construireFaqJsonLd(basics), [basics])

  const fg         = darkMode ? '#E8EDF2' : 'var(--color-charcoal)'
  // L alpha du versant CLAIR passe de 0.66 a 0.68. Composite sur le creme
  // `#f5f0e8`, 0.66 rendait `#716f6d` = 4,41:1 — sous le 4,5:1 exige, de 0,09.
  // 0.68 rend 4,68:1. L ecart est invisible a l oeil nu ; le versant sombre
  // passait deja et ne bouge pas.
  const muted      = darkMode ? 'rgba(232,237,242,0.68)' : 'rgba(45,45,45,0.68)'
  const cardBg     = darkMode ? '#1A2535' : '#FFFFFF'
  const cardBorder = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(224,120,32,0.16)'
  const cardShadow = darkMode
    ? '0 2px 10px rgba(0,0,0,0.35), 0 8px 28px rgba(0,0,0,0.22)'
    : '0 1px 3px rgba(224,120,32,0.06), 0 6px 20px rgba(224,120,32,0.07)'

  return (
    <div
      role="article"
      style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 64px', color: fg }}
    >
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20,
          fontSize: 13.5, fontWeight: 700, color: muted, textDecoration: 'none',
        }}
      >
        <LuArrowLeft size={16} aria-hidden="true" />
        {t.backHome}
      </Link>

      <header style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
          {t.title}
        </h1>
        <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, color: muted, maxWidth: '60ch' }}>
          {t.subtitle}
        </p>
      </header>

      {/* ── Prise en main : les questions d'usage ──────────────────────── */}
      {basics.length > 0 && (
        <section aria-labelledby="faq-basics" style={{ marginBottom: 30 }}>
          <h2
            id="faq-basics"
            style={{ fontSize: 19, fontWeight: 750, margin: '0 0 12px', letterSpacing: '-0.01em' }}
          >
            {t.basicsTitle}
          </h2>

          {/* Tout part du bouton orange : le dire, et le MONTRER (glyphe). */}
          <p style={{ margin: '0 0 14px', fontSize: 14.5, lineHeight: 1.6, color: muted, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <FabGlyph size={16} />
            <span>{meta.intro}</span>
          </p>
          {/* Les réponses sont rendues DÉPLIÉES, pas en accordéon. Un accordéon
              économise de la place dans une modale ; sur une page dont le but
              est d'être lue et indexée, il ne fait que cacher le contenu.
              Les blocs (Remplir, Vérifier, Cuisiner, Compte) sont des repères
              visuels `aria-hidden`, pas des titres : le lecteur d'écran suit les
              `h3`, et le cliquet `heading-order` ne bouge pas. Chaque réponse
              renvoie à l'étape du guide qui la détaille (`/guide#etape-n`). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {basics.map(({ q, a, group, step }, i) => (
              <Fragment key={i}>
                {/* Couleur du repère : en clair, `--color-warm-600` (#B85000) sur
                    le fond crème #F5F0E8 fait 4,42:1 — sous le 4,5:1 exigé pour un
                    texte de 11 px, attrapé par le cliquet axe le 2026-09-11.
                    #8A5A18 (le brun du titre de l'inventaire) fait 5,21:1. En
                    sombre, #D8901E passe (5,83:1) et reste. */}
                {(i === 0 || basics[i - 1].group !== group) && (
                  <div data-faq-group aria-hidden="true" style={{
                    padding: '8px 2px 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: darkMode ? 'var(--color-warm-600)' : '#8A5A18',
                  }}>{meta.groups[group]}</div>
                )}
                <div
                  style={{
                    background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow,
                    borderRadius: 14, padding: '15px 18px',
                  }}
                >
                  <h3 style={{ fontSize: 15, fontWeight: 750, margin: 0, lineHeight: 1.4 }}>{q}</h3>
                  <p style={{ margin: '7px 0 0', fontSize: 14, lineHeight: 1.6, color: muted }}>{a}</p>
                  <Link
                    to={`/guide#etape-${step}`}
                    style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--link-accent)', textDecoration: 'none' }}
                  >
                    {t.stepLink(step)} →
                  </Link>
                </div>
              </Fragment>
            ))}
          </div>

          <Link
            to="/guide"
            style={{
              display: 'inline-block', marginTop: 14, fontSize: 13.5, fontWeight: 700,
              color: 'var(--link-accent)', textDecoration: 'none',
            }}
          >
            {t.guideCta} →
          </Link>
        </section>
      )}

      {/* ── FAQ du service (gratuité, compte, données, RGPD) ───────────── */}
      <Section
        id="faq"
        title={t.serviceTitle}
        Icon={LuMessageCircleQuestion}
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

      {/* Une page trouvée depuis un moteur de recherche doit proposer une
          suite. Jusqu'ici elle n'offrait que « Retour à l'accueil », en haut :
          une sortie, pas une invitation. */}
      <ContentPageCta
        lang={lang}
        darkMode={darkMode}
        secondaryTo="/guide"
        secondaryLabel={getContentCta(lang).guideLink}
      />

      <JsonLd id="faq-jsonld" data={jsonLd} />
      <ScrollToTopButton lang={lang} />
    </div>
  )
}
