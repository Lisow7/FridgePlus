import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  useSeoMeta,
  canonicalDecritLaPageAffichee,
  retirerCanonicalPerime,
} from '@shared/hooks/use-seo-meta'
import { SEO_META } from '@shared/static/seo-meta'

// Depuis le pré-rendu (2026-08-15), le HTML servi pour `/recipe/:id` porte le
// titre et les `og:*` de LA recette. `useSeoMeta` est appelé depuis `App.jsx`,
// donc sur toutes les routes : sans garde, il les écraserait par les
// métadonnées génériques du site au montage.
//
// Les crawlers sociaux n'exécutent pas JS et ne verraient rien de cet
// écrasement — Googlebot, si. Il indexerait 515 pages au même titre, c'est-à-dire
// le défaut que le pré-rendu corrige.

function poserTete({ canonical } = {}) {
  document.head.innerHTML = `
    <title>Titre du HTML servi</title>
    <meta name="description" content="Description du HTML servi" />
    <meta property="og:title" content="og du HTML servi" />
    <meta property="og:description" content="og description servie" />
    <meta property="og:locale" content="fr_FR" />
    <meta name="twitter:title" content="tw du HTML servi" />
    <meta name="twitter:description" content="tw description servie" />
    ${canonical ? `<link rel="canonical" href="${canonical}" /><meta property="og:url" content="${canonical}" />` : ''}
  `
  document.title = 'Titre du HTML servi'
}

function Sonde({ lang = 'fr' }) {
  useSeoMeta(lang)
  return null
}

function monterSur(chemin, lang = 'fr') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Sonde lang={lang} />
    </MemoryRouter>,
  )
}

const contenuMeta = (selecteur) => document.querySelector(selecteur)?.getAttribute('content') ?? null

describe('canonicalDecritLaPageAffichee', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  it('false quand aucun canonical n’est présent (page non pré-rendue)', () => {
    poserTete()
    expect(canonicalDecritLaPageAffichee(document, '/')).toBe(false)
  })

  it('true quand le canonical décrit la page affichée', () => {
    poserTete({ canonical: 'https://fridgeplus.app/recipe/pho-boeuf' })
    expect(canonicalDecritLaPageAffichee(document, '/recipe/pho-boeuf')).toBe(true)
  })

  it('🔴 false quand le canonical vient d’une AUTRE page — le cas SPA', () => {
    // Le `<link>` survit à la navigation : sans cette comparaison, l'accueil
    // conserverait le canonical de la recette et se déclarerait son doublon.
    poserTete({ canonical: 'https://fridgeplus.app/recipe/pho-boeuf' })
    expect(canonicalDecritLaPageAffichee(document, '/')).toBe(false)
  })
})

describe('retirerCanonicalPerime', () => {
  it('retire le canonical ET og:url', () => {
    poserTete({ canonical: 'https://fridgeplus.app/recipe/pho-boeuf' })
    retirerCanonicalPerime(document)
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.querySelector('meta[property="og:url"]')).toBeNull()
  })

  it('ne casse rien s’il n’y a rien à retirer', () => {
    poserTete()
    expect(() => retirerCanonicalPerime(document)).not.toThrow()
  })
})

describe('useSeoMeta — respecte une page pré-rendue', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  it('N’ÉCRASE PAS le titre ni les og d’une page pré-rendue', () => {
    poserTete({ canonical: 'https://fridgeplus.app/recipe/pho-boeuf' })
    monterSur('/recipe/pho-boeuf')

    expect(document.title).toBe('Titre du HTML servi')
    expect(contenuMeta('meta[property="og:title"]')).toBe('og du HTML servi')
    expect(contenuMeta('meta[name="description"]')).toBe('Description du HTML servi')
    expect(contenuMeta('meta[name="twitter:title"]')).toBe('tw du HTML servi')
  })

  it('applique bien les métadonnées du site sur une page NON pré-rendue', () => {
    // Sans ce témoin, le test précédent passerait même si le hook ne faisait
    // plus jamais rien.
    poserTete()
    monterSur('/')
    expect(document.title).toBe(SEO_META.fr.title)
    expect(contenuMeta('meta[property="og:title"]')).toBe(SEO_META.fr.title)
  })

  it('🔴 retire le canonical hérité en quittant la page pré-rendue', () => {
    // Arrivée sur la recette, puis navigation vers l'accueil : le canonical de
    // la recette ne doit pas survivre, sinon l'accueil se déclare son doublon.
    poserTete({ canonical: 'https://fridgeplus.app/recipe/pho-boeuf' })
    monterSur('/')

    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.querySelector('meta[property="og:url"]')).toBeNull()
    expect(document.title).toBe(SEO_META.fr.title)
  })

  it('applique la langue du document même sur une page pré-rendue', () => {
    // `lang` décrit ce qui est AFFICHÉ : il suit l'utilisateur, pas le pré-rendu.
    poserTete({ canonical: 'https://fridgeplus.app/recipe/pho-boeuf' })
    monterSur('/recipe/pho-boeuf', 'en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Titre du HTML servi')
  })
})
