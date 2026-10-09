// Produit le CORPS des pages statiques en HTML, pour qu'il figure dans le
// fichier SERVI et non seulement après exécution du JavaScript.
//
// ── Pourquoi ce module existe ──────────────────────────────────────────────
// Mesuré le 2026-08-19 sur le build : `dist/faq/index.html` contenait son titre
// (« Questions fréquentes ») mais AUCUNE de ses réponses, et pas davantage le
// balisage `FAQPage`. Le pré-rendu ne remplaçait que les métadonnées.
//
// Googlebot exécute le JavaScript et finit donc par tout voir. GPTBot,
// ClaudeBot et PerplexityBot, non : ils lisent le HTML brut et passent au
// suivant (analyse Vercel × MERJ, >500 M de requêtes, aucune exécution
// observée). Pour eux, `/faq` était une page qui s'appelle « Questions
// fréquentes » et ne répond à aucune question.
//
// ── Pourquoi PAS `renderToString` sur les vrais composants ────────────────
// `useAuth()` rend `null` hors de son provider (`createContext(null)`), et
// `GuidePage` déstructure `const { user } = useAuth()` : un rendu serveur
// planterait, sauf à monter tout l'arbre de contextes — donc le client
// Supabase — dans un script de build. Le texte, lui, vit dans des
// dictionnaires purs : les lire est suffisant et ne dépend de rien.
//
// ⚠️ Ce module est donc une SECONDE présentation des mêmes textes. La
// divergence possible est structurelle (l'ordre, les niveaux de titre), jamais
// textuelle — aucune phrase n'est recopiée ici. `corps-statique.test.js`
// vérifie que chaque question et chaque étape du dictionnaire ressort bien
// dans le HTML produit ; retirer une entrée du générateur le fait rougir.
//
// ── Pourquoi il passe par un build Vite (`--ssr`) ─────────────────────────
// Node ne sait pas résoudre les alias `@shared` / `@features`, ni évaluer
// `import.meta.env` — dont dépend `PREMIUM_ENABLED`, qui décide du texte de la
// réponse « le service est-il gratuit ? ». Vite fait les deux.

import { getFaqBasics, getFaqBasicsMeta } from '@shared/lib/i18n/faq-basics-i18n'
import { getContentCta } from '@shared/lib/i18n/content-cta-i18n'
import { getLegalSection } from '@features/legal/data/legal-content'
import { DELAI_EFFACEMENT_JOURS, EMAIL_SUPPRESSION, CHEMIN_DANS_APP, DONNEES } from '@features/legal/data/suppression-compte'
import { TOUR_STEPS_I18N } from '@features/onboarding/i18n/tour-steps-i18n'

import { CHANGELOG } from '@features/changelog/data/changelog'
import { pickReleaseName, localizeReleaseDate } from '@features/changelog/data/changelog-i18n'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'

// Les CINQ étapes publiques du guide (mêmes clés que `guide-page.jsx`) : les quatre
// communes, puis la finale INVITÉ — numérotée comme les autres, « Étape 5 ».
// ⚠️ Ce commentaire a dit « les 4 étapes » jusqu'au 2026-09-12 : le code était
// juste, sa description mentait. Le nombre réel se lit dans `ETAPES_PUBLIQUES`,
// jamais ici.
//
// Ce HTML est servi sans lecteur connu, et depuis le
// 2026-09-11 cette finale (« Aller plus loin ») dit ce qu'un compte ajoute et
// l'état exact du premium — un discours valable pour quiconque arrive de la
// recherche. Les finales connectées restent réservées à la page vivante.
const ETAPES_PUBLIQUES = ['fab', 'fridge', 'check', 'recipes', 'final_guest']

const TITRES = {
  faq: {
    fr: { h1: 'Questions fréquentes', basics: 'Prise en main', service: 'Le service', etape: (n) => `Voir l’étape ${n} du guide` },
    en: { h1: 'Frequently asked questions', basics: 'Getting started', service: 'The service', etape: (n) => `See step ${n} of the guide` },
  },
  // Les titres du corps SERVI de `/suppression-compte`. Volontairement plus
  // courts que ceux de la page vivante : ce HTML s'adresse à un robot et à un
  // relecteur pressé, pas à quelqu'un qui vient de décider de partir.
  suppression: {
    fr: {
      h1: 'Supprimer mon compte Fridge+',
      intro: 'Tu peux supprimer ton compte et les données associées à tout moment, toi-même. Voici comment, et ce qu’il advient de chaque donnée.',
      dansApp: 'Depuis l’application',
      delai: `Les données personnelles sont anonymisées immédiatement, puis définitivement effacées sous ${DELAI_EFFACEMENT_JOURS} jours, sauvegardes comprises.`,
      parMail: 'Sans l’application',
      parMailIntro: `Si tu as désinstallé Fridge+ ou si tu n’arrives plus à te connecter, écris-nous depuis l’adresse e-mail de ton compte : la suppression est faite sous ${DELAI_EFFACEMENT_JOURS} jours.`,
      effacees: 'Ce qui est effacé',
      anonymisees: 'Ce qui reste en ligne, mais sans toi',
      conservees: `Ce qui est conservé au-delà de ${DELAI_EFFACEMENT_JOURS} jours`,
      legalLien: 'Politique de confidentialité',
    },
    en: {
      h1: 'Delete my Fridge+ account',
      intro: 'You can delete your account and the associated data at any time, by yourself. Here is how, and what happens to each piece of data.',
      dansApp: 'From the app',
      delai: `Personal data is anonymised immediately, then permanently erased within ${DELAI_EFFACEMENT_JOURS} days, backups included.`,
      parMail: 'Without the app',
      parMailIntro: `If you have uninstalled Fridge+ or can no longer sign in, write to us from your account’s email address: deletion is carried out within ${DELAI_EFFACEMENT_JOURS} days.`,
      effacees: 'What is erased',
      anonymisees: 'What stays online, but without you',
      conservees: `What is kept beyond ${DELAI_EFFACEMENT_JOURS} days`,
      legalLien: 'Privacy policy',
    },
  },
  guide: {
    fr: { h1: 'Comment ça marche', etape: 'Étape', retenir: 'À retenir' },
    en: { h1: 'How it works', etape: 'Step', retenir: 'Good to know' },
  },
}

/** Un texte n'est pas du HTML : tout ce qui vient d'un dictionnaire est échappé. */
export function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Rend un bloc typé de `legal-content.js`.
 *
 * Les types inconnus sont IGNORÉS, jamais rendus tels quels : un nouveau type
 * ajouté au contenu juridique doit apparaître ici volontairement, pas fuiter
 * sous forme d'objet stringifié dans une page publique.
 */
function rendreBloc(bloc) {
  switch (bloc.type) {
    case 'h3':
      return `<h3>${echapper(bloc.text)}</h3>`
    case 'p':
    case 'note':
      return `<p>${echapper(bloc.text)}</p>`
    case 'list':
      return `<ul>${(bloc.items ?? []).map(i => `<li>${echapper(i)}</li>`).join('')}</ul>`
    case 'citation':
      return `<blockquote><p>${echapper(bloc.text)}</p><cite>${echapper(bloc.source)}</cite></blockquote>`
    default:
      return ''
  }
}


/**
 * Le bloc de fin de page, servi tel que la page l'affiche.
 *
 * 🔴 Ce helper existe pour une raison précise : ajouter un appel à l'action
 * dans le composant SANS l'ajouter ici recréerait l'écart qu'on vient de
 * supprimer — la page rendue proposerait une suite, le fichier servi non.
 *
 * Et ce ne serait pas cosmétique : les `<a href>` d'ici sont le maillage
 * interne que suit un robot qui n'exécute pas JavaScript. Sans eux, `/faq` et
 * `/guide` ne pointent vers rien, et rien ne pointe entre elles.
 *
 * Les libellés viennent du MÊME dictionnaire que le composant
 * (`content-cta-i18n`) : aucun texte n'est recopié.
 */
function blocFinal(lang, { versChemin, versLibelle }) {
  const t = getContentCta(lang)
  return '<section>'
    + `<h2>${echapper(t.title)}</h2>`
    + `<p><a href="/">${echapper(t.action)}</a></p>`
    + `<p>${echapper(t.note)}</p>`
    + `<p><a href="${echapper(versChemin)}">${echapper(versLibelle)}</a></p>`
    + '</section>'
}

/** Le corps lisible de `/faq` : prise en main, puis FAQ du service. */
export function corpsFaq(lang = 'fr') {
  const t = TITRES.faq[lang] ?? TITRES.faq.fr
  const basics = getFaqBasics(lang)
  const meta = getFaqBasicsMeta(lang)
  const service = getLegalSection(lang, 'faq')

  // Même structure que la page vivante : une phrase d'ouverture, un repère de
  // bloc (Remplir, Vérifier, Cuisiner, Compte) quand il change, et sous chaque
  // réponse le renvoi vers l'étape du guide qui la détaille.
  let dernierGroupe = null
  const priseEnMain = `<p>${echapper(meta.intro)}</p>` + basics.map(({ q, a, group, step }) => {
    const repere = group !== dernierGroupe ? `<p><small>${echapper(meta.groups[group])}</small></p>` : ''
    dernierGroupe = group
    return `${repere}<h3>${echapper(q)}</h3><p>${echapper(a)}</p><p><a href="/guide#etape-${step}">${echapper(t.etape(step))} →</a></p>`
  }).join('')

  const blocsService = (service?.blocks ?? []).map(rendreBloc).join('')
  const introService = service?.intro ? `<p>${echapper(service.intro)}</p>` : ''

  return [
    `<h1>${echapper(t.h1)}</h1>`,
    `<section><h2>${echapper(t.basics)}</h2>${priseEnMain}</section>`,
    `<section><h2>${echapper(t.service)}</h2>${introService}${blocsService}</section>`,
    blocFinal(lang, { versChemin: '/guide', versLibelle: getContentCta(lang).guideLink }),
  ].join('')
}

/** Le corps lisible de `/guide` : les CINQ étapes publiques, dans l'ordre. */
export function corpsGuide(lang = 'fr') {
  const t = TITRES.guide[lang] ?? TITRES.guide.fr
  const steps = TOUR_STEPS_I18N[lang] ?? TOUR_STEPS_I18N.en

  const etapes = ETAPES_PUBLIQUES.map((cle, i) => {
    const etape = steps?.[cle]
    if (!etape) return ''
    const morceaux = [
      `<p><small>${echapper(t.etape)} ${i + 1}</small></p>`,
      `<h2>${echapper(etape.title)}</h2>`,
    ]
    if (etape.subtitle) morceaux.push(`<p><strong>${echapper(etape.subtitle)}</strong></p>`)
    if (etape.desc) morceaux.push(`<p>${echapper(etape.desc)}</p>`)
    if (Array.isArray(etape.options) && etape.options.length > 0) {
      morceaux.push(`<ul>${etape.options
        .map(o => `<li><strong>${echapper(o.t)}</strong> — ${echapper(o.d)}</li>`)
        .join('')}</ul>`)
    }
    if (Array.isArray(etape.tips) && etape.tips.length > 0) {
      morceaux.push(`<p><small>${echapper(t.retenir)}</small></p>`)
      morceaux.push(`<ul>${etape.tips.map(tip => `<li>${echapper(tip.t)}</li>`).join('')}</ul>`)
    }
    // Même ancre que `guide-page.jsx` : les renvois « Voir l'étape N » du /faq
    // servi (`/guide#etape-N`) doivent aboutir AVANT que l'application monte
    // (audit du 2026-10-04, SEO-13).
    return `<section id="etape-${i + 1}">${morceaux.join('')}</section>`
  }).join('')

  const fin = blocFinal(lang, { versChemin: '/faq', versLibelle: getContentCta(lang).faqLink })
  return `<h1>${echapper(t.h1)}</h1>${etapes}${fin}`
}

/**
 * Le corps lisible de `/suppression-compte`.
 *
 * 🔴 Cette page-ci a une raison PARTICULIÈRE d'être servie en dur : c'est une
 * URL que Google vérifie à la main lors de l'examen de l'app, et rien ne
 * garantit que le relecteur — ou le robot qui l'a précédé — exécute le
 * JavaScript. Une page blanche à cette adresse vaut une absence de page, et le
 * motif de refus serait exactement celui qu'on cherche à éviter.
 *
 * Les faits viennent de `data/suppression-compte.js`, la même source que la
 * page vivante et que la FAQ de `/legal`. Rien n'est recopié ici.
 */
export function corpsSuppressionCompte(lang = 'fr') {
  const t = TITRES.suppression[lang] ?? TITRES.suppression.fr
  const d = DONNEES[lang] ?? DONNEES.fr
  const chemin = CHEMIN_DANS_APP[lang] ?? CHEMIN_DANS_APP.fr
  const liste = (items) => `<ul>${items.map(x => `<li>${echapper(x)}</li>`).join('')}</ul>`
  return [
    `<h1>${echapper(t.h1)}</h1>`,
    `<p>${echapper(t.intro)}</p>`,
    `<section><h2>${echapper(t.dansApp)}</h2><p>${echapper(chemin)}</p><p>${echapper(t.delai)}</p></section>`,
    `<section><h2>${echapper(t.parMail)}</h2><p>${echapper(t.parMailIntro)}</p>`,
    `<p><a href="mailto:${echapper(EMAIL_SUPPRESSION)}">${echapper(EMAIL_SUPPRESSION)}</a></p></section>`,
    `<section><h2>${echapper(t.effacees)}</h2>${liste(d.effacees)}</section>`,
    `<section><h2>${echapper(t.anonymisees)}</h2>${liste(d.anonymisees)}</section>`,
    `<section><h2>${echapper(t.conservees)}</h2>${liste(d.conservees)}</section>`,
    blocFinal(lang, { versChemin: '/legal', versLibelle: t.legalLien }),
  ].join('')
}

/**
 * Le balisage `FAQPage`, en JSON, pour le HTML servi.
 *
 * ⚠️ Google a retiré le résultat enrichi FAQ en mai 2026 : n'en attendre aucun
 * accordéon dans les résultats. Sa valeur restante est l'extraction par les
 * moteurs génératifs — c'est-à-dire précisément ceux qui n'exécutent pas le
 * JavaScript, donc ceux pour qui il devait être ICI et pas injecté au montage.
 *
 * Ne retient que la prise en main : ses paires question/réponse sont
 * explicites. La FAQ du service est une suite de `h3` + `p`, et un balisage qui
 * devine l'appariement décrirait la page de travers.
 */
export function jsonLdFaq(lang = 'fr') {
  const questions = getFaqBasics(lang)
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

/**
 * Ce que le pré-rendu doit injecter, par chemin.
 *
 * Une page absente d'ici garde le comportement actuel : métadonnées seules.
 * C'est le cas voulu pour `/community` (son contenu vient de la base) et pour
 * `/changelog` et `/legal`, qui restent à traiter.
 */
export const CORPS_PAR_CHEMIN = {
  // `jsonLdId` doit être L'IDENTIFIANT QU'UTILISE LE COMPOSANT côté client
  // (`<JsonLd id="faq-jsonld" />` dans `faq-page.jsx`). Sans lui, le composant
  // ne retrouverait pas la balise déjà servie et en ajouterait une SECONDE,
  // identique, au montage. Avec lui, il met simplement à jour celle-ci.
  '/faq': { corps: corpsFaq, jsonLd: jsonLdFaq, jsonLdId: 'faq-jsonld' },
  '/guide': { corps: corpsGuide },
  '/legal': { corps: corpsLegal },
  '/changelog': { corps: corpsChangelog },
  '/suppression-compte': { corps: corpsSuppressionCompte },
}// ── /legal ─────────────────────────────────────────────────────────────────
//
// Les titres de section sont RECOPIÉS de `legal-page.jsx` (son `I18N.sections`),
// qui reste la source visible. Six chaînes courtes et stables : les extraire
// dans un fichier partagé demanderait de toucher une page de 393 lignes pour
// éviter de dupliquer deux mots par section — mauvais échange.
//
// Ils servent la hiérarchie des titres : chaque section de `legal-content.js`
// commence par un `h3`, et passer de `h1` à `h3` sans `h2` casse le plan de la
// page pour un lecteur d'écran.
const TITRES_LEGAL = {
  fr: {
    h1: 'Mentions légales & informations',
    legal: 'Mentions légales',
    terms: 'Conditions Générales d\u2019Utilisation',
    cgv: 'Conditions Générales de Vente',
    privacy: 'Politique de confidentialité',
  },
  en: {
    h1: 'Legal notice & information',
    legal: 'Legal notice',
    terms: 'Terms of Service',
    cgv: 'Terms of Sale',
    privacy: 'Privacy policy',
  },
}

// Même règle que `SECTION_KEYS` dans `legal-page.jsx` : les CGV restent
// masquées tant que le premium n'est pas actif — leurs mentions de tarif et de
// rétractation ne doivent pas être publiques avant qu'il existe un paiement.
const SECTIONS_LEGAL = PREMIUM_ENABLED
  ? ['legal', 'terms', 'cgv', 'privacy']
  : ['legal', 'terms', 'privacy']

export function corpsLegal(lang = 'fr') {
  const t = TITRES_LEGAL[lang] ?? TITRES_LEGAL.fr
  const sections = SECTIONS_LEGAL.map(cle => {
    const section = getLegalSection(lang, cle)
    if (!section) return ''
    const intro = section.intro ? `<p>${echapper(section.intro)}</p>` : ''
    const blocs = (section.blocks ?? []).map(rendreBloc).join('')
    return `<section id="${cle}"><h2>${echapper(t[cle])}</h2>${intro}${blocs}</section>`
  }).join('')
  return `<h1>${echapper(t.h1)}</h1>${sections}`
}

// ── /changelog ─────────────────────────────────────────────────────────────
//
// TOUTES les versions, pas les N dernières : servir une page tronquée pendant
// que le rendu JS en affiche une complète recréerait exactement l'écart qu'on
// vient de supprimer. Le poids réel a été MESURÉ avant d'en décider.
//
// ⚠️ `pickReleaseName` et non `entry.name` : les titres de release sont
// traduits (`RELEASE_NAMES_EN`). Lire le champ brut servirait un nom qui ne
// correspond pas à la page.
export function corpsChangelog(lang = 'fr') {
  const t = lang === 'en'
    ? { h1: 'What’s new', version: 'version' }
    : { h1: 'Nouveautés', version: 'version' }

  const entrees = CHANGELOG.map(entry => {
    const nom = pickReleaseName(entry, lang)
    const date = localizeReleaseDate(entry.date, lang)
    const changements = (entry.changes ?? []).map(c => {
      const label = typeof c.label === 'string'
        ? c.label
        : (c.label?.[lang] ?? c.label?.fr ?? '')
      if (!label) return ''
      return `<li>${echapper(label)}</li>`
    }).join('')
    return `<article><h2>${echapper(nom)} · v${echapper(entry.version)}</h2>`
      + `<p><small>${echapper(date)}</small></p>`
      + `<ul>${changements}</ul></article>`
  }).join('')

  return `<h1>${echapper(t.h1)}</h1>${entrees}`
}



