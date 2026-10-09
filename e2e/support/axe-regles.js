// Les règles d'axe-core de l'application, PARTAGÉES par les garde-fous
// (`a11y.spec.js` : pages publiques ; `a11y-connecte.spec.js` : écrans d'un
// compte connecté et fenêtres ouvertes — audit du 2026-10-04, A11Y-19).
// Un seul endroit : deux copies divergeraient sans bruit.

// WCAG 2.2 niveau AA = l'union de ces cinq tags. `best-practice` s'y ajoute
// gratuitement : mesuré avant de l'inclure, il ne produit AUCUNE violation
// supplémentaire et fait passer la couverture de ~23 à ~40 règles vérifiées par
// page. C'est lui qui apporte `heading-order`, `page-has-heading-one`,
// `landmark-one-main` et `region` — précisément le sujet de ce lot.
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

// ✅ Plus AUCUNE règle différée : `color-contrast` est ACTIVE depuis le
// 2026-08-24, la dette étant retombée à zéro. C'est ce qui transforme le
// chantier en CLIQUET — mesurer sans verrouiller laisse la dette repartir en
// silence, ce qu'elle avait déjà fait entre deux passes.
export const REGLES_DIFFEREES = []

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
export const MARQUEUR_EXEMPT = 'data-a11y-contrast-exempt'

export function sansExemptions(violations) {
  return violations
    .map(v => v.id !== 'color-contrast'
      ? v
      : { ...v, nodes: v.nodes.filter(n => !n.html.includes(MARQUEUR_EXEMPT)) })
    .filter(v => v.nodes.length > 0)
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
//   `bgOverlap`        (ajoutée le 2026-10-06, A11Y-19) : des éléments de la
//                      page RECOUVERTS par un panneau ouvert (les notifications) —
//                      axe ne sait pas quel fond retenir ; ils sont cachés.
export const RAISONS_INCOMPLETE_TOLEREES = [
  'bgGradient', 'shortTextContent', 'nonBmp', 'elmPartiallyObscuring', 'bgOverlap',
]

export function incompletesNonExpliquees(incomplete) {
  const restantes = []
  for (const i of incomplete) {
    if (i.id !== 'color-contrast') { restantes.push(i.id); continue }
    const raisons = [...new Set(i.nodes.map(n => n.any?.[0]?.data?.messageKey ?? 'raison-inconnue'))]
    const inconnues = raisons.filter(r => !RAISONS_INCOMPLETE_TOLEREES.includes(r))
    if (inconnues.length) restantes.push(`color-contrast (${inconnues.join(', ')})`)
  }
  return restantes
}

export function resume(resultats) {
  return resultats
    .map(v => `${v.id} (${v.impact}, ${v.nodes.length} nœud[s]) → ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)
    .join('\n')
}

// `region` (« tout le contenu dans un repère ») : axe en exempte déjà les
// fenêtres (`regionMatcher` par défaut : dialog, alertdialog, svg). Un MENU
// déroulant ouvert est dans le même cas : porté dans <body>, attaché à son
// bouton — qui, lui, est dans un repère —, et l'on n'y navigue pas par repères
// pendant qu'il est ouvert. Exemption ÉTROITE et déclarée (audit du 2026-10-04,
// A11Y-19), plutôt qu'un `disableRules('region')` qui aveuglerait tout le reste.
// ⚠️ Par les options d'EXÉCUTION (`checks`) : axe lit les options de la
// vérification, pas celles écrites sur la règle — un `axe.configure` de la
// règle s'affichait appliqué et ne changeait rien (vérifié le 2026-10-06).
export const OPTIONS_AXE = {
  checks: { region: { options: { regionMatcher: 'dialog, [role=dialog], [role=alertdialog], svg, [role=menu]' } } },
}
