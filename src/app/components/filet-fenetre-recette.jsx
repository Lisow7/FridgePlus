import { Component } from 'react'
import { logError } from '@shared/lib/observability/sentry'
import { rechargerSurLaDerniereVersion } from '@features/pwa/lib/version-perimee'
import { estUnMorceauIntrouvable } from '@app/error/morceau-introuvable'
import { Z_INDEX } from '@shared/lib/z-index'
import { ORANGE_LISIBLE } from '@features/auth/lib/ecrans-du-compte'

// Le filet de la fenêtre « Créer / Modifier une recette » (décision du
// 2026-10-08) : jusque-là, un plantage de la fenêtre faisait passer TOUTE
// l'application à l'écran « Une erreur est survenue ». Désormais la fenêtre le
// dit elle-même : « Réessayer » la rouvre — avec le brouillon, en création (il
// est gardé sur l'appareil) ; « Fermer » (ou Échap) rend l'application là où on
// était. En modification, il n'y a pas de brouillon : le message le dit. Un
// morceau de code disparu (déploiement) se recharge sur la version neuve.
//
// Volontairement léger : ce filet est dans le paquet de démarrage (l'overlay
// l'est), et il doit s'afficher même quand le réseau manque — pas de fenêtre
// réutilisable ni de morceau à charger.
const I18N = {
  fr: {
    creer: 'Créer une recette', modifier: 'Modifier la recette',
    probleme: 'La fenêtre a rencontré un problème',
    brouillon: 'Ton brouillon est gardé sur cet appareil.',
    perdus: 'Tes changements n’ont pas pu être gardés.',
    reessayer: 'Réessayer', fermer: 'Fermer',
  },
  en: {
    creer: 'Create a recipe', modifier: 'Edit the recipe',
    probleme: 'The window ran into a problem',
    brouillon: 'Your draft is kept on this device.',
    perdus: 'Your changes couldn’t be kept.',
    reessayer: 'Try again', fermer: 'Close',
  },
}

const BOUTON = {
  minHeight: '40px', padding: '8px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

export default class FiletDeLaFenetreRecette extends Component {
  constructor(props) {
    super(props)
    this.state = { erreur: null }
  }

  static getDerivedStateFromError(erreur) {
    return { erreur }
  }

  componentDidCatch(erreur, info) {
    logError(erreur, { tag: 'error-boundary.recipe-form', componentStack: info?.componentStack })
  }

  reessayer = () => {
    if (estUnMorceauIntrouvable(this.state.erreur)) void rechargerSurLaDerniereVersion()
    else this.setState({ erreur: null })
  }

  render() {
    if (!this.state.erreur) return this.props.children
    const { lang = 'fr', darkMode = false, enModification = false, onFermer } = this.props
    const t = I18N[lang] ?? I18N.fr
    return (
      <div onKeyDown={(e) => { if (e.key === 'Escape') onFermer?.() }} style={{
        position: 'fixed', inset: 0, zIndex: Z_INDEX.MODAL, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}>
        <div role="dialog" aria-modal="true" aria-labelledby="filet-recette-titre" style={{
          width: '100%', maxWidth: '380px', borderRadius: '16px', padding: '20px',
          background: darkMode ? 'var(--color-dark-surface)' : 'var(--color-surface)',
          color: 'var(--color-charcoal)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}>
          <h2 id="filet-recette-titre" style={{ margin: '0 0 12px', fontSize: '18px' }}>
            {enModification ? t.modifier : t.creer}
          </h2>
          <p role="alert" style={{ margin: '0 0 8px', fontWeight: 700 }}>⚠️ {t.probleme}</p>
          <p style={{ margin: '0 0 16px' }}>{enModification ? t.perdus : t.brouillon}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onFermer}
              style={{ ...BOUTON, border: '1.5px solid var(--color-border-warm)', background: 'transparent', color: 'inherit' }}>
              {t.fermer}
            </button>
            {/* Le focus va sur « Réessayer » : la fenêtre a disparu sous les doigts. */}
            <button type="button" autoFocus onClick={this.reessayer}
              style={{ ...BOUTON, border: 'none', background: ORANGE_LISIBLE, color: 'white' }}>
              {t.reessayer}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
