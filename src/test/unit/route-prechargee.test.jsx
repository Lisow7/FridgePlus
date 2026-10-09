import { describe, it, expect, vi } from 'vitest'
import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { lazyPrechargeable } from '@shared/lib/lazy-prechargeable'

// Une page pré-rendue ne doit plus clignoter (audit du 2026-10-04, PERF-05).
// Avant : React effaçait le HTML servi, posait un squelette le temps de
// télécharger la page paresseuse, puis la dessinait — texte, squelette, texte.
// Désormais la page de la route courante est chargée AVANT le premier rendu :
// une page déjà chargée se dessine sans passer par le squelette.

function fabriquer() {
  let resoudre
  const charger = vi.fn(() => new Promise((res) => { resoudre = res }))
  const Page = lazyPrechargeable(charger)
  const module = { default: () => <p>Contenu de la page</p> }
  return { Page, charger, livrer: () => resoudre(module) }
}

describe('lazyPrechargeable', () => {
  it('pas encore chargée : le squelette attend la page, comme lazy()', async () => {
    const { Page, livrer } = fabriquer()
    render(<Suspense fallback={<p>Squelette</p>}><Page /></Suspense>)

    expect(screen.getByText('Squelette')).toBeInTheDocument()
    livrer()
    expect(await screen.findByText('Contenu de la page')).toBeInTheDocument()
  })

  it('préchargée : elle se dessine du premier coup, sans squelette', async () => {
    const { Page, livrer } = fabriquer()
    const prechargement = Page.precharger()
    livrer()
    await prechargement

    render(<Suspense fallback={<p>Squelette</p>}><Page /></Suspense>)

    expect(screen.queryByText('Squelette')).not.toBeInTheDocument()
    expect(screen.getByText('Contenu de la page')).toBeInTheDocument()
  })

  it('le fichier n’est demandé qu’une fois, préchargé puis affiché', async () => {
    const { Page, charger, livrer } = fabriquer()
    const prechargement = Page.precharger()
    livrer()
    await prechargement
    render(<Suspense fallback={null}><Page /></Suspense>)

    expect(charger).toHaveBeenCalledTimes(1)
  })

  it('précharger deux fois ne redemande pas le fichier', async () => {
    const { Page, charger, livrer } = fabriquer()
    const premier = Page.precharger()
    const second = Page.precharger()
    livrer()
    await Promise.all([premier, second])

    expect(charger).toHaveBeenCalledTimes(1)
  })

  it('les props passent à la page', async () => {
    const charger = () => Promise.resolve({ default: ({ lang }) => <p>Langue : {lang}</p> })
    const Page = lazyPrechargeable(charger)
    await Page.precharger()

    render(<Page lang="en" />)

    expect(screen.getByText('Langue : en')).toBeInTheDocument()
  })
})
