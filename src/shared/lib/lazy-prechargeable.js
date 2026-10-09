import { createElement, lazy, useState } from 'react'

// Une page paresseuse que l'on peut charger AVANT de la rendre (audit du
// 2026-10-04, PERF-05).
//
// `lazy()` seul suspend au premier rendu, même quand le fichier est déjà là :
// sur une page pré-rendue, le squelette s'intercalait entre le HTML servi et la
// page — texte, squelette, texte. Une fois `precharger()` résolu, la page se
// rend directement, sans passer par Suspense.
//
// Le composant rendu est choisi UNE fois par montage : basculer de la version
// paresseuse à la page elle-même en cours de vie la remonterait (état perdu).
export function lazyPrechargeable(charger) {
  let module = null
  let enCours = null
  const chargerUneFois = () => {
    if (!enCours) {
      enCours = charger().then(
        (m) => { module = m; return m },
        (err) => { enCours = null; throw err },
      )
    }
    return enCours
  }
  const Paresseuse = lazy(chargerUneFois)

  function PagePrechargeable(props) {
    const [Composant] = useState(() => (module ? module.default : Paresseuse))
    return createElement(Composant, props)
  }
  PagePrechargeable.precharger = () => chargerUneFois().then(() => undefined)
  return PagePrechargeable
}
