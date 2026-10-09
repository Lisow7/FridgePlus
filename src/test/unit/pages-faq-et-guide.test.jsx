import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Garde-fou de rendu des deux pages publiques `/faq` et `/guide`.
//
// ── Ce qu'il attrape, et que rien d'autre n'attraperait ─────────────────────
// Le contenu de ces pages vient de dictionnaires partagés dont la FORME peut
// changer sans que personne ne s'en aperçoive :
//
//   · `FAQ_BASICS_I18N` expose `{ questions: [...] }`. Si quelqu'un l'aplatit
//     en tableau — la forme qu'il avait dans `HELP_I18N` avant le 2026-08-16 —
//     et le fait dans les DEUX langues, le test de parité i18n reste vert,
//     `getFaqBasics()` rend `undefined`, et `/faq` casse au premier `.length`.
//   · `TOUR_STEPS_I18N` : une clé d'étape renommée fait disparaître l'étape en
//     silence (le rendu la saute par un `if (!etape) return null`).
//
// D'où des assertions sur du TEXTE réellement affiché, pas sur la présence des
// modules.

vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: false }))

// `GuidePage` lit la session (pour choisir l'étape finale de la visite) : sans
// provider, `useAuth` échoue. Même approche que `help-guide-hub.test.jsx`.
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: null, profile: null, isAdmin: false }),
}))

import FaqPage from '@features/legal/pages/faq-page'
import GuidePage from '@features/onboarding/pages/guide-page'
import { getFaqBasics } from '@shared/lib/i18n/faq-basics-i18n'

const rendre = (Composant, lang = 'fr') =>
  render(<MemoryRouter><Composant lang={lang} /></MemoryRouter>)

describe('/faq — page Questions fréquentes', () => {
  it('affiche les DEUX blocs : prise en main et service', () => {
    rendre(FaqPage)
    expect(screen.getByRole('heading', { level: 1, name: 'Questions fréquentes' })).toBeInTheDocument()
    // Bloc « prise en main » — vient de `faq-basics-i18n`.
    expect(screen.getByText('Faut-il un compte ?')).toBeInTheDocument()
    // Bloc « service » — vient de `legal-content`. Les deux sources doivent
    // être rendues : n'en afficher qu'une passerait inaperçu à l'œil.
    expect(screen.getByText('Le service est-il gratuit ?')).toBeInTheDocument()
  })

  it('rend TOUTES les questions de prise en main, pas seulement la première', () => {
    rendre(FaqPage)
    for (const { q } of getFaqBasics('fr')) {
      expect(screen.getByText(q)).toBeInTheDocument()
    }
  })

  it('ouvre la prise en main sur le bouton orange (glyphe + phrase) et range les questions en quatre blocs', () => {
    rendre(FaqPage)
    expect(screen.getByText(/Tout part du bouton orange/)).toBeInTheDocument()
    expect(document.querySelector('section[aria-labelledby="faq-basics"] [data-fab-glyph]')).not.toBeNull()
    for (const libelle of ['Remplir', 'Vérifier', 'Cuisiner', 'Compte & données']) {
      expect(screen.getByText(libelle, { selector: '[data-faq-group]' })).toBeInTheDocument()
    }
  })

  it('chaque réponse renvoie à l’étape du guide qui la détaille', () => {
    rendre(FaqPage)
    const liens = screen.getAllByRole('link', { name: /Voir l’étape \d du guide/ })
    expect(liens.length).toBe(getFaqBasics('fr').length)
    for (const l of liens) expect(l).toHaveAttribute('href', expect.stringMatching(/^\/guide#etape-[1-5]$/))
  })

  it('propose le lien vers /guide', () => {
    rendre(FaqPage)
    // Deux liens y mènent depuis l'ajout du bloc de fin : celui de la prise en
    // main et celui du bas de page. Les deux doivent pointer au bon endroit —
    // `getByRole` échouerait sur l'ambiguïté, ce qui masquerait le vrai
    // contrôle.
    const liens = screen.getAllByRole('link', { name: /étape par étape/ })
    expect(liens.length).toBeGreaterThanOrEqual(1)
    for (const lien of liens) expect(lien).toHaveAttribute('href', '/guide')
  })

  it('ne promet AUCUN abonnement tant que le premium est en pause', () => {
    // 🔴 Les deux blocs de cette page venaient de deux ÉCRANS différents, et ils
    // se contredisaient : la prise en main annonçait « pour l'instant, tout est
    // gratuit », la FAQ du service un abonnement « disponible sous forme
    // mensuelle ou annuelle ». Personne ne les avait jamais lus l'un sous
    // l'autre — les réunir sur une seule URL a rendu l'écart visible.
    //
    // Ce test n'existe que parce que la contradiction ne se voit PAS en lisant
    // l'un des deux dictionnaires : il faut les lire ensemble, ce que seul le
    // rendu de la page fait.
    rendre(FaqPage)
    expect(screen.getByText(/tout est gratuit/)).toBeInTheDocument()
    expect(screen.getByText(/aucun moyen de payer/)).toBeInTheDocument()
    expect(screen.queryByText(/abonnement mensuel ou annuel/)).not.toBeInTheDocument()
  })

  it('bascule en anglais', () => {
    rendre(FaqPage, 'en')
    expect(screen.getByRole('heading', { level: 1, name: 'Frequently asked questions' })).toBeInTheDocument()
    expect(screen.getByText('Do I need an account?')).toBeInTheDocument()
  })
})

describe('/guide — page Comment ça marche', () => {
  it('affiche les 5 étapes, dans l’ordre du menu, la finale du lecteur comprise', () => {
    rendre(GuidePage)
    expect(screen.getByRole('heading', { level: 1, name: 'Comment ça marche' })).toBeInTheDocument()
    const titres = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    // Le bloc de fin ajoute un 6ᵉ titre, après les étapes.
    expect(titres.slice(0, 5)).toEqual([
      'Le bouton orange',
      'Remplis ton frigo',
      'Vérifier ce que tu as',
      'Ce que tu peux cuisiner',
      'Aller plus loin',
    ])
    expect(titres.at(-1)).toBe('Prêt à cuisiner ?')
  })

  it('la finale suit le profil : un invité lit « Aller plus loin » côté compte, jamais la finale premium', () => {
    // `useAuth` est simulé sans utilisateur → finale invité. Les finales
    // connectée et premium tiendraient un discours qui ne le concerne pas.
    rendre(GuidePage)
    expect(screen.getByText(/Un compte retrouve tes favoris sur tous tes appareils/)).toBeInTheDocument()
    expect(screen.queryByText(/Tu connais l’essentiel/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Va voir la communauté/)).not.toBeInTheDocument()
  })

  it('propose de lancer la visite interactive', () => {
    rendre(GuidePage)
    expect(screen.getByRole('button', { name: /Lancer la visite guidée/ })).toBeInTheDocument()
  })

  it('bascule en anglais', () => {
    rendre(GuidePage, 'en')
    expect(screen.getByRole('heading', { level: 1, name: 'How it works' })).toBeInTheDocument()
  })
})

describe('bloc de fin — dans les pages rendues', () => {
  it('/faq propose d’ouvrir l’app et renvoie vers /guide', () => {
    rendre(FaqPage)
    const action = screen.getByRole('link', { name: /Ouvrir mon frigo/ })
    expect(action).toHaveAttribute('href', '/')
    expect(screen.getByText('Gratuit, sans compte')).toBeInTheDocument()
  })

  it('/guide renvoie vers /faq — le lien qui manquait', () => {
    rendre(GuidePage)
    expect(screen.getByRole('link', { name: /Questions fréquentes/ })).toHaveAttribute('href', '/faq')
  })

  it('bascule en anglais', () => {
    rendre(GuidePage, 'en')
    expect(screen.getByRole('link', { name: /Open my fridge/ })).toBeInTheDocument()
  })
})
