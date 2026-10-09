import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

// Imprime un élément React.
//
// L'élément est rendu dans une racine posée sur <body>, À CÔTÉ de `#root`, puis
// `window.print()` est appelé. Pendant l'impression, `<html>` porte la classe
// `fp-printing` : la feuille de style (`src/index.css`, bloc « Impression »)
// masque alors l'application et ne laisse que cette racine.
//
// Ce module remplace `print-document.js` (document HTML en chaîne, ouvert dans
// une fenêtre `blob:`). Deux défauts en découlaient (audit du 2026-10-04) :
//  - SEC-01 : la fenêtre `blob:` a la MÊME origine que l'app. Un champ oublié
//    par l'échappement manuel y devenait du code pouvant lire la session ;
//  - SEC-04 : l'impression partait d'un `<script>` en ligne, que la CSP de
//    production refuse — le bouton ouvrait une fenêtre et n'imprimait rien.
// Ici rien n'est assemblé à la main : React échappe tout ce qu'il rend, et il
// n'y a ni fenêtre, ni blob, ni script.
const CLASSE_RACINE = 'fp-print-root'
const CLASSE_EN_COURS = 'fp-printing'

let enCours = null

function terminer() {
  if (!enCours) return
  const { root, conteneur } = enCours
  enCours = null
  window.removeEventListener('afterprint', terminer)
  document.documentElement.classList.remove(CLASSE_EN_COURS)
  root.unmount()
  conteneur.remove()
}

export function printReactElement(element) {
  // Sur mobile, `afterprint` n'arrive pas toujours : la racine précédente est
  // retirée ici plutôt que de s'empiler. Elle est invisible à l'écran entre
  // deux impressions (`display: none` hors `@media print`).
  terminer()

  const conteneur = document.createElement('div')
  conteneur.className = CLASSE_RACINE
  document.body.appendChild(conteneur)
  const root = createRoot(conteneur)
  // Rendu synchrone : le contenu doit être dans la page AVANT `window.print()`,
  // qui fige le document au moment de l'appel.
  flushSync(() => root.render(element))

  enCours = { root, conteneur }
  document.documentElement.classList.add(CLASSE_EN_COURS)
  window.addEventListener('afterprint', terminer)
  window.print()
}
