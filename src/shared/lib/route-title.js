import { LIBELLES_DES_ROUTES } from '@shared/static/libelles-des-routes'

// Le titre d'onglet d'une route, construit depuis le libellé qu'elle déclare
// déjà (`@shared/static/libelles-des-routes`, accroché à chaque route par
// `routes-config.js`).
//
// Vivait dans src/routes/ jusqu'au 2026-10-10 : neuf pages de features/ et un
// hook de shared/ importaient routes/, à rebours du flux shared → features →
// routes → app (audit du 2026-10-04, ARCH-13). La table des libellés et ce
// helper sont dans shared/ ; routes/ les lit, plus l'inverse.
//
// ── Pourquoi passer par le libellé de la route ────────────────────────────
// Chaque route porte un `label: { fr, en }` — celui qui sert déjà ailleurs
// dans l'app. Redéclarer ces mêmes mots dans chaque page en ferait deux
// sources pour un seul texte, et c'est celle qu'on ne relit plus qui finirait
// par diverger.
//
// ── Pourquoi les pages appellent ce helper, plutôt qu'un poseur central ───
// Un composant unique qui poserait le titre pour TOUTES les routes serait plus
// court à écrire, mais il entrerait en concurrence avec les pages au titre
// dynamique — `/recipe/:id` affiche le nom du plat, pas un libellé fixe. Le
// gagnant dépendrait alors de l'ordre d'exécution des effets entre parent et
// enfant : exactement le genre de dépendance que ce dépôt a déjà payée (voir
// l'en-tête de `use-document-title.js`).
//
// Chaque page appelle donc ce helper explicitement. Le risque qu'une nouvelle
// page l'oublie est couvert par `titre-de-chaque-page.test.js`, qui refuse
// toute route principale dont la page ne pose pas de titre.
//
// ⚠️ Le suffixe « — Fridge+ » est le même que celui des pages pré-rendues
// (`PAGES_STATIQUES`) : un onglet doit se lire pareil qu'on arrive par un lien
// ou par une navigation interne.

const SUFFIXE = ' — Fridge+'

export function titreDeRoute(chemin, lang = 'fr') {
  const libelle = LIBELLES_DES_ROUTES[chemin]
  const label = libelle?.[lang] ?? libelle?.fr
  // Chaîne vide et non `undefined` : `useDocumentTitle` ne pose rien sur une
  // valeur vide, et laisse donc le titre du HTML servi en place.
  return label ? label + SUFFIXE : ''
}

// Les routes dont la PAGE pose elle-même le titre de l'onglet.
//
// 🔴 Pourquoi cette liste existe, mesuré au navigateur le 2026-08-21 :
//
//   1. useSeoMeta         POSE le générique
//   2. useSeoMeta         POSE le générique      (StrictMode double l'effet)
//   3. useDocumentTitle   POSE « Mon profil »
//   4. useDocumentTitle   CLEANUP                (StrictMode)
//   5. useDocumentTitle   POSE « Mon profil »
//   6. useSeoMeta         POSE le générique   ← après la redirection
//
// `useSeoMeta` vit dans `App` (parent), `useDocumentTitle` dans la page
// (enfant). Les effets ENFANTS s'exécutent toujours avant ceux du PARENT :
// quel que soit le déclencheur, le parent repose le générique en dernier.
//
// Une première tentative de correction par les dépendances de l'effet a donc
// échoué — elle ne pouvait pas réussir. 🥇 **L'ordre des effets se mesure, il
// ne se raisonne pas.**
//
// La seule correction possible : que `useSeoMeta` s'ABSTIENNE de poser le
// titre là où la page s'en charge. Il continue d'écrire la description et les
// `og:*`, qui restent génériques et n'ont pas d'équivalent par page.
//
// ⚠️ Le préfixe compte : `/profile` redirige vers `/profile/identite`, et c'est
// le layout `/profile` qui pose le titre pour toutes ses sous-routes.
const PREFIXES_A_TITRE_PROPRE = ['/faq', '/guide', '/legal', '/suppression-compte', '/accessibilite', '/securite', '/changelog', '/community', '/profile', '/cart', '/recipe', '/cook', '/login', '/signup', '/auth']

export function laPagePoseSonTitre(pathname) {
  if (typeof pathname !== 'string') return false
  return PREFIXES_A_TITRE_PROPRE.some(p => pathname === p || pathname.startsWith(p + '/'))
}
