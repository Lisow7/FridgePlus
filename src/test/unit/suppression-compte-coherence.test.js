import { describe, it, expect } from 'vitest'
import { ROUTES } from '@routes/routes-config'
import { PAGES_STATIQUES } from '../../../scripts/lib/prerender-page.mjs'
import { corpsSuppressionCompte } from '@prerender/corps-statique'
import {
  DELAI_EFFACEMENT_JOURS,
  EMAIL_SUPPRESSION,
  CHEMIN_DANS_APP,
} from '@features/legal/data/suppression-compte'
import { getLegalSection } from '@features/legal/data/legal-content'

// `/suppression-compte` n'est pas une page de confort : c'est une EXIGENCE de
// Google Play. Pour toute app permettant de créer un compte, il faut une URL
// web publique où demander la suppression du compte et des données — HTTPS,
// aucun mur de connexion, lien DIRECT vers la page.
// https://support.google.com/googleplay/android-developer/answer/13327111
//
// Les trois propriétés qui la rendent conforme sont portées par TROIS fichiers
// différents : la route (`routes-config.js`), le pré-rendu et le sitemap
// (`PAGES_STATIQUES`), le corps servi (`corps-statique.js`). Une page déclarée
// dans deux listes sur trois est exactement la classe de défaut dominante de ce
// dépôt — et ici, la sanction n'est pas cosmétique : c'est un refus de
// publication, découvert des semaines après.

const CHEMIN = '/suppression-compte'

describe('/suppression-compte — l’exigence Google Play tient dans les trois listes', () => {
  it('la route existe et n’est protégée par AUCUN guard', () => {
    const route = ROUTES.find(r => r.path === CHEMIN)
    expect(route, `Aucune route ${CHEMIN} dans routes-config.js.`).toBeTruthy()
    // 🔴 Le cœur de l'exigence. Quelqu'un qui a désinstallé l'app, ou perdu
    // l'accès à son compte, doit pouvoir demander la suppression. Un guard ici
    // retirerait précisément ce que la page existe pour offrir — et un guard
    // ajouté « par précaution » au fil d'un refactor ne se verrait nulle part
    // ailleurs.
    expect(
      route.Guard,
      `${CHEMIN} est passée derrière un guard. Google exige une URL SANS mur de ` +
      'connexion : cette page doit rester atteignable par quelqu’un qui n’a plus l’app.',
    ).toBeUndefined()
  })

  it('la page est déclarée au pré-rendu et au sitemap', () => {
    const page = PAGES_STATIQUES.find(p => p.chemin === CHEMIN)
    expect(
      page,
      `${CHEMIN} absente de PAGES_STATIQUES : elle ne serait ni pré-rendue ni au ` +
      'sitemap. Le relecteur de Google, ou le robot qui le précède, peut très bien ' +
      'ne pas exécuter le JavaScript — et une page blanche vaut une absence de page.',
    ).toBeTruthy()
    expect(page.titre).toMatch(/Fridge\+/)
    expect(page.description.length).toBeGreaterThan(60)
  })

  it('le corps SERVI porte le chemin dans l’app, l’adresse de recours et le délai', () => {
    for (const lang of ['fr', 'en']) {
      const html = corpsSuppressionCompte(lang)
      expect(html.length, `corps ${lang} suspicieusement court`).toBeGreaterThan(600)
      expect(html, `corps ${lang} : adresse de recours absente`).toContain(EMAIL_SUPPRESSION)
      expect(html, `corps ${lang} : délai absent`).toContain(String(DELAI_EFFACEMENT_JOURS))
      // Le chemin est ÉCHAPPÉ dans le HTML (« → », les guillemets, le « & ») :
      // on cherche donc un fragment stable, pas la chaîne brute. (Le repère
      // était « Confidentialit » : l'onglet n'existait plus — CPT-07.)
      const repere = lang === 'fr' ? 'Zone de danger' : 'Danger zone'
      expect(html, `corps ${lang} : chemin dans l’app absent`).toContain(repere)
      expect(CHEMIN_DANS_APP[lang], `chemin ${lang} non défini`).toBeTruthy()
    }
  })
})

describe('/suppression-compte — aucune page n’annonce un délai que la source ne déclare pas', () => {
  // 🥇 La garde anti-divergence. Le délai vit dans `suppression-compte.js` ;
  // `/legal` le répète en toutes lettres dans sa FAQ. Le jour où l'un des deux
  // change seul, un utilisateur lit deux promesses différentes sur le même
  // sujet — et l'une des deux est une promesse juridique.
  it('la FAQ de /legal annonce le même délai que la source', () => {
    for (const [lang, motif] of [['fr', /(\d+)\s*jours/], ['en', /(\d+)\s*days/]]) {
      const faq = getLegalSection(lang, 'faq')
      const bloc = JSON.stringify(faq)
      // On ne cherche que dans la réponse consacrée à la suppression : la page
      // parle de « 30 jours » pour d'autres choses (préavis CGU, sauvegardes).
      const reponse = bloc.split(lang === 'fr' ? 'supprimer mon compte' : 'delete my account')[1]
      expect(reponse, `réponse « supprimer mon compte » introuvable en ${lang}`).toBeTruthy()
      const trouve = reponse.slice(0, 600).match(motif)
      expect(trouve, `aucun délai chiffré dans la réponse ${lang}`).toBeTruthy()
      expect(
        Number(trouve[1]),
        `/legal annonce ${trouve[1]} jours en ${lang}, la source en déclare ` +
        `${DELAI_EFFACEMENT_JOURS}. Deux promesses différentes sur la même page publique.`,
      ).toBe(DELAI_EFFACEMENT_JOURS)
    }
  })
})
