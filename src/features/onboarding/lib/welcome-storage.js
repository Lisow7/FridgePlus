// Helpers localStorage du WelcomeScreen (PR 8.6.3).
// Extraits dans un fichier séparé pour ne pas casser react-refresh
// (un fichier composant ne doit exporter que des composants).

const WELCOME_FLAG_KEY = 'fridge-welcome-seen-v1'

export function hasSeenWelcome() {
  try { return localStorage.getItem(WELCOME_FLAG_KEY) === '1' }
  catch { return true } // si localStorage indisponible, on considère vu pour ne pas spammer
}

export function markWelcomeSeen() {
  try { localStorage.setItem(WELCOME_FLAG_KEY, '1') } catch { /* noop */ }
}

// Faut-il ouvrir l'écran de bienvenue, sur cette route ?
//
// ⚠️ La route fait partie de la décision, et ce n'est pas un détail. Constaté
// sur la preview le 2026-08-19, stockage vidé, sur `/faq` : l'écran s'affichait
// en plein écran par-dessus la page, bannière cookies et toast PWA au-dessus de
// lui. Un visiteur venu d'un moteur de recherche ne voyait aucune des réponses
// qu'il cherchait.
//
// Le défaut n'était pas nouveau — cette condition n'a jamais existé. Il était
// sans conséquence tant qu'aucune URL n'était atteignable de l'extérieur ;
// depuis le pré-rendu il y en a 520.
//
// 🔴 Le `pathname` DOIT venir de `useLocation()` et non de `window.location` :
// l'app est servie sous un `basename` (`/FridgePlus/` hors Vercel), que React
// Router retire et pas le navigateur. Une comparaison sur `window.location`
// serait fausse partout sauf en production.
//
// Ne pas voir l'écran ici ne le fait pas perdre : le drapeau n'est posé qu'à sa
// fermeture, donc il s'affichera à la première visite de l'accueil.
export function shouldOpenWelcome(pathname) {
  return pathname === '/' && !hasSeenWelcome()
}
