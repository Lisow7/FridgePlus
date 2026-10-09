import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Instrumentation d'accessibilité — axe-core sur les pages publiques.
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// Tous les garde-fous a11y de ce dépôt lisaient le SOURCE : ils vérifient
// qu'une ligne est écrite, jamais que la page rendue est correcte. Ils ne
// pouvaient donc pas voir un défaut qui n'apparaît qu'une fois le CSS appliqué
// et le DOM assemblé. Celui-ci rend les pages et les inspecte.
//
// Ce que ça a rapporté le jour même de son écriture (2026-08-22) : le plan de
// titres de l'accueil sautait de `h1` à `h3`, défaut PRÉEXISTANT vérifié sur
// `origin/dev`, qu'aucun test structurel n'aurait attrapé.
//
// ── Le préfixe `/FridgePlus/` ─────────────────────────────────────────────
// ⚠️ Le serveur de dev sert l'app sous `/FridgePlus/` (héritage GitHub Pages,
// `vite.config.js` — Vercel build avec `base: '/'`). Sans ce préfixe, Vite rend
// sa page d'erreur 404 et axe l'analyse sans broncher : mesurée ainsi, elle
// annonce fièrement « `<html>` sans attribut `lang` » sur cinq pages. C'est le
// patron déjà suivi par `signup-funnel`, `shared-basket` et `account-deletion`.
//
// ── Pourquoi l'écran de bienvenue est marqué « vu » ───────────────────────
// 🔴 C'est la ligne la plus importante du fichier. Playwright part d'un
// `localStorage` vierge, donc de l'état « tout premier lancement » — et dans cet
// état, `WelcomeScreen` couvre l'accueil avec un `role="dialog"
// aria-modal="true"`. Une modale de ce type retire TOUT le reste de la page de
// l'arbre d'accessibilité : axe n'analysait alors que l'écran de bienvenue, et
// rapportait « aucun défaut » sur une page d'accueil qu'il n'avait pas vue.
// Sans cette clé, ce fichier serait un garde-fou vert qui ne garde rien.
//
// ── `color-contrast` : différé, pas oublié ────────────────────────────────
// ⛔ État au 2026-08-23 : **17 nœuds en thème clair, 2 en thème sombre** — dont
// **6 qui ne seront jamais corrigés** (voir plus bas). Dette réelle : **13**.
//
// Point de départ : 37 clair / 27 sombre. Quatre passes, chacune mesurée :
//
//   -12 sombre  les 2 boutons du bandeau de consentement (2,64:1) — premier
//               écran de chaque visiteur, sur la décision qui l'engage
//   -9  sombre  `CD.mid` du thème communauté : UNE ligne, 9 nœuds
//   -12 clair   `/changelog` — badges `feat`/`fix` et métadonnées : 17 → 4
//   -3  sombre  idem, versant sombre
//   4ᵉ passe — les « quasi-succès », 8 nœuds en tout :
//     -7 clair   dont 4 à 4,41:1 (alpha du `muted` de `/faq` et `/guide`,
//                0.66 → 0.68) et 3 à 4,42:1 (liens textuels sur crème :
//                `--color-warm-600` → nouveau token `--link-accent`)
//     -1 sombre  l'accroche du changelog, à 4,4996:1 (0.75 → 0.76)
//
//   Arithmétique : clair 24 - 7 = 17 · sombre 3 - 1 = 2.
//   ⚠️ Ces 8-là rataient le seuil de 0,01 à 0,09 seulement : la correction est
//   arithmétique, PAS esthétique — aucun arbitrage de palette. Vérifié en
//   comparant les captures avant/après : 0,02 à 0,54 % des pixels touchés,
//   écart maximal de 7/255 sur un canal. `--color-warm-600` reste intact
//   partout où il sert de FOND de bouton.
//
// ⚠️ **6 des 17 nœuds clairs sont un FAUX POSITIF assumé** : le logotype
// « Fridge+ » du pied de page, sur les 6 pages. WCAG 1.4.3 exempte les
// logotypes, ce qu'axe ne peut pas deviner (voir `src/app/layout/footer.jsx`).
// Les compter comme dette ferait croire à un chantier plus lourd qu'il n'est.
//
// Ce qui reste vraiment (13), et qui se VOIT — donc sa propre version et sa
// propre QA visuelle dans les deux thèmes :
//
//   6 clair   l'accroche animée de l'en-tête (3,24:1 sur 5 pages ; 2,92:1 sur
//             l'accueil — c'est le MÊME élément, il change de couleur)
//   2+2       les descriptions de compartiments de l'accueil, dans les DEUX
//             thèmes : `--color-muted` sous une `opacity: .7`. Même origine des
//             deux côtés ⇒ une seule correction pour 4 nœuds.
//   1 clair   l'accroche du changelog, versant clair (2,81:1)
//   1 clair   le `h2` `--color-success` de `/legal` (2,75:1)
//   1 clair   le filtre « Toutes » de `/community` (3,87:1)
//
// 🔴 **Ce fichier ne peut PAS voir un élément animé en entier** : axe capture un
// instant. L'accroche du changelog l'a montré — son état `activeColor` en thème
// clair vaut **2,69:1**, pire que l'état mesuré, et n'apparaît dans AUCUN
// relevé. ⇒ **pour tout texte animé, vérifier les DEUX bouts à la main.**
//
// 🥇 Tout le RESTE est bloquant dès aujourd'hui, et à zéro : la règle « on
// commence permissif, on durcira plus tard » fait grossir la dette en silence.
// 🔴 Ces 6 pages n'ont longtemps couvert QUE 6 pages, et c'était un ANGLE MORT :
// 5 routes publiques échappaient au cliquet. L'audit du 2026-08-25 y a trouvé de
// vrais défauts — dont un `aria-required-parent` **critical** sur les 515 pages
// de recette, et DEUX `<main>` sur /login et /signup.
// 🥇 **Un cliquet ne protège que ce qu'il VISITE.** Chercher ses angles morts
// vaut autant que le construire.
const PAGES = [
  '/FridgePlus/',
  '/FridgePlus/faq',
  '/FridgePlus/guide',
  '/FridgePlus/legal',
  '/FridgePlus/suppression-compte',
  '/FridgePlus/changelog',
  '/FridgePlus/community',
  // Ajoutées le 2026-08-25, une fois leurs défauts corrigés.
  '/FridgePlus/login',
  '/FridgePlus/signup',
  '/FridgePlus/page-qui-n-existe-pas',   // la 404 : elle était déjà propre
  // 🔴 LA page qui manquait le plus : elle représente **515 URL publiques**,
  // le cœur du référencement. Une seule suffit — les 515 partagent le même
  // composant, et c'est bien lui qui portait les défauts (onglets sans
  // `tablist`, badges sous le seuil de contraste).
  '/FridgePlus/recipe/affogato',
]

// ✅ Plus aucune route publique hors du garde-fou. Seule `/auth/recovery` reste
// dehors, et c'est structurel : son `RecoveryGuard` exige un jeton de
// récupération valide, elle redirige donc sans lui.

// WCAG 2.2 niveau AA = l'union de ces cinq tags. `best-practice` s'y ajoute
// gratuitement : mesuré avant de l'inclure, il ne produit AUCUNE violation
// supplémentaire et fait passer la couverture de ~23 à ~40 règles vérifiées par
// page. C'est lui qui apporte `heading-order`, `page-has-heading-one`,
// `landmark-one-main` et `region` — précisément le sujet de ce lot.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

// ✅ Plus AUCUNE règle différée : `color-contrast` est ACTIVE depuis le
// 2026-08-24, la dette étant retombée à zéro. C'est ce qui transforme le
// chantier en CLIQUET — mesurer sans verrouiller laisse la dette repartir en
// silence, ce qu'elle avait déjà fait entre deux passes.
const REGLES_DIFFEREES = []

// La SEULE exemption accordée à `color-contrast`, et elle est déclarée dans le
// composant lui-même (`footer.jsx`) et non dans une liste tenue ici : une liste
// distante se périme sans bruit le jour où le composant bouge.
//
// WCAG 1.4.3 exempte les logotypes ; axe-core ne peut pas le deviner et signale
// le logotype « Fridge+ » du pied de page sur les 6 pages.
//
// 🔴 Le filtre est VOLONTAIREMENT étroit : il ne retire QUE les nœuds portant
// le marqueur, et QUE pour `color-contrast`. Toute autre règle continue de voir
// ces nœuds, et tout autre nœud reste bloquant. Un filtre plus large aurait
// rendu ce garde-fou vert sans qu'il garde quoi que ce soit.
const MARQUEUR_EXEMPT = 'data-a11y-contrast-exempt'

function sansExemptions(violations) {
  return violations
    .map(v => v.id !== 'color-contrast'
      ? v
      : { ...v, nodes: v.nodes.filter(n => !n.html.includes(MARQUEUR_EXEMPT)) })
    .filter(v => v.nodes.length > 0)
}

// Les règles qu'axe n'a pas pu trancher seul, relevées le 2026-08-22.
//
// ⚠️ `incomplete` n'est pas `pass` : ce sont des nœuds laissés à un humain. Les
// figer ici sert à attraper l'apparition d'une règle NOUVELLE — sans quoi un
// défaut peut naître et rester invisible, ni violation ni échec.
//
// 🔴 La liste est PAR PAGE, et pas globale. En liste unique, la tolérance
// accordée à `/changelog` s'appliquait aussi aux cinq autres pages, où rien ne
// la justifie : le garde-fou aurait laissé passer sur `/faq` exactement ce qu'il
// n'accepte que sur `/changelog`. Les cinq autres doivent rendre une liste vide.
//
// `aria-prohibited-attr` sur `/changelog` : des `<span aria-label="…">` sans
// rôle. ARIA n'autorise pas de nom accessible sur un élément générique, et le
// résultat dépend du navigateur — d'où l'indécision d'axe. À traiter avec le
// chantier contraste, qui touche les mêmes badges.
//
// ⚠️ Ces badges viennent des entrées de `CHANGELOG` : leur présence dépend du
// CONTENU publié, pas seulement du code. Si cette tolérance devient inutile un
// jour, c'est que les badges ont changé de forme — la retirer alors.
const INCOMPLETE_CONNUS = {
  '/FridgePlus/changelog': ['aria-prohibited-attr'],
}

// `color-contrast` étant désormais active, elle alimente aussi `incomplete` :
// des nœuds qu'axe refuse de trancher seul. Les tolérer EN BLOC rendrait le
// garde-fou aveugle à tout futur cas indécidable. On ne tolère donc que les
// RAISONS constatées le 2026-08-24, et une raison nouvelle fait échouer :
//
//   `bgGradient`       texte posé sur un dégradé — axe ne sait pas quelle
//                      couleur de fond retenir (bouton « Se connecter »,
//                      le titre de l'en-tête, le `h1` de /community).
//   `shortTextContent` les séparateurs « · » du pied de page : contenu trop
//                      court pour qu'axe décide. Ils sont `aria-hidden` et
//                      purement décoratifs.
//   `nonBmp`           caractères hors du plan Unicode de base — les EMOJI.
//                      L'accueil en est tapissé (ingrédients, compartiments) ;
//                      un emoji n'a pas de couleur de texte à comparer.
//   `elmPartiallyObscuring` élément qui en recouvre partiellement un autre
//                      (portes du frigo, badges superposés) : axe ne sait pas
//                      quel fond retenir.
//
// ⚠️ Ces deux dernières n'ont PAS été trouvées en inspectant à la main : j'avais
// échantillonné les 4 premiers nœuds et elles arrivaient après. C'est ce test
// qui les a levées. 🥇 **Un échantillon ment ; c'est la liste EXHAUSTIVE des
// raisons qui fait foi.**
const RAISONS_INCOMPLETE_TOLEREES = [
  'bgGradient', 'shortTextContent', 'nonBmp', 'elmPartiallyObscuring',
]

function incompletesNonExpliquees(incomplete) {
  const restantes = []
  for (const i of incomplete) {
    if (i.id !== 'color-contrast') { restantes.push(i.id); continue }
    const raisons = [...new Set(i.nodes.map(n => n.any?.[0]?.data?.messageKey ?? 'raison-inconnue'))]
    const inconnues = raisons.filter(r => !RAISONS_INCOMPLETE_TOLEREES.includes(r))
    if (inconnues.length) restantes.push(`color-contrast (${inconnues.join(', ')})`)
  }
  return restantes
}

function resume(resultats) {
  return resultats
    .map(v => `${v.id} (${v.impact}, ${v.nodes.length} nœud[s]) → ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)
    .join('\n')
}

// Les deux thèmes, parce que les tokens de couleur ne sont pas les mêmes et que
// rien ne garantit qu'un thème hérite de la correction de l'autre : `#B85000`
// et `#D8901E` désignent la MÊME variable, et une seule des deux était
// conforme. C'est ce balayage qui a mis au jour le contraste des boutons de la
// bannière de consentement. Vérifier un seul thème, c'est vérifier la moitié de
// l'application.
// ── …et les deux LARGEURS ─────────────────────────────────────────────────
// 🔴 Ce fichier n'a tourné qu'en 1440×900 — l'unique projet Playwright — jusqu'au
// 2026-09-12. Or une partie entière de l'interface n'existe qu'en dessous de
// 1280 px (`xl:hidden`) : les onglets Frigo / Garde-manger, la barre du bas, les
// dispositions empilées. axe ne les avait JAMAIS vues.
//
// Ce qu'il y a trouvé le jour où on a regardé : `--color-muted` (#7A90A8) à
// 4,42:1 sur la barre d'onglets en thème sombre, pour un seuil de 4,5 — et le
// même jeton sous le seuil sur deux autres surfaces sombres. Un défaut qui
// vivait là depuis que ces onglets existent.
//
// 🥇 La leçon est la même que celle du bandeau cookies, le même jour : un
// cliquet ne protège que ce qu'il VISITE. Ni le thème ni la page ne suffisent —
// la LARGEUR est une dimension à part entière.
const LARGEURS = [
  { nom: 'bureau', width: 1440, height: 900 },
  { nom: 'mobile', width: 390, height: 844 },
]

for (const theme of ['light', 'dark']) {
 for (const taille of LARGEURS) {
  test.describe(`accessibilité — thème ${theme}, ${taille.nom}`, () => {
    for (const chemin of PAGES) {
      test(`${chemin} n'a aucune violation axe-core`, async ({ page }) => {
        await page.setViewportSize({ width: taille.width, height: taille.height })
        await page.addInitScript((t) => {
          localStorage.setItem('fridge-welcome-seen-v1', '1')
          if (t === 'dark') localStorage.setItem('fridge-theme', 'dark')
        }, theme)

        await page.goto(chemin)
        await page.waitForLoadState('networkidle')

        const resultat = await new AxeBuilder({ page })
          .withTags(TAGS)
          .disableRules(REGLES_DIFFEREES)
          .analyze()

        const violations = sansExemptions(resultat.violations)
        expect(violations, resume(violations)).toEqual([])

        const tolerees = INCOMPLETE_CONNUS[chemin] ?? []
        const nouvelles = incompletesNonExpliquees(resultat.incomplete)
          .filter(id => !tolerees.includes(id))
        expect(nouvelles, `règle(s) « incomplete » nouvelle(s) sur ${chemin} : ${nouvelles.join(', ')}`).toEqual([])
      })
    }
  })
 }
}
