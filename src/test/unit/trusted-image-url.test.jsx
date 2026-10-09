import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { isProjectStorageUrl } from '@shared/lib/images/trusted-image-url'
import Emoji from '@shared/ui/emoji'

// Une image « sur mesure » (`recipes_unified.image_url`, `ingredients.image_url`)
// vient de la base. Celle d'une recette communautaire est écrite par son
// auteur : sans contrôle, il y mettait l'adresse de son propre serveur et
// chaque visiteur dont la liste affichait la carte lui envoyait son adresse IP
// (audit 2026-10-04, SEC-15). Seul le stockage public DU PROJET est affiché.
const PROJET = 'https://projet.supabase.co'
const PHOTO = `${PROJET}/storage/v1/object/public/recipe-photos/carbonara.webp`

describe('isProjectStorageUrl', () => {
  beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', PROJET) })
  afterEach(() => { vi.unstubAllEnvs() })

  it('accepte une image du stockage public du projet', () => {
    expect(isProjectStorageUrl(PHOTO)).toBe(true)
  })

  it('tolère une barre finale dans l’adresse configurée', () => {
    vi.stubEnv('VITE_SUPABASE_URL', `${PROJET}/`)
    expect(isProjectStorageUrl(PHOTO)).toBe(true)
  })

  it.each([
    ['un autre site', 'https://attaquant.exemple/p.gif?r=1'],
    ['un autre projet Supabase', 'https://autre.supabase.co/storage/v1/object/public/recipe-photos/x.webp'],
    ['un hôte qui commence comme le nôtre', 'https://projet.supabase.co.attaquant.exemple/storage/v1/object/public/x.webp'],
    ['notre hôte hors du stockage public', `${PROJET}/rest/v1/profiles`],
    ['du http', 'http://projet.supabase.co/storage/v1/object/public/recipe-photos/x.webp'],
    ['une adresse relative au protocole', '//attaquant.exemple/p.gif'],
    ['un data: URI', 'data:image/svg+xml,<svg onload=alert(1)>'],
    ['un javascript: URI', 'javascript:alert(1)'],
    ['une valeur vide', ''],
    ['null', null],
    ['un objet', { href: PHOTO }],
  ])('refuse %s', (_cas, url) => {
    expect(isProjectStorageUrl(url)).toBe(false)
  })

  it('refuse tout quand l’adresse du projet n’est pas configurée', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    expect(isProjectStorageUrl(PHOTO)).toBe(false)
  })
})

describe('<Emoji imageUrl> — seule une image du projet est chargée', () => {
  beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', PROJET) })
  afterEach(() => { vi.unstubAllEnvs() })

  it('charge la vignette d’une image du projet', () => {
    render(<Emoji char="🍅" imageUrl={PHOTO} />)
    const img = document.querySelector('img')
    expect(img.src).toBe(`${PROJET}/storage/v1/object/public/recipe-photos/thumb/carbonara.webp`)
  })

  it('ne contacte PAS un hôte étranger : repli sur l’emoji', () => {
    render(<Emoji char="🍅" imageUrl="https://attaquant.exemple/p.gif?r=1" />)
    const img = document.querySelector('img')
    expect(img.src).not.toContain('attaquant.exemple')
    expect(img.src).toContain('tomato')
  })
})
