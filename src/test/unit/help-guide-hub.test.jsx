import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: false }))
vi.mock('@shared/contexts/recipe-form-context', () => ({ useRecipeForm: () => ({ openCreate: () => {} }) }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => false }))

import HelpGuide from '@features/onboarding/components/help-guide'
import { CURRENT_VERSION } from '@shared/lib/version'

const renderHelp = (props = {}) =>
  render(<MemoryRouter><HelpGuide lang="fr" {...props} /></MemoryRouter>)

// Sonde d'URL : la modale ne rend plus le contenu du guide ni celui de la FAQ,
// elle NAVIGUE vers `/guide` et `/faq`. Un test qui se contenterait de cliquer
// sans regarder l'URL resterait vert si les deux boutons ne faisaient plus
// rien — c'est précisément la régression qu'on veut voir.
function SondeUrl() {
  const { pathname } = useLocation()
  return <span data-testid="url">{pathname}</span>
}

const renderHelpAvecUrl = (props = {}) =>
  render(
    <MemoryRouter>
      <HelpGuide lang="fr" {...props} />
      <SondeUrl />
    </MemoryRouter>
  )

describe('HelpGuide — hub Aide & infos', () => {
  it('le bouton déclencheur porte le label "Aide & infos" (fr)', () => {
    renderHelp()
    expect(screen.getByRole('button', { name: 'Aide & infos' })).toBeInTheDocument()
  })

  it('ouvre la modale avec le titre "Aide & infos" et affiche la version (fr)', async () => {
    const user = userEvent.setup()
    renderHelp()

    await user.click(screen.getByRole('button', { name: 'Aide & infos' }))

    expect(screen.getByText('Aide & infos')).toBeInTheDocument()
    expect(screen.getByText(`v${CURRENT_VERSION}`, { exact: false })).toBeInTheDocument()
  })

  it('ouvre la modale avec le titre "Help & info" (en)', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><HelpGuide lang="en" /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Help & info' }))

    expect(screen.getByText('Help & info')).toBeInTheDocument()
    expect(screen.getByText(`v${CURRENT_VERSION}`, { exact: false })).toBeInTheDocument()
  })

  it('« Questions fréquentes » mène à /faq et ferme la modale (fr)', async () => {
    const user = userEvent.setup()
    renderHelpAvecUrl()

    await user.click(screen.getByRole('button', { name: 'Aide & infos' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/')

    await user.click(screen.getByRole('button', { name: /Questions fréquentes/ }))

    expect(screen.getByTestId('url')).toHaveTextContent('/faq')
    // La modale se referme : la laisser ouverte masquerait la page derrière.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('« Comment ça marche » mène à /guide et ferme la modale (fr)', async () => {
    const user = userEvent.setup()
    renderHelpAvecUrl()

    await user.click(screen.getByRole('button', { name: 'Aide & infos' }))
    // Le libellé annonce la PAGE et non le lancement de la visite : il disait
    // « Visite guidée — découvre l'app en 2 min » et ouvrait un texte.
    await user.click(screen.getByRole('button', { name: /^Comment ça marche/ }))

    expect(screen.getByTestId('url')).toHaveTextContent('/guide')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('le contenu de la FAQ n\'est plus rendu dans la modale (fr)', async () => {
    const user = userEvent.setup()
    renderHelp()

    await user.click(screen.getByRole('button', { name: 'Aide & infos' }))

    // Garde anti-doublon : si ces questions réapparaissaient ici, `/faq` et la
    // modale serviraient le même texte à deux endroits — le contenu dupliqué
    // qu'on cherche justement à supprimer.
    expect(screen.queryByText('Comment ajouter des ingrédients ?')).not.toBeInTheDocument()
    expect(screen.queryByText('Faut-il un compte ?')).not.toBeInTheDocument()
  })
})

// Audit du 2026-10-04 (UX-01). Pour un visiteur sans compte, « Contacter le
// support » fermait la fenêtre et n'ouvrait rien : le panneau de support
// n'est rendu que pour un compte. L'état « support ouvert » restait pourtant
// vrai, et faisait disparaître le bouton orange de l'accueil. Un visiteur a
// désormais un vrai moyen d'écrire : un lien vers l'adresse du support.
describe('HelpGuide — écrire au support', () => {
  it('connecté : le bouton ouvre le panneau de support et ferme la fenêtre', async () => {
    const user = userEvent.setup()
    const onShowSupport = vi.fn()
    renderHelp({ onShowSupport })

    await user.click(screen.getByRole('button', { name: 'Aide & infos' }))
    await user.click(screen.getByRole('button', { name: /Contacter le support/ }))

    expect(onShowSupport).toHaveBeenCalledOnce()
  })

  it('sans compte : pas de bouton mort, un lien qui écrit à support@fridgeplus.app', async () => {
    const user = userEvent.setup()
    renderHelp()

    await user.click(screen.getByRole('button', { name: 'Aide & infos' }))

    expect(screen.queryByRole('button', { name: /Contacter le support/ })).not.toBeInTheDocument()
    const lien = screen.getByRole('link', { name: /Écrire au support/ })
    expect(lien).toHaveAttribute('href', 'mailto:support@fridgeplus.app')
    expect(lien).toHaveTextContent('support@fridgeplus.app')
  })

  it('sans compte, en anglais : le lien est traduit', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><HelpGuide lang="en" /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Help & info' }))

    expect(screen.getByRole('link', { name: /Email support/ })).toHaveAttribute('href', 'mailto:support@fridgeplus.app')
  })
})
