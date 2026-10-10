import { Component } from 'react'
import { logError } from '@shared/lib/observability/sentry'

// Un élément FACULTATIF (le bandeau de mise à jour…) qui ne se charge pas ne
// s'affiche pas, et n'emporte rien : sans ce filet, son erreur remontait au
// filet de l'application, qui remplaçait tout l'écran (trouvé le 2026-10-10 :
// réseau coupé pendant une première visite, le morceau à la demande manquait).
// L'échec va au journal. Jamais autour d'un écran obligatoire (une porte
// d'accord, la double authentification) : son absence doit se voir.
export default class SiIndisponibleRien extends Component {
  constructor(props) {
    super(props)
    this.state = { echec: false }
  }

  static getDerivedStateFromError() {
    return { echec: true }
  }

  componentDidCatch(erreur) {
    logError(erreur, { tag: 'error-boundary.facultatif', nom: this.props.nom })
  }

  render() {
    return this.state.echec ? null : this.props.children
  }
}
